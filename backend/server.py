from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import hmac
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import razorpay

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Env
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "10080"))
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8001")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@garlic.app")
ADMIN_MOBILE = os.environ.get("ADMIN_MOBILE", "9999999999")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")

# ---------- DB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------- Razorpay (safe init even when keys missing)
razor_client: Optional[razorpay.Client] = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        razor_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as _e:
        razor_client = None

# ---------- Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("garlic")

# ---------- App
app = FastAPI(title="Garlic API")
api_router = APIRouter(prefix="/api")


# ============= Helpers
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user.get("role", "user"),
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


# ============= Models
class SignupIn(BaseModel):
    name: str
    email: EmailStr
    mobile: str
    password: str


class LoginIn(BaseModel):
    identifier: str  # email OR mobile
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    mobile: str
    role: str


class ProductIn(BaseModel):
    name: str
    category: str
    price: float
    description: str = ""
    images: List[str] = []
    material: Optional[str] = ""
    dimensions: Optional[str] = ""
    stock: int = 100
    featured: bool = False


class ProductOut(ProductIn):
    id: str
    created_at: datetime


class WishlistToggleIn(BaseModel):
    product_id: str


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int


class CreateOrderIn(BaseModel):
    items: List[OrderItemIn]
    shipping_address: str
    shipping_name: str
    shipping_phone: str


class OrderStatusIn(BaseModel):
    status: str  # created | paid | shipped | delivered | cancelled


ALLOWED_STATUSES = {"created", "paid", "shipped", "delivered", "cancelled"}


# ============= Categories
CATEGORIES = [
    {"id": "home-essentials", "name": "Home Essentials", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
    {"id": "crockery", "name": "Crockery", "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"},
    {"id": "decor", "name": "Decor", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"},
    {"id": "appliance", "name": "Appliance", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee"},
    {"id": "cups", "name": "Cups", "image": "https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"},
    {"id": "plates", "name": "Plates", "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"},
    {"id": "furniture", "name": "Furniture", "image": "https://images.unsplash.com/photo-1604578762246-41134e37f9cc"},
]


# ============= Seed Products
SEED_PRODUCTS = [
    # Crockery
    {"name": "Handcrafted Ceramic Plate Set", "category": "crockery", "price": 1499, "description": "Set of 4 handcrafted ceramic dinner plates in muted pastel tones. Kiln-fired for lasting elegance.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg", "https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"], "material": "Stoneware Ceramic", "dimensions": "10 in diameter", "featured": True},
    {"name": "Pastel Bowl Trio", "category": "crockery", "price": 899, "description": "A trio of pastel ceramic bowls for salads, soups, and desserts.", "images": ["https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"], "material": "Ceramic", "dimensions": "5 in diameter"},
    {"name": "Blush Rose Dinner Set", "category": "crockery", "price": 2999, "description": "A complete 16-piece dinner set in blush rose. Dishwasher safe and microwave friendly.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Bone China", "dimensions": "16 pieces", "featured": True},

    # Cups
    {"name": "Sage Latte Cup", "category": "cups", "price": 449, "description": "Hand-thrown latte cup with a matte sage glaze. Perfect for slow mornings.", "images": ["https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"], "material": "Stoneware", "dimensions": "300ml"},
    {"name": "Ivory Espresso Cup Set", "category": "cups", "price": 799, "description": "Set of 4 minimalist ivory espresso cups with matching saucers.", "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"], "material": "Porcelain", "dimensions": "80ml x 4"},
    {"name": "Terracotta Mug Duo", "category": "cups", "price": 599, "description": "Warm terracotta mugs, ideal for cozy afternoons.", "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"], "material": "Terracotta", "dimensions": "350ml"},

    # Plates
    {"name": "Oat Dinner Plate", "category": "plates", "price": 549, "description": "Oat-toned wide rim dinner plate, elegant and understated.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Ceramic", "dimensions": "11 in"},
    {"name": "Fluted Salad Plate", "category": "plates", "price": 399, "description": "Fluted rim salad plate with a delicate soft edge.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Stoneware", "dimensions": "8 in"},
    {"name": "Muted Coral Side Plates", "category": "plates", "price": 899, "description": "Set of 4 side plates in muted coral. Everyday luxury.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Ceramic", "dimensions": "7 in x 4", "featured": True},

    # Decor
    {"name": "Pastel Cone Sculpture", "category": "decor", "price": 1899, "description": "Modern pastel cone sculpture for shelf styling.", "images": ["https://images.pexels.com/photos/7307436/pexels-photo-7307436.jpeg"], "material": "Resin", "dimensions": "12 in", "featured": True},
    {"name": "Minimalist Vase", "category": "decor", "price": 1299, "description": "Slim minimalist vase in soft ivory finish.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Ceramic", "dimensions": "14 in"},
    {"name": "Woven Wall Basket", "category": "decor", "price": 999, "description": "Handwoven wall basket for effortless warmth.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Seagrass", "dimensions": "16 in"},

    # Home Essentials
    {"name": "Linen Table Runner", "category": "home-essentials", "price": 749, "description": "Softened linen table runner in oat, hand-stitched hem.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "100% Linen", "dimensions": "72 x 14 in"},
    {"name": "Cotton Napkin Set", "category": "home-essentials", "price": 599, "description": "Set of 6 dyed cotton napkins in a rotating pastel palette.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Cotton", "dimensions": "18 x 18 in x 6"},
    {"name": "Aromatic Candle - Fig & Cedar", "category": "home-essentials", "price": 899, "description": "Slow burning soy candle in a hand-poured ceramic vessel.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Soy Wax, Ceramic", "dimensions": "8 oz", "featured": True},

    # Appliance
    {"name": "Blush Electric Kettle", "category": "appliance", "price": 3499, "description": "1.7L rapid boil kettle in blush pink with matte finish.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Stainless Steel", "dimensions": "1.7L"},
    {"name": "Sage Stand Mixer", "category": "appliance", "price": 12999, "description": "Powerful stand mixer with 10 speeds. Baker's essential.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Die Cast", "dimensions": "5 qt", "featured": True},
    {"name": "Cream Toaster", "category": "appliance", "price": 2499, "description": "4-slice wide slot toaster in cream. 6 browning settings.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Stainless Steel", "dimensions": "4 slice"},

    # Furniture
    {"name": "Oak Side Table", "category": "furniture", "price": 8999, "description": "Solid oak minimalist side table with rounded edges.", "images": ["https://images.unsplash.com/photo-1604578762246-41134e37f9cc"], "material": "Solid Oak", "dimensions": "20 x 20 x 22 in", "featured": True},
    {"name": "Cane Accent Chair", "category": "furniture", "price": 14999, "description": "Handwoven cane back accent chair in a natural finish.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Cane, Solid Wood", "dimensions": "30 x 32 in"},
    {"name": "Bouclé Ottoman", "category": "furniture", "price": 6999, "description": "Plush bouclé ottoman in soft ivory.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Bouclé", "dimensions": "18 in round"},
]


# ============= Routes: Auth
@api_router.post("/auth/signup")
async def signup(data: SignupIn):
    email = data.email.lower().strip()
    mobile = data.mobile.strip()
    if await db.users.find_one({"$or": [{"email": email}, {"mobile": mobile}]}):
        raise HTTPException(400, "Email or mobile already registered")
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": email,
        "mobile": mobile,
        "password_hash": hash_password(data.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    user_out = {k: v for k, v in user_doc.items() if k not in ("_id", "password_hash", "created_at")}
    token = create_token(user_out)
    return {"access_token": token, "user": user_out}


@api_router.post("/auth/login")
async def login(data: LoginIn):
    ident = data.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"email": ident}, {"mobile": data.identifier.strip()}]})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    user_out = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "mobile": user["mobile"],
        "role": user.get("role", "user"),
    }
    token = create_token(user_out)
    return {"access_token": token, "user": user_out}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ============= Routes: Categories
