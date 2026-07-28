"""
Backend tests for the 'Nest Table' shortlist / gift-registry feature.
Covers: auth-gating, CRUD, item add/remove, public share (no auth, no user_id leak),
mark-bought, _id leak checks, and admin editorials PUT regression.
"""
import os
import uuid
import json
import requests
import pytest
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


# ---------- helpers
def _no_id_leak(obj):
    """Recursively assert no '_id' key exists anywhere in payload."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"Found MongoDB _id in payload: {list(obj.keys())}"
        for v in obj.values():
            _no_id_leak(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_id_leak(v)


def _signup_user(session):
    uid = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_User_{uid}",
        "email": f"test_{uid}@garlicnest.com",
        "mobile": f"9{uid[:9].ljust(9, '0')}",
        "password": "Pass@1234",
    }
    r = session.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return data["access_token"], data["user"], payload


# ---------- fixtures
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def user_a(s):
    token, user, _ = _signup_user(s)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def user_b(s):
    token, user, _ = _signup_user(s)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def admin(s):
    r = s.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"token": tok, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def sample_products(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    return items


# ============================================================
# REGRESSION - existing endpoints
# ============================================================
class TestRegression:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 6
        _no_id_leak(cats)

    def test_products(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0
        _no_id_leak(r.json())

    def test_auth_me(self, s, user_a):
        r = s.get(f"{API}/auth/me", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["id"] == user_a["user"]["id"]

    def test_wishlist_toggle(self, s, user_a, sample_products):
        pid = sample_products[0]["id"]
        r1 = s.post(f"{API}/wishlist/toggle", headers=user_a["headers"], json={"product_id": pid})
        assert r1.status_code == 200 and r1.json()["in_wishlist"] is True
        r2 = s.post(f"{API}/wishlist/toggle", headers=user_a["headers"], json={"product_id": pid})
        assert r2.status_code == 200 and r2.json()["in_wishlist"] is False

    def test_orders_create_and_mock_pay(self, s, user_a, sample_products):
        pid = sample_products[0]["id"]
        r = s.post(f"{API}/orders/create", headers=user_a["headers"], json={
            "items": [{"product_id": pid, "quantity": 1}],
            "shipping_address": "TEST 1 Addr", "shipping_name": "TEST", "shipping_phone": "9999999999",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("mock") is True  # Razorpay keys empty -> MOCKED
        order_id = body["order"]["id"]
        # list
        lst = s.get(f"{API}/orders", headers=user_a["headers"])
        assert lst.status_code == 200
        assert any(o["id"] == order_id for o in lst.json())
        # mock-pay
        mp = s.post(f"{API}/orders/{order_id}/mock-pay", headers=user_a["headers"])
        assert mp.status_code == 200 and mp.json()["status"] == "paid"


# ============================================================
# SHORTLIST - core CRUD (auth required)
# ============================================================
class TestShortlistAuth:
    def test_get_shortlists_unauth_401(self, s):
        r = s.get(f"{API}/shortlists")
        assert r.status_code == 401

    def test_create_shortlist_unauth_401(self, s):
        r = s.post(f"{API}/shortlists", json={"name": "x"})
        assert r.status_code == 401


class TestShortlistCRUD:
    def test_create_shortlist(self, s, user_a):
        payload = {"name": "TEST My Wedding", "occasion": "wedding", "message": "Please gift us :)"}
        r = s.post(f"{API}/shortlists", headers=user_a["headers"], json=payload)
        assert r.status_code == 200, r.text
        sl = r.json()
        _no_id_leak(sl)
        assert sl["name"] == payload["name"]
        assert sl["occasion"] == "wedding"
        assert sl["message"] == payload["message"]
        assert sl["items"] == []
        assert sl["bought"] == []
        assert sl["count"] == 0
        assert sl["products"] == []
        assert sl["owner_name"] == user_a["user"]["name"]
        # slug format: <slugified-name>-XXXXXX (6 hex)
        slug = sl["share_slug"]
        assert "-" in slug
        suffix = slug.rsplit("-", 1)[1]
        assert len(suffix) == 6 and all(c in "0123456789abcdef" for c in suffix)
        user_a["shortlist"] = sl

    def test_list_shortlists_is_user_scoped(self, s, user_a, user_b):
        # user_a should see the one just created
        r = s.get(f"{API}/shortlists", headers=user_a["headers"])
        assert r.status_code == 200
        ids_a = [x["id"] for x in r.json()]
        assert user_a["shortlist"]["id"] in ids_a
        # user_b should NOT see it
        r = s.get(f"{API}/shortlists", headers=user_b["headers"])
        assert r.status_code == 200
        ids_b = [x["id"] for x in r.json()]
        assert user_a["shortlist"]["id"] not in ids_b

    def test_get_shortlist_own(self, s, user_a):
        sid = user_a["shortlist"]["id"]
        r = s.get(f"{API}/shortlists/{sid}", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["id"] == sid

    def test_get_shortlist_other_user_404(self, s, user_a, user_b):
        sid = user_a["shortlist"]["id"]
        r = s.get(f"{API}/shortlists/{sid}", headers=user_b["headers"])
        assert r.status_code == 404

    def test_get_shortlist_nonexistent_404(self, s, user_a):
        r = s.get(f"{API}/shortlists/does-not-exist", headers=user_a["headers"])
        assert r.status_code == 404

    def test_update_shortlist(self, s, user_a):
        sid = user_a["shortlist"]["id"]
        r = s.put(f"{API}/shortlists/{sid}", headers=user_a["headers"], json={
            "name": "TEST My Wedding Updated",
            "occasion": "anniversary",
            "message": "Updated msg",
            "cover_image": "https://example.com/cover.jpg",
        })
        assert r.status_code == 200
        sl = r.json()
        assert sl["name"] == "TEST My Wedding Updated"
        assert sl["occasion"] == "anniversary"
        assert sl["cover_image"] == "https://example.com/cover.jpg"

    def test_update_shortlist_other_user_404(self, s, user_a, user_b):
        sid = user_a["shortlist"]["id"]
        r = s.put(f"{API}/shortlists/{sid}", headers=user_b["headers"], json={"name": "hijack"})
        assert r.status_code == 404


# ============================================================
# SHORTLIST - items add/remove
# ============================================================
class TestShortlistItems:
    def test_add_item(self, s, user_a, sample_products):
        sid = user_a["shortlist"]["id"]
        pid = sample_products[0]["id"]
        r = s.post(f"{API}/shortlists/{sid}/items", headers=user_a["headers"], json={"product_id": pid})
        assert r.status_code == 200, r.text
        sl = r.json()
        _no_id_leak(sl)
        assert pid in sl["items"]
        assert sl["count"] == 1
        assert any(p["id"] == pid for p in sl["products"])
        assert all("bought" in p for p in sl["products"])
        user_a["_pid"] = pid

    def test_add_item_idempotent(self, s, user_a):
        sid = user_a["shortlist"]["id"]
        pid = user_a["_pid"]
        r = s.post(f"{API}/shortlists/{sid}/items", headers=user_a["headers"], json={"product_id": pid})
        assert r.status_code == 200
        sl = r.json()
        # Only one entry despite duplicate add
        assert sl["items"].count(pid) == 1
        assert sl["count"] == 1

    def test_add_item_unknown_product_400(self, s, user_a):
        sid = user_a["shortlist"]["id"]
        r = s.post(f"{API}/shortlists/{sid}/items", headers=user_a["headers"], json={"product_id": "nope-fake"})
        assert r.status_code == 400

    def test_add_second_item(self, s, user_a, sample_products):
        sid = user_a["shortlist"]["id"]
        pid2 = sample_products[1]["id"]
        r = s.post(f"{API}/shortlists/{sid}/items", headers=user_a["headers"], json={"product_id": pid2})
        assert r.status_code == 200
        assert r.json()["count"] == 2
        user_a["_pid2"] = pid2


# ============================================================
# SHORTLIST - PUBLIC share endpoints (no auth)
# ============================================================
class TestShortlistPublic:
    def test_public_share_no_auth_no_user_id_leak(self, s, user_a):
        slug = user_a["shortlist"]["share_slug"]
        # NO auth header
        r = requests.get(f"{API}/shortlists/share/{slug}")
        assert r.status_code == 200
        sl = r.json()
        _no_id_leak(sl)
        assert "user_id" not in sl, "PUBLIC endpoint leaked user_id!"
        # Must contain owner_name + occasion + products + count (see review request)
        assert "owner_name" in sl and sl["owner_name"]
        assert "occasion" in sl
        assert "products" in sl and isinstance(sl["products"], list)
        assert "count" in sl and sl["count"] >= 1

    def test_public_share_nonexistent_404(self, s):
        r = requests.get(f"{API}/shortlists/share/definitely-not-a-real-slug-xyz")
        assert r.status_code == 404

    def test_public_mark_bought_success_no_auth(self, s, user_a):
        slug = user_a["shortlist"]["share_slug"]
        pid = user_a["_pid"]
        r = requests.post(f"{API}/shortlists/share/{slug}/mark-bought", json={"product_id": pid})
        assert r.status_code == 200, r.text
        sl = r.json()
        _no_id_leak(sl)
        assert "user_id" not in sl
        product = next(p for p in sl["products"] if p["id"] == pid)
        assert product["bought"] is True

    def test_public_share_reflects_bought_state(self, s, user_a):
        slug = user_a["shortlist"]["share_slug"]
        pid = user_a["_pid"]
        r = requests.get(f"{API}/shortlists/share/{slug}")
        assert r.status_code == 200
        product = next(p for p in r.json()["products"] if p["id"] == pid)
        assert product["bought"] is True

    def test_public_mark_bought_not_in_items_400(self, s, user_a, sample_products):
        slug = user_a["shortlist"]["share_slug"]
        # pick a product NOT already added
        added = {user_a["_pid"], user_a["_pid2"]}
        outside = next(p["id"] for p in sample_products if p["id"] not in added)
        r = requests.post(f"{API}/shortlists/share/{slug}/mark-bought", json={"product_id": outside})
        assert r.status_code == 400

    def test_public_mark_bought_bad_slug_404(self, s, sample_products):
        r = requests.post(f"{API}/shortlists/share/no-such-slug-abc/mark-bought",
                          json={"product_id": sample_products[0]["id"]})
        assert r.status_code == 404


# ============================================================
# SHORTLIST - delete flows
# ============================================================
class TestShortlistDelete:
    def test_remove_item_also_removes_from_bought(self, s, user_a):
        sid = user_a["shortlist"]["id"]
        pid = user_a["_pid"]  # this one was marked bought
        r = s.delete(f"{API}/shortlists/{sid}/items/{pid}", headers=user_a["headers"])
        assert r.status_code == 200
        sl = r.json()
        assert pid not in sl["items"]
        # verify persisted via GET
        get_r = s.get(f"{API}/shortlists/{sid}", headers=user_a["headers"])
        assert pid not in get_r.json()["items"]
        # also verify bought[] was pulled by inspecting raw shortlist via public share
        slug = user_a["shortlist"]["share_slug"]
        pub = requests.get(f"{API}/shortlists/share/{slug}").json()
        # product no longer in products list
        assert not any(p["id"] == pid for p in pub["products"])

    def test_delete_shortlist_other_user_404(self, s, user_a, user_b):
        sid = user_a["shortlist"]["id"]
        r = s.delete(f"{API}/shortlists/{sid}", headers=user_b["headers"])
        assert r.status_code == 404

    def test_delete_shortlist_own(self, s, user_a):
        sid = user_a["shortlist"]["id"]
        r = s.delete(f"{API}/shortlists/{sid}", headers=user_a["headers"])
        assert r.status_code == 200
        # verify gone
        r2 = s.get(f"{API}/shortlists/{sid}", headers=user_a["headers"])
        assert r2.status_code == 404


# ============================================================
# EDITORIALS REGRESSION - admin PUT
# ============================================================
class TestEditorialsAdminPut:
    def test_admin_update_editorial(self, s, admin):
        # fetch existing
        r = s.get(f"{API}/admin/editorials", headers=admin["headers"])
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        original = items[0]
        eid = original["id"]
        # update
        payload = {
            "title": "TEST Updated Title",
            "subtitle": "TEST Subtitle",
            "tiles": original["tiles"],
            "order": 99,
            "active": False,
        }
        r = s.put(f"{API}/admin/editorials/{eid}", headers=admin["headers"], json=payload)
        assert r.status_code == 200, r.text
        upd = r.json()
        _no_id_leak(upd)
        assert upd["title"] == "TEST Updated Title"
        assert upd["subtitle"] == "TEST Subtitle"
        assert upd["order"] == 99
        assert upd["active"] is False
        # restore original
        restore = {
            "title": original["title"], "subtitle": original.get("subtitle", ""),
            "tiles": original["tiles"], "order": original["order"], "active": original["active"],
        }
        r2 = s.put(f"{API}/admin/editorials/{eid}", headers=admin["headers"], json=restore)
        assert r2.status_code == 200

    def test_admin_update_editorial_404(self, s, admin):
        r = s.put(f"{API}/admin/editorials/does-not-exist",
                  headers=admin["headers"],
                  json={"title": "x", "tiles": [], "order": 0, "active": True})
        assert r.status_code == 404
