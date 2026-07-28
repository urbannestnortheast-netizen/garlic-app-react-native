"""Garlic by Urban Nest — Backend regression tests (iteration 2, Nestasia taxonomy)."""
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
    if isinstance(payload, dict):
        assert "_id" not in payload, f"Mongo _id leaked: keys={list(payload.keys())}"
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
        assert data.get("app") == "Garlic by Urban Nest"


# ---------------- Categories (Nestasia hierarchical taxonomy)
class TestCategories:
    EXPECTED = {"dining", "kitchen", "decor", "bath", "soft-furnishing", "accessories"}

    def test_list_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) == 6
        ids = {c["id"] for c in cats}
        assert ids == self.EXPECTED
        for c in cats:
            assert "name" in c and "image" in c
            assert isinstance(c.get("subcategories"), list) and len(c["subcategories"]) >= 1
            for sc in c["subcategories"]:
                assert "id" in sc and "name" in sc
        _assert_no_mongo_id(cats)

    def test_get_dining(self, s):
        r = s.get(f"{API}/categories/dining")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "dining"
        assert d["name"] == "Dining"
        sub_ids = {sc["id"] for sc in d["subcategories"]}
        expected = {"cups", "bowls", "plates", "platters", "glassware", "dinner-sets", "table-linen"}
        assert expected.issubset(sub_ids), f"missing: {expected - sub_ids}"
        assert len(d["subcategories"]) == 7

    def test_get_nonexistent(self, s):
        r = s.get(f"{API}/categories/nonexistent")
        assert r.status_code == 404


# ---------------- Collections / Gifting
class TestCollectionsGifting:
    def test_collections(self, s):
        r = s.get(f"{API}/collections")
        assert r.status_code == 200
        cols = r.json()
        assert len(cols) == 5
        ids = {c["id"] for c in cols}
        assert ids == {"modern-minimalist", "banjara", "wellness", "nautical", "jungle"}
        for c in cols:
            assert c.get("name") and c.get("tagline") and c.get("image")
        _assert_no_mongo_id(cols)

    def test_gift_persons(self, s):
        r = s.get(f"{API}/gift-persons")
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert {"women", "men", "mom"}.issubset(ids)

    def test_gift_occasions(self, s):
        r = s.get(f"{API}/gift-occasions")
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert {"birthday", "anniversary", "wedding"}.issubset(ids)


# ---------------- Editorials (public)
class TestEditorialsPublic:
    def test_list_active(self, s):
        r = s.get(f"{API}/editorials")
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 3
        # Sorted by order asc
        orders = [it["order"] for it in items]
        assert orders == sorted(orders)
        titles = {it["title"] for it in items}
        assert titles == {"Free From Boring Dinners", "Free From A Messy Kitchen", "The Quiet Home"}
        for it in items:
            assert it["active"] is True
            assert isinstance(it["tiles"], list) and len(it["tiles"]) >= 1
        _assert_no_mongo_id(items)


