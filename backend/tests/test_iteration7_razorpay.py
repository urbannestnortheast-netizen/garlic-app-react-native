"""
Iteration 7 — Razorpay live (test-mode) integration end-to-end backend tests.

Verifies:
  1. POST /api/orders/create returns mock=false, real razorpay_order_id, key_id, checkout_url.
  2. GET /api/payments/checkout/{order_id} renders HTML containing key_id, razorpay_order_id, checkout.razorpay.com/v1/checkout.js.
  3. POST /api/payments/verify:
       - wrong signature -> 400
       - correct HMAC signature -> 200, order.status=paid, points awarded, history has 'paid' entry
       - idempotent second call -> no double point award / no duplicate history
  4. Regression: /api/products, /api/categories, /api/editorials, POST /api/products/{id}/reviews,
     POST /api/orders/{order_id}/mock-pay (legacy path still functional), admin status guardrails.
"""

import hashlib
import hmac
import os
import re
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://pastel-nest-shop.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "admin@garlic.app"
ADMIN_PASSWORD = "Admin@123"

# Real test key that the main agent wired into backend/.env.
EXPECTED_KEY_ID = "rzp_test_TJNt4zJB9d9bpu"
# Secret is used only for constructing HMAC signatures during tests (matches backend env).
RAZORPAY_KEY_SECRET = "E2QTv6G6CipaxHMtBMGBmBJE"


# ---------- session & fixtures ---------- #
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_ctx(api):
    """Register a fresh disposable test user for order/payment tests."""
    hex_ = uuid.uuid4().hex[:10]
    email = f"TEST_it7_{hex_}@garlicnest.com"
    mobile = "7" + str(int(time.time() * 1000))[-9:]
    payload = {"name": f"IT7 User {hex_}", "email": email, "mobile": mobile, "password": "Test@1234"}
    r = api.post(f"{BASE_URL}/api/auth/signup", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["access_token"], "user": data["user"], "email": email, "mobile": mobile}


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def a_product(api):
    r = api.get(f"{BASE_URL}/api/products")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    return items[0]


# ---------- 1-3 grouped into single class so xdist loadscope keeps them on one worker
def _hmac_sig(order_id: str, payment_id: str) -> str:
    msg = f"{order_id}|{payment_id}".encode()
    return hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()