@api_router.get("/categories")
async def list_categories():
    return CATEGORIES


# ============= Routes: Products
@api_router.get("/products")
async def list_products(category: Optional[str] = None, featured: Optional[bool] = None, q: Optional[str] = None):
    query: dict = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["featured"] = featured
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    items = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    item = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Product not found")
    return item


@api_router.post("/products")
async def create_product(data: ProductIn, admin: dict = Depends(require_admin)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductIn, admin: dict = Depends(require_admin)):
    updated = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0},
    )
    if not updated:
        raise HTTPException(404, "Product not found")
    return updated


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": product_id})
    if not res.deleted_count:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


# ============= Routes: Wishlist
@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    ids = await db.wishlist.find({"user_id": user["id"]}, {"_id": 0, "product_id": 1}).to_list(500)
    pids = [x["product_id"] for x in ids]
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0}).to_list(500)
    return products


@api_router.post("/wishlist/toggle")
async def toggle_wishlist(data: WishlistToggleIn, user: dict = Depends(get_current_user)):
    existing = await db.wishlist.find_one({"user_id": user["id"], "product_id": data.product_id})
    if existing:
        await db.wishlist.delete_one({"user_id": user["id"], "product_id": data.product_id})
        return {"in_wishlist": False}
    await db.wishlist.insert_one({"user_id": user["id"], "product_id": data.product_id, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"in_wishlist": True}


# ============= Routes: Orders + Payment
@api_router.post("/orders/create")
async def create_order(data: CreateOrderIn, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(400, "Cart is empty")
    total = 0.0
    line_items = []
    for it in data.items:
        product = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(400, f"Product not found: {it.product_id}")
        line_total = float(product["price"]) * it.quantity
        total += line_total
        line_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "image": (product.get("images") or [""])[0],
            "price": product["price"],
            "quantity": it.quantity,
            "line_total": line_total,
        })
    amount_paise = int(round(total * 100))

    razorpay_order_id = None
    razorpay_key_id_out = RAZORPAY_KEY_ID or ""
    mock = False
    if razor_client:
        try:
            ro = razor_client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"rcpt_{uuid.uuid4().hex[:12]}",
                "payment_capture": 1,
            })
            razorpay_order_id = ro["id"]
        except Exception as e:
            logger.error(f"Razorpay error: {e}")
            mock = True
    else:
        mock = True

    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "user_id": user["id"],
        "items": line_items,
        "shipping_address": data.shipping_address,
        "shipping_name": data.shipping_name,
        "shipping_phone": data.shipping_phone,
        "amount": total,
        "amount_paise": amount_paise,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "status": "created",
        "mock_payment": mock,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order_doc)
    order_doc.pop("_id", None)

    checkout_url = f"{API_BASE_URL}/api/payments/checkout/{order_id}"
    return {
        "order": order_doc,
        "key_id": razorpay_key_id_out,
        "checkout_url": checkout_url,
        "mock": mock,
    }


