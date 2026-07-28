"""
Backend test suite for Garlic by Urban Nest — iteration 4.
Covers: regression, product search (?q=), reviews, Nest Rewards points,
referral bonus via shortlist mark-bought, order detail history, admin status timeline.
"""
import os
import uuid
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load EXPO_PUBLIC_BACKEND_URL from frontend/.env
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


def _no_id_leak(obj):
    """Recursively assert MongoDB `_id` never appears."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked: keys={list(obj.keys())}"
        for v in obj.values():
            _no_id_leak(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_id_leak(v)


# ------------------ Fixtures ------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_a(s):
    """Freshly signed-up user A (starts at 0 points)."""
    uniq = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_UserA_{uniq}",
        "email": f"test_a_{uniq}@garlicnest.com",
        "mobile": f"8{uniq[:9]}",
        "password": "Passw0rd!",
    }
    r = s.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["access_token"], "id": d["user"]["id"], "name": d["user"]["name"], "email": payload["email"]}


@pytest.fixture(scope="session")
def user_b(s):
    """Second user for upsert & multi-user review tests."""
    uniq = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_UserB_{uniq}",
        "email": f"test_b_{uniq}@garlicnest.com",
        "mobile": f"7{uniq[:9]}",
        "password": "Passw0rd!",
    }
    r = s.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200
    d = r.json()
    return {"token": d["access_token"], "id": d["user"]["id"], "name": d["user"]["name"]}


@pytest.fixture(scope="session")
def sample_product_id(s):
    """Pick a real seeded product id."""
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    return items[0]["id"]


# ------------------ REGRESSION ------------------
class TestRegression:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) >= 6
        assert {c["id"] for c in cats} >= {"dining", "kitchen", "decor"}

    def test_products_list(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 10
        _no_id_leak(items)

    def test_collections(self, s):
        r = s.get(f"{API}/collections")
        assert r.status_code == 200 and len(r.json()) >= 3

    def test_editorials(self, s):
        r = s.get(f"{API}/editorials")
        assert r.status_code == 200
        _no_id_leak(r.json())

    def test_auth_me(self, s, user_a):
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"]


# ------------------ SEARCH ------------------
class TestSearch:
    def test_search_blush(self, s):
        r = s.get(f"{API}/products", params={"q": "blush"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for it in items:
            assert "blush" in it["name"].lower()

    def test_search_case_insensitive(self, s):
        lower = s.get(f"{API}/products", params={"q": "blush"}).json()
        upper = s.get(f"{API}/products", params={"q": "BLUSH"}).json()
        assert len(lower) == len(upper)

    def test_search_empty_result(self, s):
        r = s.get(f"{API}/products", params={"q": "zzzzz_nomatch_xyz"})
        assert r.status_code == 200 and r.json() == []


# ------------------ REVIEWS ------------------
class TestReviews:
    def test_empty_reviews(self, s, sample_product_id):
        r = s.get(f"{API}/products/{sample_product_id}/reviews")
        assert r.status_code == 200
        # Fresh product should have no reviews (reseeded on restart)
        assert isinstance(r.json(), list)

    def test_post_requires_auth(self, s, sample_product_id):
        r = s.post(f"{API}/products/{sample_product_id}/reviews",
                   json={"rating": 5, "title": "x", "body": "y"})
        assert r.status_code == 401

    def test_invalid_rating_zero(self, s, sample_product_id, user_a):
        r = s.post(f"{API}/products/{sample_product_id}/reviews",
                   json={"rating": 0, "title": "t", "body": "b"},
                   headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 400

    def test_invalid_rating_six(self, s, sample_product_id, user_a):
        r = s.post(f"{API}/products/{sample_product_id}/reviews",
                   json={"rating": 6, "title": "t", "body": "b"},
                   headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 400

    def test_create_review_ok(self, s, sample_product_id, user_a):
        r = s.post(f"{API}/products/{sample_product_id}/reviews",
                   json={"rating": 5, "title": "Loved it", "body": "Really nice quality"},
                   headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("id", "user_name", "rating", "title", "body", "created_at"):
            assert k in d
        assert d["rating"] == 5
        assert d["user_name"] == user_a["name"]
        _no_id_leak(d)

    def test_review_upsert_no_duplicates(self, s, sample_product_id, user_a):
        # Second review by same user should upsert
        r = s.post(f"{API}/products/{sample_product_id}/reviews",
                   json={"rating": 4, "title": "Updated", "body": "still good"},
                   headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        listing = s.get(f"{API}/products/{sample_product_id}/reviews").json()
        mine = [x for x in listing if x["user_name"] == user_a["name"]]
        assert len(mine) == 1
        assert mine[0]["rating"] == 4
        _no_id_leak(listing)

    def test_product_detail_has_rating_fields(self, s, sample_product_id, user_b):
        # Add a second review from user_b to get a mixed average
        s.post(f"{API}/products/{sample_product_id}/reviews",
               json={"rating": 3, "title": "ok", "body": "ok"},
               headers={"Authorization": f"Bearer {user_b['token']}"})
        r = s.get(f"{API}/products/{sample_product_id}")
        assert r.status_code == 200
        d = r.json()
        assert "average_rating" in d and "review_count" in d
        assert d["review_count"] == 2
        # (4 + 3)/2 = 3.5
        assert d["average_rating"] == 3.5
        # rounded 1 decimal
        assert isinstance(d["average_rating"], float)
        _no_id_leak(d)


# ------------------ POINTS ------------------
class TestPoints:
    def test_points_requires_auth(self, s):
        r = s.get(f"{API}/points")
        assert r.status_code == 401

    def test_new_user_zero_balance(self, s, user_b):
        # user_b hasn't paid/redeemed yet
        r = s.get(f"{API}/points", headers={"Authorization": f"Bearer {user_b['token']}"})
        assert r.status_code == 200
        d = r.json()
        assert d["balance"] == 0
        assert d["rate_per_rupee"] == 0.1
        assert d["redeem_value"] == 0.10
        assert d["transactions"] == []


# ------------------ ORDER + HISTORY + POINTS EARN + IDEMPOTENCY ------------------
@pytest.fixture(scope="session")
def order_ctx(s, sample_product_id, user_a):
    """Create an order and mock-pay it for user_a. Returns dict with order_id, subtotal, earn."""
    hdr = {"Authorization": f"Bearer {user_a['token']}"}
    payload = {
        "items": [{"product_id": sample_product_id, "quantity": 2}],
        "shipping_address": "1 Test Ln",
        "shipping_name": "T A",
        "shipping_phone": "9000000000",
        "points_to_redeem": 0,
    }
    r = s.post(f"{API}/orders/create", json=payload, headers=hdr)
    assert r.status_code == 200, r.text
    order = r.json()["order"]
    return {"order_id": order["id"], "subtotal": order["subtotal"], "amount": order["amount"]}


class TestOrderMockPayAndPoints:
    def test_history_created_entry(self, s, order_ctx, user_a):
        r = s.get(f"{API}/orders/{order_ctx['order_id']}",
                  headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        d = r.json()
        assert "history" in d and isinstance(d["history"], list)
        assert d["history"][0]["status"] == "created"
        _no_id_leak(d)

    def test_mock_pay_awards_points(self, s, order_ctx, user_a):
        r = s.post(f"{API}/orders/{order_ctx['order_id']}/mock-pay",
                   headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "paid"
        assert "points_earned" in d
        expected = int(round(order_ctx["amount"] * 0.1))
        assert d["points_earned"] == expected
        order_ctx["earn"] = expected

    def test_balance_reflects_earn(self, s, user_a, order_ctx):
        r = s.get(f"{API}/points", headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        d = r.json()
        assert d["balance"] == order_ctx["earn"]
        txs = d["transactions"]
        earn_txs = [t for t in txs if t["type"] == "earn" and t["reason"] == "order_earn"]
        assert len(earn_txs) >= 1
        assert earn_txs[0]["meta"]["order_id"] == order_ctx["order_id"]
        _no_id_leak(d)

    def test_mock_pay_idempotent(self, s, order_ctx, user_a):
        bal_before = s.get(f"{API}/points",
                           headers={"Authorization": f"Bearer {user_a['token']}"}).json()["balance"]
        r = s.post(f"{API}/orders/{order_ctx['order_id']}/mock-pay",
                   headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        assert r.json().get("status") == "paid"
        # No extra points
        bal_after = s.get(f"{API}/points",
                          headers={"Authorization": f"Bearer {user_a['token']}"}).json()["balance"]
        assert bal_after == bal_before

    def test_history_has_paid_entry(self, s, order_ctx, user_a):
        r = s.get(f"{API}/orders/{order_ctx['order_id']}",
                  headers={"Authorization": f"Bearer {user_a['token']}"})
        history = r.json()["history"]
        statuses = [h["status"] for h in history]
        assert "created" in statuses and "paid" in statuses


# ------------------ POINTS REDEMPTION ------------------
class TestRedemption:
    def test_redeem_ok(self, s, sample_product_id):
        # Self-contained: sign up a fresh user, farm points via mock-pay, then redeem.
        uniq = uuid.uuid4().hex[:8]
        u = s.post(f"{API}/auth/signup", json={
            "name": f"TEST_Red_{uniq}", "email": f"test_red_{uniq}@garlicnest.com",
            "mobile": f"3{uniq[:9]}", "password": "Passw0rd!",
        }).json()
        hdr = {"Authorization": f"Bearer {u['access_token']}"}
        # farm points
        farm = s.post(f"{API}/orders/create", json={
            "items": [{"product_id": sample_product_id, "quantity": 5}],
            "shipping_address": "x", "shipping_name": "y", "shipping_phone": "9000000000",
            "points_to_redeem": 0,
        }, headers=hdr).json()["order"]
        s.post(f"{API}/orders/{farm['id']}/mock-pay", headers=hdr)
        bal_before = s.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal_before > 0, "Need positive balance from farming"
        prod = s.get(f"{API}/products/{sample_product_id}").json()
        # Order enough qty to allow full redemption of bal_before under 30% cap
        # points value = bal_before * 0.10, subtotal must be > that / 0.3
        needed_subtotal = (bal_before * 0.10) / 0.3
        qty = max(2, int(needed_subtotal // prod["price"]) + 2)
        payload = {
            "items": [{"product_id": sample_product_id, "quantity": qty}],
            "shipping_address": "1 Test Ln", "shipping_name": "T A", "shipping_phone": "9000000000",
            "points_to_redeem": bal_before,
        }
        r = s.post(f"{API}/orders/create", json=payload, headers=hdr)
        assert r.status_code == 200, r.text
        o = r.json()["order"]
        assert o["points_redeemed"] == bal_before
        assert abs(o["discount"] - round(bal_before * 0.10, 2)) < 0.01
        assert abs(o["amount"] - (o["subtotal"] - o["discount"])) < 0.01
        # balance now zero
        bal_after = s.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal_after == 0

    def test_redeem_exceeds_balance(self, s, sample_product_id, user_b):
        hdr = {"Authorization": f"Bearer {user_b['token']}"}
        # user_b has 0 balance
        payload = {
            "items": [{"product_id": sample_product_id, "quantity": 1}],
            "shipping_address": "x", "shipping_name": "y", "shipping_phone": "9000000000",
            "points_to_redeem": 100,
        }
        r = s.post(f"{API}/orders/create", json=payload, headers=hdr)
        assert r.status_code == 400

    def test_redeem_cap_30_percent(self, s, sample_product_id):
        """Award user_c many points then try to over-redeem — cap should clip."""
        # Sign up user_c and get points via a paid order
        uniq = uuid.uuid4().hex[:8]
        signup = s.post(f"{API}/auth/signup", json={
            "name": f"TEST_UserC_{uniq}", "email": f"test_c_{uniq}@garlicnest.com",
            "mobile": f"6{uniq[:9]}", "password": "Passw0rd!",
        }).json()
        hdr = {"Authorization": f"Bearer {signup['access_token']}"}
        # Big order to farm points — need bal >> cap of small order
        pay1 = {
            "items": [{"product_id": sample_product_id, "quantity": 50}],
            "shipping_address": "x", "shipping_name": "y", "shipping_phone": "9000000000",
            "points_to_redeem": 0,
        }
        o1 = s.post(f"{API}/orders/create", json=pay1, headers=hdr).json()["order"]
        s.post(f"{API}/orders/{o1['id']}/mock-pay", headers=hdr)
        bal = s.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal > 0

        # Small order — try to over-redeem (request full balance; cap should clip it below balance)
        small = {
            "items": [{"product_id": sample_product_id, "quantity": 1}],
            "shipping_address": "x", "shipping_name": "y", "shipping_phone": "9000000000",
            "points_to_redeem": bal,
        }
        r = s.post(f"{API}/orders/create", json=small, headers=hdr)
        assert r.status_code == 200
        o = r.json()["order"]
        cap_rupees = o["subtotal"] * 0.3
        max_pts = int(cap_rupees / 0.10)
        assert o["points_redeemed"] <= max_pts
        assert o["points_redeemed"] < bal  # cap must actually clip
        assert abs(o["amount"] - (o["subtotal"] - o["discount"])) < 0.01


# ------------------ REFERRAL BONUS ------------------
class TestReferral:
    def test_referral_awards_once(self, s, sample_product_id):
        # Fresh owner
        uniq = uuid.uuid4().hex[:8]
        owner = s.post(f"{API}/auth/signup", json={
            "name": f"TEST_Owner_{uniq}", "email": f"test_own_{uniq}@garlicnest.com",
            "mobile": f"5{uniq[:9]}", "password": "Passw0rd!",
        }).json()
        hdr = {"Authorization": f"Bearer {owner['access_token']}"}
        # create shortlist
        sl = s.post(f"{API}/shortlists", json={"name": f"Nest_{uniq}", "occasion": "wedding"}, headers=hdr).json()
        # add item
        s.post(f"{API}/shortlists/{sl['id']}/items",
               json={"product_id": sample_product_id}, headers=hdr)
        # Baseline balance
        bal_before = s.get(f"{API}/points", headers=hdr).json()["balance"]
        # public mark-bought (no auth)
        r = s.post(f"{API}/shortlists/share/{sl['share_slug']}/mark-bought",
                   json={"product_id": sample_product_id})
        assert r.status_code == 200
        _no_id_leak(r.json())
        bal_after = s.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal_after == bal_before + 500

        # second mark-bought should NOT re-award
        r2 = s.post(f"{API}/shortlists/share/{sl['share_slug']}/mark-bought",
                    json={"product_id": sample_product_id})
        assert r2.status_code == 200
        bal_after2 = s.get(f"{API}/points", headers=hdr).json()["balance"]
        assert bal_after2 == bal_after


# ------------------ ORDER TIMELINE via ADMIN ------------------
class TestOrderTimeline:
    def test_full_status_timeline(self, s, sample_product_id, admin_token):
        # Fresh user + fresh order
        uniq = uuid.uuid4().hex[:8]
        u = s.post(f"{API}/auth/signup", json={
            "name": f"TEST_Time_{uniq}", "email": f"test_time_{uniq}@garlicnest.com",
            "mobile": f"4{uniq[:9]}", "password": "Passw0rd!",
        }).json()
        hdr_u = {"Authorization": f"Bearer {u['access_token']}"}
        hdr_a = {"Authorization": f"Bearer {admin_token}"}

        # create
        o = s.post(f"{API}/orders/create", json={
            "items": [{"product_id": sample_product_id, "quantity": 1}],
            "shipping_address": "x", "shipping_name": "y", "shipping_phone": "9000000000",
            "points_to_redeem": 0,
        }, headers=hdr_u).json()["order"]
        oid = o["id"]

        # mock-pay
        s.post(f"{API}/orders/{oid}/mock-pay", headers=hdr_u)

        # admin -> shipped
        r_ship = s.put(f"{API}/admin/orders/{oid}/status",
                       json={"status": "shipped"}, headers=hdr_a)
        assert r_ship.status_code == 200
        _no_id_leak(r_ship.json())

        # admin -> delivered
        r_del = s.put(f"{API}/admin/orders/{oid}/status",
                      json={"status": "delivered"}, headers=hdr_a)
        assert r_del.status_code == 200

        # verify final history
        final = s.get(f"{API}/orders/{oid}", headers=hdr_u).json()
        _no_id_leak(final)
        statuses = [h["status"] for h in final["history"]]
        assert statuses == ["created", "paid", "shipped", "delivered"]
        # each entry has at
        for h in final["history"]:
            assert "at" in h and h["at"]

    def test_admin_editorials_no_id_leak(self, s, admin_token):
        r = s.get(f"{API}/admin/editorials", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        _no_id_leak(r.json())