class TestRazorpayFlow:
    """Grouped: order create -> checkout html -> verify (wrong/correct/idempotent).
    Kept in ONE class so pytest-xdist --dist loadscope pins the whole flow to one worker
    (module addopts = -n 2 --dist loadscope). Otherwise cross-class shared state (class attrs)
    breaks when tests get scheduled to different workers."""

    def test_create_order_returns_real_razorpay_order(self, api, user_ctx, a_product):
        payload = {
            "items": [{"product_id": a_product["id"], "quantity": 1}],
            "shipping_address": "TEST 123 Nest Lane",
            "shipping_name": "IT7 Buyer",
            "shipping_phone": "9998887770",
            "points_to_redeem": 0,
        }
        r = api.post(f"{BASE_URL}/api/orders/create", json=payload, headers=auth_headers(user_ctx["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        # HTTP-level assertions
        assert body.get("mock") is False, f"Expected mock=false with real keys, got {body.get('mock')}. Body: {body}"
        assert body.get("key_id") == EXPECTED_KEY_ID, f"key_id mismatch: {body.get('key_id')}"
        order = body["order"]
        rid = order.get("razorpay_order_id")
        assert rid and re.match(r"^order_[A-Za-z0-9]+$", rid), f"Bad razorpay_order_id: {rid!r}"
        assert body["checkout_url"].endswith(f"/api/payments/checkout/{order['id']}")
        assert order["status"] == "created"
        assert order["mock_payment"] is False
        # Persist for next tests via module-scoped attr
        TestRazorpayFlow.created_order = order
        TestRazorpayFlow.checkout_url = body["checkout_url"]

    def test_get_order_reflects_razorpay_id(self, api, user_ctx):
        order = TestRazorpayFlow.created_order
        r = api.get(f"{BASE_URL}/api/orders/{order['id']}", headers=auth_headers(user_ctx["token"]))
        assert r.status_code == 200
        got = r.json()
        assert got["razorpay_order_id"] == order["razorpay_order_id"]
        assert got["amount_paise"] == order["amount_paise"]
        assert got["status"] == "created"

    # ----- checkout HTML sub-tests (kept in same class for xdist loadscope) -----
    def test_checkout_html_contains_expected_bits(self, api):
        order = TestRazorpayFlow.created_order
        r = api.get(f"{BASE_URL}/api/payments/checkout/{order['id']}")
        assert r.status_code == 200
        html = r.text
        assert EXPECTED_KEY_ID in html, "key_id missing from checkout HTML"
        assert order["razorpay_order_id"] in html, "razorpay_order_id missing from checkout HTML"
        assert "checkout.razorpay.com/v1/checkout.js" in html, "Razorpay checkout.js script tag missing"
        # Prefill fields should be in the HTML
        assert "IT7 Buyer" in html or "prefill" in html.lower()

    def test_checkout_404_for_unknown_order(self, api):
        r = api.get(f"{BASE_URL}/api/payments/checkout/nonexistent-order-xyz")
        assert r.status_code == 404

    # ----- verify signature + idempotency (same class, shared class attrs) -----
    fake_payment_id = f"pay_TEST_{uuid.uuid4().hex[:14]}"

    def _points_balance(self, api, token) -> int:
        r = api.get(f"{BASE_URL}/api/points", headers=auth_headers(token))
        assert r.status_code == 200
        return int(r.json()["balance"])

    def test_verify_missing_fields_returns_400(self, api):
        order = TestRazorpayFlow.created_order
        r = requests.post(f"{BASE_URL}/api/payments/verify?order_id={order['id']}", data={})
        assert r.status_code == 400
        assert "missing" in r.text.lower()

    def test_verify_wrong_signature_returns_400(self, api):
        order = TestRazorpayFlow.created_order
        rid = order["razorpay_order_id"]
        form = {
            "razorpay_order_id": rid,
            "razorpay_payment_id": self.fake_payment_id,
            "razorpay_signature": "0" * 64,  # obviously wrong
        }
        r = requests.post(f"{BASE_URL}/api/payments/verify?order_id={order['id']}", data=form)
        assert r.status_code == 400, r.text
        assert "invalid signature" in r.text.lower()

    def test_verify_correct_signature_marks_paid_and_awards_points(self, api, user_ctx):
        order = TestRazorpayFlow.created_order
        rid = order["razorpay_order_id"]
        sig = _hmac_sig(rid, self.fake_payment_id)
        bal_before = self._points_balance(api, user_ctx["token"])
        form = {
            "razorpay_order_id": rid,
            "razorpay_payment_id": self.fake_payment_id,
            "razorpay_signature": sig,
        }
        r = requests.post(f"{BASE_URL}/api/payments/verify?order_id={order['id']}", data=form)
        assert r.status_code == 200, r.text
        assert "payment successful" in r.text.lower()

        # Order should now be paid, history should have 'paid' entry
        r2 = api.get(f"{BASE_URL}/api/orders/{order['id']}", headers=auth_headers(user_ctx["token"]))
        assert r2.status_code == 200
        got = r2.json()
        assert got["status"] == "paid", f"Order not marked paid: {got}"
        assert got.get("payment_id") == self.fake_payment_id
        history = got.get("history", [])
        assert any(h.get("status") == "paid" for h in history), f"'paid' history entry missing: {history}"
        TestRazorpayFlow.paid_history_len = len(history)

        # Points awarded = floor(amount * 0.1)
        expected_earn = int(round(float(got["amount"]) * 0.1))
        bal_after = self._points_balance(api, user_ctx["token"])
        assert bal_after == bal_before + expected_earn, (
            f"Expected balance {bal_before}+{expected_earn}, got {bal_after}"
        )
        TestRazorpayFlow.bal_after_first = bal_after

    def test_verify_is_idempotent_on_second_call(self, api, user_ctx):
        order = TestRazorpayFlow.created_order
        rid = order["razorpay_order_id"]
        sig = _hmac_sig(rid, self.fake_payment_id)
        form = {
            "razorpay_order_id": rid,
            "razorpay_payment_id": self.fake_payment_id,
            "razorpay_signature": sig,
        }
        r = requests.post(f"{BASE_URL}/api/payments/verify?order_id={order['id']}", data=form)
        assert r.status_code == 200, r.text

        # Points balance should be unchanged
        r2 = api.get(f"{BASE_URL}/api/points", headers=auth_headers(user_ctx["token"]))
        assert r2.status_code == 200
        assert int(r2.json()["balance"]) == TestRazorpayFlow.bal_after_first, (
            "Points balance changed on 2nd verify — NOT idempotent"
        )

        # History length should be unchanged (no new 'paid' pushed)
        r3 = api.get(f"{BASE_URL}/api/orders/{order['id']}", headers=auth_headers(user_ctx["token"]))
        assert r3.status_code == 200
        got = r3.json()
        assert len(got.get("history", [])) == TestRazorpayFlow.paid_history_len, (
            f"History length changed on 2nd verify — NOT idempotent: {got.get('history')}"
        )
        paid_events = [h for h in got.get("history", []) if h.get("status") == "paid"]
        assert len(paid_events) == 1, f"Expected exactly 1 'paid' history event, got {len(paid_events)}"


# ---------- 4. Regression: existing endpoints ---------- #
class TestRegression:
    def test_products_list(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        # No _id leaks
        assert "_id" not in items[0]

    def test_categories(self, api):
        r = api.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) >= 5
        assert all("id" in c and "name" in c for c in cats)

    def test_editorials(self, api):
        r = api.get(f"{BASE_URL}/api/editorials")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_review_still_works(self, api, user_ctx, a_product):
        payload = {"rating": 5, "title": "IT7 regression", "body": "great"}
        r = api.post(
            f"{BASE_URL}/api/products/{a_product['id']}/reviews",
            json=payload, headers=auth_headers(user_ctx["token"]),
        )
        assert r.status_code == 200, r.text
        got = r.json()
        assert got["rating"] == 5
        assert "_id" not in got

    def test_mock_pay_still_works_for_legacy_orders(self, api, user_ctx, a_product):
        """mock-pay endpoint should still succeed for a fresh order (idempotent legacy path).
        Note: with real keys, new orders get a razorpay_order_id, but /mock-pay
        doesn't check that — it just marks the order paid. Still valid regression."""
        payload = {
            "items": [{"product_id": a_product["id"], "quantity": 1}],
            "shipping_address": "TEST mock-pay lane",
            "shipping_name": "IT7 Mock",
            "shipping_phone": "9998887771",
            "points_to_redeem": 0,
        }
        r = api.post(f"{BASE_URL}/api/orders/create", json=payload, headers=auth_headers(user_ctx["token"]))
        assert r.status_code == 200
        order_id = r.json()["order"]["id"]

        r2 = api.post(f"{BASE_URL}/api/orders/{order_id}/mock-pay", headers=auth_headers(user_ctx["token"]))
        assert r2.status_code == 200, r2.text
        got = r2.json()
        assert got.get("ok") is True and got.get("status") == "paid"

        # 2nd call idempotent
        r3 = api.post(f"{BASE_URL}/api/orders/{order_id}/mock-pay", headers=auth_headers(user_ctx["token"]))
        assert r3.status_code == 200
        assert r3.json().get("status") == "paid"

    def test_admin_status_transition_guardrails_still_active(self, api, admin_token, user_ctx, a_product):
        # Create + mock-pay an order to bring it to 'paid', then try invalid transition paid -> delivered
        payload = {
            "items": [{"product_id": a_product["id"], "quantity": 1}],
            "shipping_address": "TEST guardrails",
            "shipping_name": "IT7 Guard",
            "shipping_phone": "9998887772",
        }
        r = api.post(f"{BASE_URL}/api/orders/create", json=payload, headers=auth_headers(user_ctx["token"]))
        oid = r.json()["order"]["id"]
        api.post(f"{BASE_URL}/api/orders/{oid}/mock-pay", headers=auth_headers(user_ctx["token"]))

        # Invalid: paid -> delivered (must go through shipped)
        r2 = api.put(
            f"{BASE_URL}/api/admin/orders/{oid}/status",
            json={"status": "delivered"}, headers=auth_headers(admin_token),
        )
        assert r2.status_code == 400, r2.text
        assert "invalid transition" in r2.text.lower()

        # Valid: paid -> shipped
        r3 = api.put(
            f"{BASE_URL}/api/admin/orders/{oid}/status",
            json={"status": "shipped"}, headers=auth_headers(admin_token),
        )
        assert r3.status_code == 200
