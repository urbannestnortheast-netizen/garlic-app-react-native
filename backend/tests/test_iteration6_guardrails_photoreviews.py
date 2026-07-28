"""
Iteration 6 backend tests — Guard rails + Nest Notes (photo reviews)
- Order status transition validation (STATUS_TRANSITIONS)
- Refund scope: only when cancelling from created|paid
- Photo review upload (max 3), first-time-with-photos awards 100 pts
- Seed skip on restart (settings.seeded present)
- admin_edited=True flag on POST/PUT /products
"""
import os
import uuid
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # Fall back to /app/frontend/.env
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not set")


BASE = _load_backend_url()

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


def _no_id(obj):
    """Recursive: ensure no '_id' key anywhere."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked: {list(obj.keys())}"
        for v in obj.values():
            _no_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_id(v)


# ---------- Fixtures
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE}/api/auth/login",
               json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _new_user(s, prefix="TEST_it6"):
    hx = uuid.uuid4().hex[:10]
    email = f"{prefix}_{hx}@garlicnest.com"
    mobile = "7" + "".join(c for c in hx if c.isdigit()).ljust(9, "0")[:9]
    r = s.post(f"{BASE}/api/auth/signup", json={
        "name": f"Nest {hx}", "email": email, "mobile": mobile, "password": "Passw0rd!",
    })
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    uid = r.json()["user"]["id"]
    return {"email": email.lower(), "mobile": mobile, "token": tok, "id": uid,
            "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def user_a(s):
    return _new_user(s, "TEST_it6a")


@pytest.fixture(scope="module")
def user_b(s):
    return _new_user(s, "TEST_it6b")


@pytest.fixture(scope="module")
def a_product(s):
    r = s.get(f"{BASE}/api/products")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    return items[0]


def _create_order(s, user, product, qty=1, points_to_redeem=0):
    payload = {
        "items": [{"product_id": product["id"], "quantity": qty}],
        "shipping_address": "1 Test Ln",
        "shipping_name": "Nest",
        "shipping_phone": "9000000000",
        "points_to_redeem": points_to_redeem,
    }
    r = s.post(f"{BASE}/api/orders/create", headers=user["h"], json=payload)
    assert r.status_code == 200, r.text
    return r.json()["order"]


def _set_status(s, admin_h, order_id, status):
    return s.put(f"{BASE}/api/admin/orders/{order_id}/status",
                 headers=admin_h, json={"status": status})


def _award_points_via_paid_order(s, user, product):
    """Get some points onto the user's wallet so they can redeem."""
    o = _create_order(s, user, product, qty=5)  # decent amount
    r = s.post(f"{BASE}/api/orders/{o['id']}/mock-pay", headers=user["h"])
    assert r.status_code == 200, r.text
    return r.json().get("points_earned", 0)


def _get_balance(s, user):
    r = s.get(f"{BASE}/api/points", headers=user["h"])
    assert r.status_code == 200
    return r.json()


