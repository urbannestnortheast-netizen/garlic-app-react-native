"""Garlic by Urban Nest — Backend regression tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pastel-nest-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def user_creds():
    uid = uuid.uuid4().hex[:8]
    return {
        "name": "Test User",
        "email": f"test_{uid}@example.com",
        "mobile": f"9{uid[:9].ljust(9, '0')}",
        "password": "TestPass@123",
    }


@pytest.fixture(scope="session")
def user_token(s, user_creds):
    r = s.post(f"{API}/auth/signup", json=user_creds)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _assert_no_mongo_id(payload):
    """Recursively verify no `_id` field appears anywhere."""
    if isinstance(payload, dict):
        assert "_id" not in payload, f"Mongo _id leaked: {payload}"
        for v in payload.values():
            _assert_no_mongo_id(v)
    elif isinstance(payload, list):
        for item in payload:
            _assert_no_mongo_id(item)


# ---------------- Health
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "Garlic" in data.get("app", "")


# ---------------- Categories
class TestCategories:
    def test_list_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) == 7
        ids = {c["id"] for c in cats}
        assert {"home-essentials", "crockery", "decor", "appliance", "cups", "plates", "furniture"} == ids
        _assert_no_mongo_id(cats)


# ---------------- Products
class TestProducts:
    def test_list_products(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        # Seed contains 21 products
        assert len(products) >= 21, f"Expected >=21 seeded products, got {len(products)}"
        _assert_no_mongo_id(products)

    def test_filter_by_category(self, s):
        r = s.get(f"{API}/products", params={"category": "crockery"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p["category"] == "crockery"

    def test_filter_featured(self, s):
        r = s.get(f"{API}/products", params={"featured": "true"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p["featured"] is True

    def test_get_single_product(self, s):
        products = s.get(f"{API}/products").json()
        pid = products[0]["id"]
        r = s.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid
        _assert_no_mongo_id(r.json())

    def test_get_product_404(self, s):
        r = s.get(f"{API}/products/does-not-exist-xyz")
        assert r.status_code == 404


# ---------------- Auth
class TestAuth:
    def test_signup_and_token(self, s, user_token, user_creds):
        assert user_token
        # /me
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == user_creds["email"].lower()
        assert me["role"] == "user"
        _assert_no_mongo_id(me)

    def test_signup_duplicate(self, s, user_creds):
        r = s.post(f"{API}/auth/signup", json=user_creds)
        assert r.status_code == 400

    def test_login_by_email(self, s, user_creds):
        r = s.post(f"{API}/auth/login", json={"identifier": user_creds["email"], "password": user_creds["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == user_creds["email"].lower()

    def test_login_by_mobile(self, s, user_creds):
        r = s.post(f"{API}/auth/login", json={"identifier": user_creds["mobile"], "password": user_creds["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["mobile"] == user_creds["mobile"]

    def test_login_wrong_password(self, s, user_creds):
        r = s.post(f"{API}/auth/login", json={"identifier": user_creds["email"], "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_admin_login(self, admin_token):
        assert admin_token


# ---------------- Admin RBAC + product CRUD
class TestAdminCRUD:
    def test_create_product_requires_admin(self, s, user_token):
        payload = {"name": "TEST_Item", "category": "decor", "price": 100.0}
        r = s.post(f"{API}/products", json=payload, headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_full_crud(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "name": "TEST_Admin_Product",
            "category": "decor",
            "price": 999.0,
            "description": "temp",
            "images": ["https://example.com/x.jpg"],
            "featured": False,
        }
        # Create
        r = s.post(f"{API}/products", json=payload, headers=h)
        assert r.status_code == 200, r.text
        created = r.json()
        pid = created["id"]
        assert created["name"] == payload["name"]
        _assert_no_mongo_id(created)

        # GET verify persistence
        r2 = s.get(f"{API}/products/{pid}")
        assert r2.status_code == 200
        assert r2.json()["price"] == 999.0

        # Update
        updated_payload = {**payload, "name": "TEST_Admin_Updated", "price": 1234.0}
        r3 = s.put(f"{API}/products/{pid}", json=updated_payload, headers=h)
        assert r3.status_code == 200
        assert r3.json()["name"] == "TEST_Admin_Updated"

        # GET verify update
        r4 = s.get(f"{API}/products/{pid}")
        assert r4.json()["price"] == 1234.0

        # Delete
        r5 = s.delete(f"{API}/products/{pid}", headers=h)
        assert r5.status_code == 200

        # Verify deletion => 404
        r6 = s.get(f"{API}/products/{pid}")
        assert r6.status_code == 404


# ---------------- Wishlist
class TestWishlist:
    def test_toggle_and_get(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        pid = s.get(f"{API}/products").json()[0]["id"]

        # Toggle on
        r = s.post(f"{API}/wishlist/toggle", json={"product_id": pid}, headers=h)
        assert r.status_code == 200
        assert r.json()["in_wishlist"] is True

        # Fetch list
        r2 = s.get(f"{API}/wishlist", headers=h)
        assert r2.status_code == 200
        items = r2.json()
        assert any(p["id"] == pid for p in items)
        _assert_no_mongo_id(items)

        # Toggle off
        r3 = s.post(f"{API}/wishlist/toggle", json={"product_id": pid}, headers=h)
        assert r3.json()["in_wishlist"] is False

        r4 = s.get(f"{API}/wishlist", headers=h)
        assert all(p["id"] != pid for p in r4.json())


# ---------------- Orders + Mock Payment
class TestOrdersAndPayment:
    def test_full_order_flow(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        pid = s.get(f"{API}/products").json()[0]["id"]

        payload = {
            "items": [{"product_id": pid, "quantity": 2}],
            "shipping_address": "TEST 123 Lane",
            "shipping_name": "TEST Buyer",
            "shipping_phone": "9999999999",
        }
        r = s.post(f"{API}/orders/create", json=payload, headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mock"] is True, "Expected mock=true since Razorpay keys are empty"
        assert data["checkout_url"].endswith(f"/api/payments/checkout/{data['order']['id']}")
        assert data["order"]["mock_payment"] is True
        assert data["order"]["status"] == "created"
        _assert_no_mongo_id(data)
        order_id = data["order"]["id"]

        # List orders
        r2 = s.get(f"{API}/orders", headers=h)
        assert r2.status_code == 200
        assert any(o["id"] == order_id for o in r2.json())

        # Get order
        r3 = s.get(f"{API}/orders/{order_id}", headers=h)
        assert r3.status_code == 200
        assert r3.json()["id"] == order_id

        # Hosted checkout HTML preview
        r4 = requests.get(f"{API}/payments/checkout/{order_id}")
        assert r4.status_code == 200
        assert "text/html" in r4.headers.get("content-type", "").lower()

        # Mock pay
        r5 = s.post(f"{API}/orders/{order_id}/mock-pay", headers=h)
        assert r5.status_code == 200
        assert r5.json()["status"] == "paid"

        # Verify status persisted
        r6 = s.get(f"{API}/orders/{order_id}", headers=h)
        assert r6.json()["status"] == "paid"
        assert r6.json().get("payment_id", "").startswith("mock_")

    def test_orders_require_auth(self, s):
        r = s.get(f"{API}/orders")
        assert r.status_code == 401

    def test_other_user_cannot_access_order(self, s, user_token):
        # Create an order as user, then try fetch with admin (should 404 since owner check)
        h = {"Authorization": f"Bearer {user_token}"}
        pid = s.get(f"{API}/products").json()[0]["id"]
        payload = {
            "items": [{"product_id": pid, "quantity": 1}],
            "shipping_address": "TEST", "shipping_name": "TEST", "shipping_phone": "9999999999",
        }
        oid = s.post(f"{API}/orders/create", json=payload, headers=h).json()["order"]["id"]

        # Sign up a second user
        u2 = {"name": "u2", "email": f"u2_{uuid.uuid4().hex[:6]}@x.com", "mobile": f"88{uuid.uuid4().hex[:8]}", "password": "Pass@123"}
        t2 = s.post(f"{API}/auth/signup", json=u2).json()["access_token"]
        r = s.get(f"{API}/orders/{oid}", headers={"Authorization": f"Bearer {t2}"})
        assert r.status_code == 404, "Other user should NOT access another user's order"

        # And should not be able to mock-pay
        r2 = s.post(f"{API}/orders/{oid}/mock-pay", headers={"Authorization": f"Bearer {t2}"})
        assert r2.status_code == 404
