"""Iteration 10 backend regression:
   - NEW DELETE /api/auth/me (self-delete + Apple review requirement)
   - Admin seed still works after removing source defaults
   - Razorpay verify + idempotency
   - Baseline regression (products/categories/editorials/points/reviews/admin status)
"""
import hashlib
import hmac
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

# ---------- Base URL (public preview URL, per test guidelines) ----------
_FRONT_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (
    _FRONT_ENV.get("EXPO_PUBLIC_BACKEND_URL")
    or _FRONT_ENV.get("EXPO_BACKEND_URL")
    or ""
).rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set in /app/frontend/.env"

# ---------- Backend env for Razorpay HMAC ----------
_BACK_ENV = dotenv_values("/app/backend/.env")
RZP_SECRET = _BACK_ENV.get("RAZORPAY_KEY_SECRET", "")
RZP_KEY_ID = _BACK_ENV.get("RAZORPAY_KEY_ID", "")

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body.get("user", {}).get("role") == "admin", body
    return body["access_token"]


def _mkuser(api):
    """Signup a fresh disposable user; returns (user_dict, token, headers)."""
    uniq = uuid.uuid4().hex[:10]
    email = f"TEST_it10_{uniq}@example.com"
    mobile = "9" + str(int(time.time() * 1000))[-9:]
    payload = {"name": "It10 User", "email": email, "mobile": mobile, "password": "Test@1234"}
    r = api.post(f"{BASE_URL}/api/auth/signup", json=payload)
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text[:200]}"
    j = r.json()
    tok = j["access_token"]
    return j["user"], tok, {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Basic health / listings ----------
class TestHealthAndCatalog:
    def test_products_ok(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert "id" in data[0] and "price" in data[0]

    def test_categories_ok(self, api):
        r = api.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_editorials_ok(self, api):
        r = api.get(f"{BASE_URL}/api/editorials")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Admin login (verifies env-based seed still works) ----------
class TestAdminSeed:
    def test_admin_login_role(self, api, admin_token):
        # admin_token fixture already asserts role=admin + 200.
        assert admin_token and isinstance(admin_token, str)

    def test_admin_me_endpoint(self, api, admin_token):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        j = r.json()
        assert j.get("role") == "admin"
        assert j.get("email") == ADMIN_EMAIL


# ---------- Auth: signup/login/me + points ----------
class TestAuthUserFlow:
    def test_signup_login_me(self, api):
        user, tok, hdr = _mkuser(api)
        # /auth/me
        r = api.get(f"{BASE_URL}/api/auth/me", headers=hdr)
        assert r.status_code == 200
        assert r.json()["email"] == user["email"]

        # Login with mobile identifier
        r2 = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": user["mobile"], "password": "Test@1234"},
        )
        assert r2.status_code == 200
        assert r2.json()["user"]["id"] == user["id"]

    def test_points_endpoint(self, api):
        user, tok, hdr = _mkuser(api)
        r = api.get(f"{BASE_URL}/api/points", headers=hdr)
        assert r.status_code == 200
        j = r.json()
        assert "balance" in j and "rate_per_rupee" in j
        assert j["balance"] == 0

    def test_review_post(self, api):
        # Fetch a product id
        prods = api.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        _, tok, hdr = _mkuser(api)
        r = api.post(
            f"{BASE_URL}/api/products/{pid}/reviews",
            headers=hdr,
            json={"rating": 5, "text": "TEST_it10 solid product"},
        )
        assert r.status_code in (200, 201), r.text[:200]
        j = r.json()
        assert j.get("rating") == 5


# ---------- DELETE /api/auth/me flow ----------
class TestDeleteAccount:
    def test_admin_cannot_self_delete(self, api, admin_token):
        r = api.delete(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 400, r.text[:200]
        assert "self-delete" in r.text.lower() or "admin" in r.text.lower()

    def test_full_cleanup_and_order_anonymisation(self, api):
        user, tok, hdr = _mkuser(api)
        uid = user["id"]

        # 1) Add a wishlist item
        prods = api.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = api.post(f"{BASE_URL}/api/wishlist/toggle", headers=hdr, json={"product_id": pid})
        assert r.status_code == 200, r.text[:200]

        # Verify wishlist has 1 item
        r = api.get(f"{BASE_URL}/api/wishlist", headers=hdr)
        assert r.status_code == 200
        assert len(r.json()) == 1

        # 2) Create a shortlist
        r = api.post(
            f"{BASE_URL}/api/shortlists",
            headers=hdr,
            json={"name": "TEST_it10 list", "product_ids": [pid]},
        )
        assert r.status_code in (200, 201), r.text[:200]
        sl_id = r.json()["id"]

        # 3) Post a review (bonus: exercises interactions/points via review-photo bonus? no photos here)
        r = api.post(
            f"{BASE_URL}/api/products/{pid}/reviews",
            headers=hdr,
            json={"rating": 4, "text": "TEST_it10 review"},
        )
        assert r.status_code in (200, 201), r.text[:200]

        # 4) Interaction event (view)
        r = api.post(f"{BASE_URL}/api/interactions", headers=hdr, json={"product_id": pid, "event": "view"})
        # Endpoint may not be exposed under that name — try alternate
        if r.status_code == 404:
            # fall through, not fatal for delete test
            pass

        # 5) Place an order (mock path)
        order_body = {
            "items": [{"product_id": pid, "quantity": 1}],
            "shipping_name": "Original Name",
            "shipping_phone": "9876543210",
            "shipping_address": "TEST addr",
        }
        r = api.post(f"{BASE_URL}/api/orders/create", headers=hdr, json=order_body)
        assert r.status_code == 200, r.text[:200]
        oc = r.json()
        order_id = oc["order"]["id"]

        # 6) DELETE /api/auth/me
        r = api.delete(f"{BASE_URL}/api/auth/me", headers=hdr)
        assert r.status_code == 200, r.text[:200]
        assert r.json().get("ok") is True

        # 7) GET /api/auth/me should now be 401 (user record gone)
        r = api.get(f"{BASE_URL}/api/auth/me", headers=hdr)
        assert r.status_code == 401, f"expected 401 after delete, got {r.status_code} {r.text[:200]}"

        # 8) Verify order still exists but is anonymised — needs admin
        adm = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        adm_tok = adm.json()["access_token"]
        ahdr = {"Authorization": f"Bearer {adm_tok}"}
        r = api.get(f"{BASE_URL}/api/admin/orders", headers=ahdr)
        assert r.status_code == 200, r.text[:200]
        matches = [o for o in r.json() if o["id"] == order_id]
        assert len(matches) == 1, f"order {order_id} not found in admin list"
        anon = matches[0]
        assert anon["user_id"].startswith("deleted_"), f"user_id not anonymised: {anon.get('user_id')}"
        assert anon["shipping_name"] == "[deleted]"
        assert anon["shipping_phone"] == "[deleted]"

        # 9) Shortlist should be gone (cannot query as user anymore — check via admin? shortlists endpoint is user-only).
        #    Instead re-login attempt would 401 (user record deleted) — already covered.

        # Store for post-delete verification via admin
        return {"order_id": order_id, "anonymised_uid": anon["user_id"]}


# ---------- Razorpay verify + idempotency ----------
class TestRazorpay:
    @pytest.fixture(scope="class")
    def paid_order(self, api):
        """Create a fresh order (real razorpay_order_id from live test key), then HMAC verify."""
        _, tok, hdr = _mkuser(api)
        prods = api.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = api.post(
            f"{BASE_URL}/api/orders/create",
            headers=hdr,
            json={
                "items": [{"product_id": pid, "quantity": 1}],
                "shipping_name": "It10 RZP",
                "shipping_phone": "9876543210",
                "shipping_address": "RZP addr",
            },
        )
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        assert j.get("mock") is False, f"expected live razorpay, got mock=true: {j}"
        assert j.get("key_id") == RZP_KEY_ID, "key_id in response does not match backend .env"
        rzp_oid = j["order"].get("razorpay_order_id") or ""
        assert rzp_oid.startswith("order_"), f"razorpay_order_id missing/invalid: {j}"
        return {"hdr": hdr, "order": j["order"], "razorpay_order_id": rzp_oid}

    def test_orders_create_live(self, paid_order):
        # Prime: fixture already validates mock=false + real razorpay_order_id.
        assert paid_order["razorpay_order_id"].startswith("order_")

    def test_verify_hmac_success(self, api, paid_order):
        assert RZP_SECRET, "RAZORPAY_KEY_SECRET missing in backend .env"
        oid = paid_order["order"]["id"]
        rzp_oid = paid_order["razorpay_order_id"]
        pay_id = f"pay_TEST_it10_{uuid.uuid4().hex[:8]}"
        sig = hmac.new(
            RZP_SECRET.encode(),
            f"{rzp_oid}|{pay_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        # Backend expects form-encoded (see iteration 9 report)
        r = requests.post(
            f"{BASE_URL}/api/payments/verify",
            params={"order_id": oid},
            data={
                "razorpay_order_id": rzp_oid,
                "razorpay_payment_id": pay_id,
                "razorpay_signature": sig,
            },
        )
        assert r.status_code == 200, f"verify failed: {r.status_code} {r.text[:200]}"

        # Order status should be paid
        r = api.get(f"{BASE_URL}/api/orders/{oid}", headers=paid_order["hdr"])
        assert r.status_code == 200
        o = r.json()
        assert o["status"] == "paid", o

        # Points must be awarded to that user (10% of amount rounded)
        expected_pts = int(round(float(o["amount"]) * 0.1))
        r = api.get(f"{BASE_URL}/api/points", headers=paid_order["hdr"])
        assert r.status_code == 200
        assert r.json()["balance"] >= expected_pts, (r.json(), expected_pts)

    def test_verify_hmac_idempotent(self, api, paid_order):
        """Re-posting the same verify must NOT double-award points."""
        oid = paid_order["order"]["id"]
        rzp_oid = paid_order["razorpay_order_id"]
        pay_id = "pay_TEST_it10_replay"
        sig = hmac.new(
            RZP_SECRET.encode(),
            f"{rzp_oid}|{pay_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        # capture points BEFORE replay
        before = api.get(f"{BASE_URL}/api/points", headers=paid_order["hdr"]).json()["balance"]

        r = requests.post(
            f"{BASE_URL}/api/payments/verify",
            params={"order_id": oid},
            data={
                "razorpay_order_id": rzp_oid,
                "razorpay_payment_id": pay_id,
                "razorpay_signature": sig,
            },
        )
        # Endpoint may return 200 (idempotent skip) or 400 (already paid). Accept both, but points MUST NOT change.
        assert r.status_code in (200, 400, 409), r.text[:200]
        after = api.get(f"{BASE_URL}/api/points", headers=paid_order["hdr"]).json()["balance"]
        assert after == before, f"points must not double-award on replay: before={before} after={after}"

    def test_verify_bad_signature_rejected(self, api, paid_order):
        # Use a totally fresh user+order so we're not polluted by the already-paid one
        _, tok, hdr = _mkuser(api)
        prods = api.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = api.post(
            f"{BASE_URL}/api/orders/create",
            headers=hdr,
            json={
                "items": [{"product_id": pid, "quantity": 1}],
                "shipping_name": "It10 badsig",
                "shipping_phone": "9876543210",
                "shipping_address": "addr",
            },
        )
        j = r.json()
        oid = j["order"]["id"]
        rzp_oid = j["order"].get("razorpay_order_id") or ""
        assert rzp_oid.startswith("order_"), j
        bad_sig = "0" * 64
        r = requests.post(
            f"{BASE_URL}/api/payments/verify",
            params={"order_id": oid},
            data={
                "razorpay_order_id": rzp_oid,
                "razorpay_payment_id": "pay_bogus",
                "razorpay_signature": bad_sig,
            },
        )
        assert r.status_code in (400, 401, 403), r.status_code
        # order must still be created (not paid)
        r = api.get(f"{BASE_URL}/api/orders/{oid}", headers=hdr)
        assert r.json()["status"] != "paid"


# ---------- Admin status transitions guardrail ----------
class TestAdminOrderStatusTransitions:
    def test_admin_status_transitions(self, api, admin_token):
        # Create a fresh order as a user; admin will drive its status
        _, tok, hdr = _mkuser(api)
        prods = api.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = api.post(
            f"{BASE_URL}/api/orders/create",
            headers=hdr,
            json={
                "items": [{"product_id": pid, "quantity": 1}],
                "shipping_name": "It10 status",
                "shipping_phone": "9876543210",
                "shipping_address": "addr",
            },
        )
        assert r.status_code == 200, r.text[:200]
        oid = r.json()["order"]["id"]
        ahdr = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

        # Invalid transition first (created -> delivered) should be rejected
        r = api.put(
            f"{BASE_URL}/api/admin/orders/{oid}/status",
            headers=ahdr,
            json={"status": "delivered"},
        )
        assert r.status_code in (400, 409), f"expected rejection, got {r.status_code} {r.text[:200]}"

        # Order still not delivered — fetch via user's own endpoint
        r = api.get(f"{BASE_URL}/api/orders/{oid}", headers=hdr)
        assert r.status_code == 200
        assert r.json()["status"] != "delivered"