# ---------------- Products
class TestProducts:
    def test_list_products(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        # Seed contains ~40 products (actually 41 in current seed)
        assert len(products) >= 35, f"Expected ~40 seeded products, got {len(products)}"
        _assert_no_mongo_id(products)
        # verify new fields present on at least some products
        sample = products[0]
        for key in ("subcategory", "collection", "gift_persons", "gift_occasions"):
            assert key in sample, f"missing {key} in product"

    def test_filter_by_category_dining(self, s):
        r = s.get(f"{API}/products", params={"category": "dining"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p["category"] == "dining"

    def test_filter_subcategory_cups(self, s):
        r = s.get(f"{API}/products", params={"subcategory": "cups"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p["subcategory"] == "cups"

    def test_filter_collection_modern_minimalist(self, s):
        r = s.get(f"{API}/products", params={"collection": "modern-minimalist"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p["collection"] == "modern-minimalist"

    def test_filter_gift_person_women(self, s):
        r = s.get(f"{API}/products", params={"gift_person": "women"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert "women" in p["gift_persons"]

    def test_filter_gift_occasion_anniversary(self, s):
        r = s.get(f"{API}/products", params={"gift_occasion": "anniversary"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert "anniversary" in p["gift_occasions"]

    def test_filter_featured(self, s):
        r = s.get(f"{API}/products", params={"featured": "true"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for p in items:
            assert p["featured"] is True

    def test_get_single_product_has_new_fields(self, s):
        products = s.get(f"{API}/products").json()
        pid = products[0]["id"]
        r = s.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        p = r.json()
        # New schema fields
        for key in ("subcategory", "collection", "gift_persons", "gift_occasions"):
            assert key in p
        # original_price is nullable but must be present
        assert "original_price" in p
        _assert_no_mongo_id(p)

    def test_get_product_404(self, s):
        r = s.get(f"{API}/products/does-not-exist-xyz")
        assert r.status_code == 404


# ---------------- Auth
class TestAuth:
    def test_signup_and_me(self, s, user_token, user_creds):
        assert user_token
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


# ---------------- Admin RBAC + product CRUD (with new fields)
class TestAdminCRUD:
    def test_create_requires_admin(self, s, user_token):
        payload = {"name": "TEST_Item", "category": "decor", "price": 100.0}
        r = s.post(f"{API}/products", json=payload, headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_full_crud_new_fields(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "name": "TEST_Admin_Product",
            "category": "dining",
            "subcategory": "cups",
            "price": 999.0,
            "original_price": 1299.0,
            "description": "temp",
            "images": ["https://example.com/x.jpg"],
            "featured": False,
            "collection": "modern-minimalist",
            "gift_persons": ["women", "friend"],
            "gift_occasions": ["birthday"],
        }
        # Create
        r = s.post(f"{API}/products", json=payload, headers=h)
        assert r.status_code == 200, r.text
        created = r.json()
        pid = created["id"]
        assert created["subcategory"] == "cups"
        assert created["collection"] == "modern-minimalist"
        assert created["original_price"] == 1299.0
        assert created["gift_persons"] == ["women", "friend"]
        assert created["gift_occasions"] == ["birthday"]
        _assert_no_mongo_id(created)

        # GET verify persistence
        r2 = s.get(f"{API}/products/{pid}")
        assert r2.status_code == 200
        got = r2.json()
        assert got["subcategory"] == "cups"
        assert got["collection"] == "modern-minimalist"
        assert got["original_price"] == 1299.0

        # Update — change subcategory, collection, gifting, drop original_price
        updated_payload = {
            **payload,
            "name": "TEST_Admin_Updated",
            "subcategory": "bowls",
            "collection": "wellness",
            "gift_persons": ["mom"],
            "gift_occasions": ["anniversary", "wedding"],
            "original_price": None,
            "price": 1234.0,
        }
        r3 = s.put(f"{API}/products/{pid}", json=updated_payload, headers=h)
        assert r3.status_code == 200
        updated = r3.json()
        assert updated["name"] == "TEST_Admin_Updated"
        assert updated["subcategory"] == "bowls"
        assert updated["collection"] == "wellness"
        assert updated["gift_persons"] == ["mom"]
        assert updated["gift_occasions"] == ["anniversary", "wedding"]
        assert updated["original_price"] is None

        # GET verify update
        r4 = s.get(f"{API}/products/{pid}")
        assert r4.json()["price"] == 1234.0
        assert r4.json()["subcategory"] == "bowls"

        # Delete
        r5 = s.delete(f"{API}/products/{pid}", headers=h)
        assert r5.status_code == 200

        # Verify deletion => 404
        r6 = s.get(f"{API}/products/{pid}")
        assert r6.status_code == 404


# ---------------- Admin Editorials
class TestAdminEditorials:
    def test_admin_list_editorials(self, s, admin_token):
        r = s.get(f"{API}/admin/editorials", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 3
        _assert_no_mongo_id(items)

    def test_admin_editorials_forbidden_for_user(self, s, user_token):
        r = s.get(f"{API}/admin/editorials", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_update_editorial(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        items = s.get(f"{API}/admin/editorials", headers=h).json()
        target = next(it for it in items if it["id"] == "quiet-home")
        payload = {
            "title": "The Quiet Home",
            "subtitle": "TEST subtitle",
            "tiles": [
                {"label": "Candles", "image": "https://example.com/c.jpg", "filter": {"subcategory": "candles"}},
                {"label": "Vases", "image": "https://example.com/v.jpg", "filter": {"subcategory": "vases"}},
            ],
            "order": 3,
            "active": True,
        }
        r = s.put(f"{API}/admin/editorials/{target['id']}", json=payload, headers=h)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["subtitle"] == "TEST subtitle"
        assert len(updated["tiles"]) == 2

        # verify via public GET
        pub = s.get(f"{API}/editorials").json()
        got = next(it for it in pub if it["id"] == "quiet-home")
        assert got["subtitle"] == "TEST subtitle"

        # Restore original
        restore = {
            "title": "The Quiet Home",
            "subtitle": "Soft textures, softer light",
            "tiles": [
                {"label": "Candles", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8", "filter": {"subcategory": "candles"}},
                {"label": "Vases", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg", "filter": {"subcategory": "vases"}},
                {"label": "Cushions", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80", "filter": {"subcategory": "cushions"}},
                {"label": "Throws", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80", "filter": {"subcategory": "throws"}},
            ],
            "order": 3,
            "active": True,
        }
        s.put(f"{API}/admin/editorials/{target['id']}", json=restore, headers=h)

    def test_admin_update_editorial_404(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        payload = {"title": "x", "subtitle": "y", "tiles": [], "order": 99, "active": True}
        r = s.put(f"{API}/admin/editorials/does-not-exist", json=payload, headers=h)
        assert r.status_code == 404


# ---------------- Wishlist
class TestWishlist:
    def test_toggle_and_get(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        pid = s.get(f"{API}/products").json()[0]["id"]

        r = s.post(f"{API}/wishlist/toggle", json={"product_id": pid}, headers=h)
        assert r.status_code == 200
        assert r.json()["in_wishlist"] is True

        r2 = s.get(f"{API}/wishlist", headers=h)
        assert r2.status_code == 200
        items = r2.json()
        assert any(p["id"] == pid for p in items)
        _assert_no_mongo_id(items)

        r3 = s.post(f"{API}/wishlist/toggle", json={"product_id": pid}, headers=h)
        assert r3.json()["in_wishlist"] is False

        r4 = s.get(f"{API}/wishlist", headers=h)
        assert all(p["id"] != pid for p in r4.json())


# ---------------- Orders + Mock Payment + Admin
class TestOrdersAndPayment:
    def test_full_order_flow(self, s, user_token, admin_token):
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
        assert data["order"]["status"] == "created"
        _assert_no_mongo_id(data)
        order_id = data["order"]["id"]

        r2 = s.get(f"{API}/orders", headers=h)
        assert r2.status_code == 200
        assert any(o["id"] == order_id for o in r2.json())

        r3 = s.get(f"{API}/orders/{order_id}", headers=h)
        assert r3.status_code == 200
        assert r3.json()["id"] == order_id

        # Mock pay
        r5 = s.post(f"{API}/orders/{order_id}/mock-pay", headers=h)
        assert r5.status_code == 200
        assert r5.json()["status"] == "paid"

        r6 = s.get(f"{API}/orders/{order_id}", headers=h)
        assert r6.json()["status"] == "paid"
        assert r6.json().get("payment_id", "").startswith("mock_")

        # Admin list orders
        ah = {"Authorization": f"Bearer {admin_token}"}
        ra = s.get(f"{API}/admin/orders", headers=ah)
        assert ra.status_code == 200
        assert any(o["id"] == order_id for o in ra.json())
        _assert_no_mongo_id(ra.json())

        # Admin update status
        rs = s.put(f"{API}/admin/orders/{order_id}/status", json={"status": "shipped"}, headers=ah)
        assert rs.status_code == 200
        assert rs.json()["status"] == "shipped"

        # Invalid status
        ri = s.put(f"{API}/admin/orders/{order_id}/status", json={"status": "invalid"}, headers=ah)
        assert ri.status_code == 400

    def test_orders_require_auth(self, s):
        r = s.get(f"{API}/orders")
        assert r.status_code == 401
