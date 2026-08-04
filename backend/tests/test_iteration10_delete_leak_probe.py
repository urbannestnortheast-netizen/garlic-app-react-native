"""Probe test: verify DELETE /api/auth/me actually purges wishlist + user_points.
Reads MongoDB directly to detect the plural/singular collection mismatch bug.
"""
import asyncio
import time
import uuid

import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

_F = dotenv_values("/app/frontend/.env")
_B = dotenv_values("/app/backend/.env")
BASE_URL = (_F.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
MONGO_URL = _B.get("MONGO_URL")
DB_NAME = _B.get("DB_NAME")
assert BASE_URL and MONGO_URL and DB_NAME


async def _run():
    api = requests.Session()
    api.headers.update({"Content-Type": "application/json"})

    uniq = uuid.uuid4().hex[:10]
    email = f"TEST_it10leak_{uniq}@example.com"
    mobile = "9" + str(int(time.time() * 1000))[-9:]
    r = api.post(f"{BASE_URL}/api/auth/signup", json={
        "name": "leak", "email": email, "mobile": mobile, "password": "Test@1234"
    })
    assert r.status_code in (200, 201), r.text[:200]
    user = r.json()["user"]
    tok = r.json()["access_token"]
    hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    uid = user["id"]

    # Add wishlist item
    prods = api.get(f"{BASE_URL}/api/products").json()
    pid = prods[0]["id"]
    r = api.post(f"{BASE_URL}/api/wishlist/toggle", headers=hdr, json={"product_id": pid})
    assert r.status_code == 200

    # Seed a user_points balance directly (award endpoint is internal)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.user_points.update_one(
        {"user_id": uid},
        {"$set": {"user_id": uid, "balance": 100, "transactions": []}},
        upsert=True,
    )

    assert await db.wishlist.count_documents({"user_id": uid}) == 1
    assert await db.user_points.count_documents({"user_id": uid}) == 1

    # Delete account
    r = api.delete(f"{BASE_URL}/api/auth/me", headers=hdr)
    assert r.status_code == 200, r.text[:200]

    # User record gone
    assert await db.users.count_documents({"id": uid}) == 0

    # BUG CHECKS: these MUST be 0 for a proper Apple review-compliant delete
    wishlist_leftover = await db.wishlist.count_documents({"user_id": uid})
    points_leftover = await db.user_points.count_documents({"user_id": uid})

    # Clean up so we don't pollute future runs
    await db.wishlist.delete_many({"user_id": uid})
    await db.user_points.delete_many({"user_id": uid})

    client.close()

    assert wishlist_leftover == 0, (
        f"BUG: {wishlist_leftover} wishlist doc(s) leaked after DELETE /api/auth/me. "
        "server.py:490 targets db.wishlists (plural) but the real collection is db.wishlist (singular)."
    )
    assert points_leftover == 0, (
        f"BUG: {points_leftover} user_points doc(s) leaked after DELETE /api/auth/me. "
        "server.py:489 targets db.points_history but the real collection is db.user_points."
    )


def test_delete_purges_wishlist_and_points():
    asyncio.run(_run())