@api_router.get("/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    items = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@api_router.post("/orders/{order_id}/mock-pay")
async def mock_pay(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "paid", "payment_id": f"mock_{uuid.uuid4().hex[:12]}", "paid_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "status": "paid"}


# ============= Admin: Orders
@api_router.get("/admin/orders")
async def admin_list_orders(admin: dict = Depends(require_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, data: OrderStatusIn, admin: dict = Depends(require_admin)):
    if data.status not in ALLOWED_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {sorted(ALLOWED_STATUSES)}")
    updated = await db.orders.find_one_and_update(
        {"id": order_id},
        {"$set": {"status": data.status, "status_updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    if not updated:
        raise HTTPException(404, "Order not found")
    return updated


@api_router.get("/payments/checkout/{order_id}", response_class=HTMLResponse)
async def hosted_checkout(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if not RAZORPAY_KEY_ID or not order.get("razorpay_order_id"):
        return HTMLResponse(
            f"""<!doctype html><html><body style='font-family:system-ui;padding:24px;background:#FCFBF8;color:#2C2925;'>
<h2>Payment Preview</h2>
<p>Razorpay keys not configured. This is a mock checkout for Order <b>{order_id}</b>.</p>
<p>Amount: ₹{order['amount']:.2f}</p>
<p>Return to the app to complete a mock payment.</p>
</body></html>"""
        )
    return HTMLResponse(f"""<!doctype html>
<html><head><meta name='viewport' content='width=device-width,initial-scale=1'/><title>Pay</title>
<style>body{{font-family:system-ui;background:#FCFBF8;color:#2C2925;padding:24px;text-align:center}}
button{{background:#D4A5A5;color:#2C2925;border:0;padding:14px 24px;border-radius:999px;font-size:16px;}}</style></head>
<body>
<h2>Complete Your Payment</h2>
<p>Order ₹{order['amount']:.2f}</p>
<button id='pay'>Pay Now</button>
<script src='https://checkout.razorpay.com/v1/checkout.js'></script>
<script>
document.getElementById('pay').onclick=function(){{
  var o={{
    key:'{RAZORPAY_KEY_ID}',
    order_id:'{order['razorpay_order_id']}',
    amount:{order['amount_paise']},
    currency:'INR',
    name:'Garlic by Urban Nest',
    description:'Order {order_id[:8]}',
    callback_url:'{API_BASE_URL}/api/payments/verify?order_id={order_id}',
    redirect:true,
    theme:{{color:'#D4A5A5'}}
  }};
  new Razorpay(o).open();
}};
</script></body></html>""")


@api_router.post("/payments/verify")
async def verify_payment(request: Request):
    form = await request.form()
    order_id = request.query_params.get("order_id")
    razorpay_order_id = form.get("razorpay_order_id")
    razorpay_payment_id = form.get("razorpay_payment_id")
    razorpay_signature = form.get("razorpay_signature")
    if not (order_id and razorpay_order_id and razorpay_payment_id and razorpay_signature):
        raise HTTPException(400, "Missing verification data")
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(400, "Invalid signature")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "paid", "payment_id": razorpay_payment_id, "paid_at": datetime.now(timezone.utc).isoformat()}},
    )
    return HTMLResponse("<html><body style='font-family:system-ui;padding:24px;text-align:center;background:#FCFBF8;'><h2>Payment Successful</h2><p>You can return to the Garlic app.</p></body></html>")


# ============= Health
@api_router.get("/")
async def root():
    return {"app": "Garlic by Urban Nest", "status": "ok"}


# ============= Include Router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= Startup: seed admin + products
@app.on_event("startup")
async def seed_data():
    # Seed admin
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Garlic Admin",
            "email": ADMIN_EMAIL,
            "mobile": ADMIN_MOBILE,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user")

    # Seed products only if empty
    count = await db.products.count_documents({})
    if count == 0:
        docs = []
        for p in SEED_PRODUCTS:
            docs.append({
                **p,
                "id": str(uuid.uuid4()),
                "stock": p.get("stock", 100),
                "featured": p.get("featured", False),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        if docs:
            await db.products.insert_many(docs)
            logger.info(f"Seeded {len(docs)} products")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
