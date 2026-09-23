"""
Admin Panel Phase 2 backend tests
- Inventory stock write
- Customers list + detail
- Reviews list + delete
- Auth guards
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pastel-nest-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def a_product_id(admin_headers):
    r = requests.get(f"{API}/products", timeout=30)
    assert r.status_code == 200
    products = r.json()
    assert isinstance(products, list) and len(products) > 0, "Need at least one product to test stock"
    return products[0]["id"]


# ---------------- Inventory ----------------
class TestInventoryStock:
    def test_patch_stock_success(self, admin_headers, a_product_id):
        r = requests.patch(f"{API}/admin/products/{a_product_id}/stock", headers=admin_headers, json={"stock": 42}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("stock") == 42
        assert data.get("id") == a_product_id
        # verify GET
        g = requests.get(f"{API}/products/{a_product_id}", timeout=30)
        assert g.status_code == 200
        assert g.json().get("stock") == 42

    def test_patch_stock_negative_400(self, admin_headers, a_product_id):
        r = requests.patch(f"{API}/admin/products/{a_product_id}/stock", headers=admin_headers, json={"stock": -1}, timeout=30)
        assert r.status_code == 400
        assert "negative" in r.text.lower()

    def test_patch_stock_missing_product_404(self, admin_headers):
        r = requests.patch(f"{API}/admin/products/does-not-exist-xyz/stock", headers=admin_headers, json={"stock": 5}, timeout=30)
        assert r.status_code == 404

    def test_patch_stock_no_auth(self, a_product_id):
        r = requests.patch(f"{API}/admin/products/{a_product_id}/stock", json={"stock": 10}, timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ---------------- Customers ----------------
class TestCustomers:
    def test_list_customers(self, admin_headers):
        r = requests.get(f"{API}/admin/customers", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # If any customers exist, verify shape
        for c in data:
            assert "id" in c
            assert "orders_count" in c and isinstance(c["orders_count"], int)
            assert "total_spent" in c and isinstance(c["total_spent"], (int, float))
            # password_hash MUST NOT leak
            assert "password_hash" not in c
            assert "_id" not in c

    def test_customer_detail(self, admin_headers):
        listing = requests.get(f"{API}/admin/customers", headers=admin_headers, timeout=30).json()
        if not listing:
            pytest.skip("No customers in DB")
        cid = listing[0]["id"]
        r = requests.get(f"{API}/admin/customers/{cid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "user" in d and d["user"].get("id") == cid
        assert "orders" in d and isinstance(d["orders"], list)
        assert "orders_count" in d
        assert "total_spent" in d
        assert "points_balance" in d
        assert "password_hash" not in d["user"]

    def test_customer_detail_404(self, admin_headers):
        r = requests.get(f"{API}/admin/customers/no-such-user", headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_customers_no_auth(self):
        r = requests.get(f"{API}/admin/customers", timeout=30)
        assert r.status_code in (401, 403)


# ---------------- Reviews ----------------
class TestReviews:
    def test_list_reviews(self, admin_headers):
        r = requests.get(f"{API}/admin/reviews", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for rev in data:
            # hydrated fields when a product exists
            assert "id" in rev
            assert "_id" not in rev

    def test_delete_review_missing_404(self, admin_headers):
        r = requests.delete(f"{API}/admin/reviews/does-not-exist", headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_reviews_no_auth(self):
        r = requests.get(f"{API}/admin/reviews", timeout=30)
        assert r.status_code in (401, 403)


# ---------------- Coupons (used by promotions UI) ----------------
class TestCoupons:
    CODE = "TESTPHASE2"

    def test_create_list_delete_coupon(self, admin_headers):
        # cleanup first
        requests.delete(f"{API}/admin/coupons/{self.CODE}", headers=admin_headers, timeout=30)
        payload = {
            "code": self.CODE,
            "kind": "percent",
            "value": 10,
            "min_order": 500,
            "max_discount": 200,
            "active": True,
            "expires_at": "",
        }
        c = requests.post(f"{API}/admin/coupons", headers=admin_headers, json=payload, timeout=30)
        assert c.status_code == 200, c.text
        # list
        lst = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30)
        assert lst.status_code == 200
        codes = [x.get("code") for x in lst.json()]
        assert self.CODE in codes
        # delete
        d = requests.delete(f"{API}/admin/coupons/{self.CODE}", headers=admin_headers, timeout=30)
        assert d.status_code == 200
        # verify gone
        lst2 = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30).json()
        assert self.CODE not in [x.get("code") for x in lst2]

    def test_coupons_no_auth(self):
        r = requests.get(f"{API}/admin/coupons", timeout=30)
        assert r.status_code in (401, 403)
