"""
Iteration 5 backend tests — Garlic by Urban Nest
Covers:
 - REGRESSION (root, categories, products, collections, editorials, signup/login/me,
   wishlist toggle, orders create/list, mock-pay)
 - SEARCH ReDoS hardening (re.escape on ?q=)
 - PRODUCT LIST includes average_rating + review_count via aggregation
 - REFUND ON CANCEL (points restored + tx with reason='order_refund', idempotent)
 - INTERACTIONS (auth, event validation, unknown product, weights)
 - RECOMMENDATIONS (auth, cold-start, personalized excludes seen, limit, no _id leak)
 - _id / _reviews never leak
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path

# Load EXPO_PUBLIC_BACKEND_URL from frontend/.env (external ingress URL)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
except Exception:
    pass

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or ""
).rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


def _has_underscore_id(obj) -> bool:
    """Recursively check for '_id' or '_reviews' anywhere."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("_id", "_reviews"):
                return True
            if _has_underscore_id(v):
                return True
    elif isinstance(obj, list):
        return any(_has_underscore_id(x) for x in obj)
    return False


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _new_user(http):
    suffix = uuid.uuid4().hex[:10]
    email = f"TEST_it5_{suffix}@garlicnest.com"
    mobile = "9" + suffix[:9].replace("a", "1").replace("b", "2").replace("c", "3").replace("d", "4").replace("e", "5").replace("f", "6")
    # normalize digits
    mobile = "9" + "".join(c if c.isdigit() else str(int(c, 16) % 10) for c in suffix)[:9]
    r = http.post(f"{API}/auth/signup", json={
        "name": "TEST it5", "email": email, "mobile": mobile, "password": "Password@123"
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="session")
def user_ctx(http):
    tok, u = _new_user(http)
    return {"token": tok, "user": u, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def products_list(http):
    r = http.get(f"{API}/products")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    return items


# ---------------- REGRESSION ----------------
class TestRegression:
    def test_root(self, http):
        r = http.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_categories(self, http):
        r = http.get(f"{API}/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 6
        assert not _has_underscore_id(data)

    def test_collections(self, http):
        r = http.get(f"{API}/collections")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_editorials(self, http):
        r = http.get(f"{API}/editorials")
        assert r.status_code == 200
        assert not _has_underscore_id(r.json())

    def test_me(self, http, user_ctx):
        r = http.get(f"{API}/auth/me", headers=user_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["email"] == user_ctx["user"]["email"]

    def test_wishlist_toggle(self, http, user_ctx, products_list):
        pid = products_list[0]["id"]
        r1 = http.post(f"{API}/wishlist/toggle", headers=user_ctx["headers"], json={"product_id": pid})
        assert r1.status_code == 200
        assert r1.json()["in_wishlist"] in (True, False)
        # toggle back to clean state
        http.post(f"{API}/wishlist/toggle", headers=user_ctx["headers"], json={"product_id": pid})

    def test_order_create_and_mock_pay(self, http, user_ctx, products_list):
        pid = products_list[0]["id"]
        r = http.post(f"{API}/orders/create", headers=user_ctx["headers"], json={
            "items": [{"product_id": pid, "quantity": 1}],
            "shipping_address": "TEST 1 St", "shipping_name": "TEST", "shipping_phone": "9000000000",
        })
        assert r.status_code == 200, r.text
        order = r.json()["order"]
        assert order["status"] == "created"
        oid = order["id"]
        # list
        rl = http.get(f"{API}/orders", headers=user_ctx["headers"])
        assert rl.status_code == 200
        assert any(o["id"] == oid for o in rl.json())
        # mock-pay
        rp = http.post(f"{API}/orders/{oid}/mock-pay", headers=user_ctx["headers"])
        assert rp.status_code == 200 and rp.json()["status"] == "paid"


# ---------------- SEARCH ReDoS HARDENING ----------------
class TestSearchRedos:
    @pytest.mark.parametrize("q", ["a(b*)+", ".*(.*)", "(x+)+", "((a+)+)+", "[[[["])
    def test_regex_metachars_do_not_hang(self, http, q):
        start = time.time()
        r = http.get(f"{API}/products", params={"q": q}, timeout=8)
        elapsed = time.time() - start
        assert r.status_code == 200, r.text
        assert elapsed < 5.0, f"Search hung for {elapsed:.2f}s on q={q!r}"
        assert isinstance(r.json(), list)  # 0 or some matches, both fine

    def test_search_blush_still_matches(self, http):
        r = http.get(f"{API}/products", params={"q": "Blush"})
        assert r.status_code == 200
        names = [p["name"] for p in r.json()]
        assert any("Blush Rose Dinner Set" in n for n in names), names


# ---------------- PRODUCT LIST RATINGS ----------------
class TestProductListRatings:
    def test_every_product_has_rating_fields(self, http):
        r = http.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        for p in items:
            assert "average_rating" in p, p.get("name")
            assert "review_count" in p, p.get("name")
            assert isinstance(p["average_rating"], (int, float))
            assert isinstance(p["review_count"], int)
        # No _id or _reviews field leaked
        assert not _has_underscore_id(items), "Response contains _id or _reviews"

    def test_avg_rating_after_two_reviews(self, http, admin_token):
        # Create two fresh users, each post one review for the same product
        r = http.get(f"{API}/products")
        pid = r.json()[0]["id"]
        for rating in (4, 5):
            tok, _ = _new_user(http)
            hdr = {"Authorization": f"Bearer {tok}"}
            rr = http.post(f"{API}/products/{pid}/reviews", headers=hdr,
                           json={"rating": rating, "title": "t", "body": "b"})
            assert rr.status_code == 200, rr.text

        # Now the product list should reflect avg=4.5, count>=2
        rlist = http.get(f"{API}/products")
        assert rlist.status_code == 200
        target = next(p for p in rlist.json() if p["id"] == pid)
        assert target["review_count"] >= 2
        # Rating may be from other reviews too across test runs; assert bounded window
        # We required at least these two reviews present; check avg is within reasonable range
        assert 3.5 <= target["average_rating"] <= 5.0, target


# ---------------- REFUND ON CANCEL ----------------
class TestRefundOnCancel:
    def _seed_points(self, http, headers, product_id, qty=20):
        """Buy + mock-pay to earn points."""
        r = http.post(f"{API}/orders/create", headers=headers, json={
            "items": [{"product_id": product_id, "quantity": qty}],
            "shipping_address": "X", "shipping_name": "X", "shipping_phone": "9000000000",
        })
        assert r.status_code == 200, r.text
        oid = r.json()["order"]["id"]
        rp = http.post(f"{API}/orders/{oid}/mock-pay", headers=headers)
        assert rp.status_code == 200

    def test_refund_flow(self, http, admin_token):
        tok, _u = _new_user(http)
        hdr = {"Authorization": f"Bearer {tok}"}
        prods = http.get(f"{API}/products").json()
        pid = prods[0]["id"]

        # Earn some points first
        self._seed_points(http, hdr, pid, qty=30)
        bal_before = http.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal_before > 0

        # Create order redeeming a chunk of points
        redeem = min(50, bal_before)
        r = http.post(f"{API}/orders/create", headers=hdr, json={
            "items": [{"product_id": pid, "quantity": 5}],
            "shipping_address": "X", "shipping_name": "X", "shipping_phone": "9000000000",
            "points_to_redeem": redeem,
        })
        assert r.status_code == 200, r.text
        order = r.json()["order"]
        oid = order["id"]
        actual_redeemed = int(order["points_redeemed"])
        assert actual_redeemed > 0
        assert actual_redeemed <= redeem

        bal_after_spend = http.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal_after_spend == bal_before - actual_redeemed

        # Admin cancels order
        ahdr = {"Authorization": f"Bearer {admin_token}"}
        rc = http.put(f"{API}/admin/orders/{oid}/status", headers=ahdr, json={"status": "cancelled"})
        assert rc.status_code == 200, rc.text
        assert rc.json()["status"] == "cancelled"

        # Points restored
        pts_after = http.get(f"{API}/points", headers=hdr).json()
        assert pts_after["balance"] == bal_before, (pts_after["balance"], bal_before)

        # Refund tx present
        txs = pts_after["transactions"]
        refund_txs = [t for t in txs if t.get("reason") == "order_refund" and t.get("meta", {}).get("order_id") == oid]
        assert len(refund_txs) == 1
        assert refund_txs[0]["type"] == "earn"
        assert refund_txs[0]["amount"] == actual_redeemed

        # Cancel again → idempotent, no new refund tx
        rc2 = http.put(f"{API}/admin/orders/{oid}/status", headers=ahdr, json={"status": "cancelled"})
        assert rc2.status_code == 200
        pts2 = http.get(f"{API}/points", headers=hdr).json()
        refunds2 = [t for t in pts2["transactions"] if t.get("reason") == "order_refund" and t.get("meta", {}).get("order_id") == oid]
        assert len(refunds2) == 1, "second cancel must not re-refund"
        assert pts2["balance"] == bal_before

    def test_cancel_zero_redeemed_creates_no_refund(self, http, admin_token):
        tok, _u = _new_user(http)
        hdr = {"Authorization": f"Bearer {tok}"}
        prods = http.get(f"{API}/products").json()
        pid = prods[0]["id"]
        # Order without redeeming any points
        r = http.post(f"{API}/orders/create", headers=hdr, json={
            "items": [{"product_id": pid, "quantity": 1}],
            "shipping_address": "X", "shipping_name": "X", "shipping_phone": "9000000000",
        })
        assert r.status_code == 200
        oid = r.json()["order"]["id"]

        ahdr = {"Authorization": f"Bearer {admin_token}"}
        rc = http.put(f"{API}/admin/orders/{oid}/status", headers=ahdr, json={"status": "cancelled"})
        assert rc.status_code == 200

        pts = http.get(f"{API}/points", headers=hdr).json()
        refunds = [t for t in pts["transactions"] if t.get("reason") == "order_refund" and t.get("meta", {}).get("order_id") == oid]
        assert refunds == []


# ---------------- INTERACTIONS ----------------
class TestInteractions:
    def test_requires_auth(self, http, products_list):
        r = http.post(f"{API}/interactions", json={"product_id": products_list[0]["id"], "event": "view"})
        assert r.status_code == 401

    def test_invalid_event(self, http, user_ctx, products_list):
        r = http.post(f"{API}/interactions", headers=user_ctx["headers"],
                      json={"product_id": products_list[0]["id"], "event": "purchase"})
        assert r.status_code == 400

    def test_unknown_product(self, http, user_ctx):
        r = http.post(f"{API}/interactions", headers=user_ctx["headers"],
                      json={"product_id": "does-not-exist-uuid", "event": "view"})
        assert r.status_code == 400

    def test_valid_events_all_weights(self, http, user_ctx, products_list):
        pid = products_list[0]["id"]
        for ev in ["view", "wishlist", "review", "shortlist_add", "cart_add"]:
            r = http.post(f"{API}/interactions", headers=user_ctx["headers"],
                          json={"product_id": pid, "event": ev})
            assert r.status_code == 200, (ev, r.text)
            body = r.json()
            assert not _has_underscore_id(body)


# ---------------- RECOMMENDATIONS ----------------
class TestRecommendations:
    def test_requires_auth(self, http):
        r = http.get(f"{API}/recommendations")
        assert r.status_code == 401

    def test_cold_start_returns_list(self, http):
        tok, _ = _new_user(http)
        hdr = {"Authorization": f"Bearer {tok}"}
        r = http.get(f"{API}/recommendations", headers=hdr, params={"limit": 8})
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert 0 <= len(items) <= 8
        assert not _has_underscore_id(items)

    def test_personalization_biases_and_excludes_seen(self, http):
        tok, _u = _new_user(http)
        hdr = {"Authorization": f"Bearer {tok}"}
        # Get 3 products in dining/cups subcategory
        r = http.get(f"{API}/products", params={"subcategory": "cups"})
        assert r.status_code == 200
        cups = r.json()
        assert len(cups) >= 3, "seed data should have at least 3 cup products"
        seen_ids = [p["id"] for p in cups[:3]]

        for pid in seen_ids:
            rv = http.post(f"{API}/interactions", headers=hdr,
                           json={"product_id": pid, "event": "view"})
            assert rv.status_code == 200

        rec = http.get(f"{API}/recommendations", headers=hdr, params={"limit": 8})
        assert rec.status_code == 200
        items = rec.json()
        assert isinstance(items, list)
        assert len(items) <= 8
        assert not _has_underscore_id(items)
        # Must NEVER contain any of the 3 already-viewed
        rec_ids = {p["id"] for p in items}
        assert rec_ids.isdisjoint(set(seen_ids)), "seen products must be excluded"

        # Bias check: at least one recommended product should match cups subcategory
        # or dining category (soft assertion — fallback fillers may be featured only,
        # but with 3 cups viewed we expect at least SOME dining/cups matches).
        matches = [p for p in items if p.get("subcategory") == "cups" or p.get("category") == "dining"]
        assert len(matches) >= 1, f"expected some dining/cups bias, got categories={[p.get('category') for p in items]}"

    def test_limit_respected(self, http, user_ctx):
        r = http.get(f"{API}/recommendations", headers=user_ctx["headers"], params={"limit": 3})
        assert r.status_code == 200
        assert len(r.json()) <= 3