# ---------- REGRESSION baseline
class TestRegression:
    def test_root(self, s):
        r = s.get(f"{BASE}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_public_endpoints(self, s):
        for path in ("/api/categories", "/api/collections", "/api/products",
                     "/api/editorials"):
            r = s.get(f"{BASE}{path}")
            assert r.status_code == 200, path
            _no_id(r.json())

    def test_auth_me(self, s, user_a):
        r = s.get(f"{BASE}/api/auth/me", headers=user_a["h"])
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"]
        _no_id(r.json())

    def test_wishlist_toggle(self, s, user_a, a_product):
        r1 = s.post(f"{BASE}/api/wishlist/toggle", headers=user_a["h"],
                    json={"product_id": a_product["id"]})
        assert r1.status_code == 200
        r2 = s.post(f"{BASE}/api/wishlist/toggle", headers=user_a["h"],
                    json={"product_id": a_product["id"]})
        assert r2.status_code == 200
        assert r1.json()["in_wishlist"] != r2.json()["in_wishlist"]

    def test_orders_list(self, s, user_a):
        r = s.get(f"{BASE}/api/orders", headers=user_a["h"])
        assert r.status_code == 200
        _no_id(r.json())

    def test_interactions_and_recos(self, s, user_a, a_product):
        r = s.post(f"{BASE}/api/interactions", headers=user_a["h"],
                   json={"product_id": a_product["id"], "event": "view"})
        assert r.status_code == 200
        r = s.get(f"{BASE}/api/recommendations?limit=4", headers=user_a["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        _no_id(r.json())


# ---------- Order status transitions
class TestStatusTransitions:
    def test_paid_to_created_forbidden(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        assert _set_status(s, admin_h, o["id"], "paid").status_code == 200
        r = _set_status(s, admin_h, o["id"], "created")
        assert r.status_code == 400, r.text
        assert "invalid transition" in r.text.lower()

    def test_full_sequence_created_paid_shipped_delivered(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        for st in ("paid", "shipped", "delivered"):
            r = _set_status(s, admin_h, o["id"], st)
            assert r.status_code == 200, f"{st}: {r.text}"
            assert r.json()["status"] == st
        _no_id(r.json())

    def test_delivered_terminal(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        for st in ("paid", "shipped", "delivered"):
            assert _set_status(s, admin_h, o["id"], st).status_code == 200
        for st in ("cancelled", "shipped", "paid", "created"):
            r = _set_status(s, admin_h, o["id"], st)
            assert r.status_code == 400, f"{st} should be rejected (delivered terminal)"

    def test_same_status_noop_success(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        assert _set_status(s, admin_h, o["id"], "paid").status_code == 200
        r = _set_status(s, admin_h, o["id"], "paid")
        assert r.status_code == 200, r.text
        # history should have appended entry
        history = r.json().get("history", [])
        paid_entries = [h for h in history if h.get("status") == "paid"]
        assert len(paid_entries) >= 2, f"Expected >=2 paid history entries, got {len(paid_entries)}"

    def test_cancel_from_created(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "cancelled"

    def test_cancel_from_paid(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        assert _set_status(s, admin_h, o["id"], "paid").status_code == 200
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 200, r.text

    def test_cancel_from_shipped_allowed(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        for st in ("paid", "shipped"):
            assert _set_status(s, admin_h, o["id"], st).status_code == 200
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 200, r.text

    def test_cancel_from_delivered_rejected(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        for st in ("paid", "shipped", "delivered"):
            assert _set_status(s, admin_h, o["id"], st).status_code == 200
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 400, r.text


# ---------- Refund Scope
class TestRefundScope:
    def _has_refund_tx(self, points_doc, order_id):
        return any(
            tx.get("type") == "earn"
            and tx.get("reason") == "order_refund"
            and (tx.get("meta") or {}).get("order_id") == order_id
            for tx in points_doc.get("transactions", [])
        )

    def _count_refund_tx(self, points_doc, order_id):
        return sum(
            1 for tx in points_doc.get("transactions", [])
            if tx.get("type") == "earn"
            and tx.get("reason") == "order_refund"
            and (tx.get("meta") or {}).get("order_id") == order_id
        )

    def test_refund_when_cancelling_from_created(self, s, admin_h, user_b, a_product):
        _award_points_via_paid_order(s, user_b, a_product)
        bal0 = _get_balance(s, user_b)["balance"]
        assert bal0 > 0
        redeem = min(bal0, 10)
        o = _create_order(s, user_b, a_product, points_to_redeem=redeem)
        assert o["points_redeemed"] > 0
        used = o["points_redeemed"]
        # From 'created' → cancelled
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 200
        pd = _get_balance(s, user_b)
        assert self._has_refund_tx(pd, o["id"]), "expected order_refund tx"
        # balance restored (net zero change vs pre-redemption)
        assert pd["balance"] == bal0, f"expected {bal0}, got {pd['balance']}"

    def test_refund_when_cancelling_from_paid(self, s, admin_h, user_b, a_product):
        _award_points_via_paid_order(s, user_b, a_product)
        bal0 = _get_balance(s, user_b)["balance"]
        redeem = min(bal0, 10)
        assert redeem > 0
        o = _create_order(s, user_b, a_product, points_to_redeem=redeem)
        used = o["points_redeemed"]
        assert _set_status(s, admin_h, o["id"], "paid").status_code == 200
        # mock-pay awards points on 'amount' but we already used admin status → skip mock-pay
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 200
        pd = _get_balance(s, user_b)
        assert self._has_refund_tx(pd, o["id"])

    def test_no_refund_when_cancelling_from_shipped(self, s, admin_h, user_b, a_product):
        _award_points_via_paid_order(s, user_b, a_product)
        bal0 = _get_balance(s, user_b)["balance"]
        redeem = min(bal0, 10)
        assert redeem > 0
        o = _create_order(s, user_b, a_product, points_to_redeem=redeem)
        assert o["points_redeemed"] > 0
        for st in ("paid", "shipped"):
            assert _set_status(s, admin_h, o["id"], st).status_code == 200
        # Cancel from shipped → allowed but NO refund
        r = _set_status(s, admin_h, o["id"], "cancelled")
        assert r.status_code == 200
        pd = _get_balance(s, user_b)
        assert not self._has_refund_tx(pd, o["id"]), \
            "no refund expected when cancelling from shipped"

    def test_repeated_cancel_no_double_refund(self, s, admin_h, user_b, a_product):
        _award_points_via_paid_order(s, user_b, a_product)
        bal0 = _get_balance(s, user_b)["balance"]
        redeem = min(bal0, 10)
        o = _create_order(s, user_b, a_product, points_to_redeem=redeem)
        assert _set_status(s, admin_h, o["id"], "cancelled").status_code == 200
        pd1 = _get_balance(s, user_b)
        c1 = self._count_refund_tx(pd1, o["id"])
        assert c1 == 1
        # Second cancel is a no-op (same status)
        r2 = _set_status(s, admin_h, o["id"], "cancelled")
        assert r2.status_code == 200
        pd2 = _get_balance(s, user_b)
        c2 = self._count_refund_tx(pd2, o["id"])
        assert c2 == 1, f"double refund detected: {c2} refund tx"


# ---------- Photo Reviews
_PHOTO = "data:image/jpeg;base64,/9j/AAA"


class TestPhotoReviews:
    def test_review_with_photos_stored_and_returned(self, s, a_product):
        u = _new_user(s, "TEST_it6_rev1")
        payload = {"rating": 5, "title": "Love it", "body": "great",
                   "photos": [_PHOTO + "1", _PHOTO + "2"]}
        r = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                   headers=u["h"], json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        _no_id(body)
        assert body["photos"] == payload["photos"]
        assert body["points_earned"] == 100
        # GET returns photos
        r2 = s.get(f"{BASE}/api/products/{a_product['id']}/reviews")
        assert r2.status_code == 200
        _no_id(r2.json())
        mine = [rv for rv in r2.json() if rv.get("user_id") == u["id"]]
        assert mine and mine[0]["photos"] == payload["photos"]

    def test_photos_truncated_to_3(self, s, a_product):
        u = _new_user(s, "TEST_it6_rev2")
        photos = [_PHOTO + str(i) for i in range(5)]
        r = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                   headers=u["h"], json={"rating": 4, "photos": photos})
        assert r.status_code == 200
        assert len(r.json()["photos"]) == 3
        assert r.json()["photos"] == photos[:3]

    def test_first_photo_review_awards_100(self, s, a_product):
        u = _new_user(s, "TEST_it6_rev3")
        bal0 = _get_balance(s, u)["balance"]
        r = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                   headers=u["h"], json={"rating": 5, "photos": [_PHOTO]})
        assert r.status_code == 200
        assert r.json()["points_earned"] == 100
        pts = _get_balance(s, u)
        assert pts["balance"] == bal0 + 100
        assert any(tx["reason"] == "photo_review_bonus" and tx["amount"] == 100
                   for tx in pts["transactions"])

    def test_second_photo_review_same_user_no_reaward(self, s, a_product):
        u = _new_user(s, "TEST_it6_rev4")
        r1 = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                    headers=u["h"], json={"rating": 5, "photos": [_PHOTO]})
        assert r1.status_code == 200
        assert r1.json()["points_earned"] == 100
        bal_after_first = _get_balance(s, u)["balance"]
        r2 = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                    headers=u["h"], json={"rating": 4, "photos": [_PHOTO, _PHOTO]})
        assert r2.status_code == 200
        assert r2.json()["points_earned"] == 0, "should not re-award"
        assert _get_balance(s, u)["balance"] == bal_after_first

    def test_review_without_photos_no_bonus(self, s, a_product):
        u = _new_user(s, "TEST_it6_rev5")
        bal0 = _get_balance(s, u)["balance"]
        r = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                   headers=u["h"], json={"rating": 4, "photos": []})
        assert r.status_code == 200
        assert r.json()["points_earned"] == 0
        assert _get_balance(s, u)["balance"] == bal0

    def test_later_adding_photos_awards_bonus(self, s, a_product):
        u = _new_user(s, "TEST_it6_rev6")
        bal0 = _get_balance(s, u)["balance"]
        # First: no photos
        r1 = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                    headers=u["h"], json={"rating": 3, "photos": []})
        assert r1.status_code == 200 and r1.json()["points_earned"] == 0
        # Then: add photos → first-time photo review → +100
        r2 = s.post(f"{BASE}/api/products/{a_product['id']}/reviews",
                    headers=u["h"], json={"rating": 5, "photos": [_PHOTO]})
        assert r2.status_code == 200
        assert r2.json()["points_earned"] == 100
        assert _get_balance(s, u)["balance"] == bal0 + 100


# ---------- Seed skip + admin_edited flag
class TestSeedAndAdminEdit:
    def test_products_and_seeded_marker(self, s):
        r = s.get(f"{BASE}/api/products")
        assert r.status_code == 200
        products = r.json()
        assert len(products) >= 41, f"expected 41+ products, got {len(products)}"
        _no_id(products)
        # stability check: two reads → same count
        r2 = s.get(f"{BASE}/api/products")
        assert len(r2.json()) == len(products)

    def test_post_product_sets_admin_edited(self, s, admin_h):
        payload = {
            "name": f"TEST_it6 Product {uuid.uuid4().hex[:6]}",
            "category": "decor", "subcategory": "candles", "price": 199.0,
            "description": "test", "images": [],
            "stock": 5, "featured": False,
        }
        r = s.post(f"{BASE}/api/products", headers=admin_h, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        _no_id(body)
        assert body["admin_edited"] is True
        pid = body["id"]
        # Also visible via GET /products
        listing = s.get(f"{BASE}/api/products").json()
        match = [p for p in listing if p["id"] == pid]
        assert match and match[0].get("admin_edited") is True

        # PUT: also sets admin_edited
        payload["name"] = payload["name"] + " EDITED"
        payload["price"] = 249.0
        r2 = s.put(f"{BASE}/api/products/{pid}", headers=admin_h, json=payload)
        assert r2.status_code == 200
        assert r2.json()["admin_edited"] is True

        # cleanup
        s.delete(f"{BASE}/api/products/{pid}", headers=admin_h)


# ---------- Overall no _id leak sweep
class TestNoIdLeak:
    def test_reviews_endpoint(self, s, a_product):
        r = s.get(f"{BASE}/api/products/{a_product['id']}/reviews")
        assert r.status_code == 200
        _no_id(r.json())

    def test_order_status_response(self, s, admin_h, user_a, a_product):
        o = _create_order(s, user_a, a_product)
        r = _set_status(s, admin_h, o["id"], "paid")
        assert r.status_code == 200
        _no_id(r.json())

    def test_points_transactions(self, s, user_b):
        r = s.get(f"{BASE}/api/points", headers=user_b["h"])
        assert r.status_code == 200
        _no_id(r.json())
