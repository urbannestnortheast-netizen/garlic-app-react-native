from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
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

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "10080"))
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
API_BASE_URL = os.environ.get("API_BASE_URL", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
ADMIN_MOBILE = os.environ.get("ADMIN_MOBILE", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

razor_client: Optional[razorpay.Client] = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        razor_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception:
        razor_client = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("garlic")

app = FastAPI(title="Garlic API")
api_router = APIRouter(prefix="/api")


# ---------- Helpers
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


# ---------- Models
class SignupIn(BaseModel):
    name: str
    email: EmailStr
    mobile: str
    password: str


class LoginIn(BaseModel):
    identifier: str
    password: str


class ProductIn(BaseModel):
    name: str
    category: str            # parent: dining|kitchen|decor|bath|soft-furnishing|accessories
    subcategory: str = ""    # e.g. cups, plates, cushions
    price: float
    original_price: Optional[float] = None
    description: str = ""
    images: List[str] = []
    material: Optional[str] = ""
    dimensions: Optional[str] = ""
    stock: int = 100
    featured: bool = False
    collection: Optional[str] = ""   # curated collection slug
    gift_persons: List[str] = []     # women, men, kids, couples...
    gift_occasions: List[str] = []   # birthday, anniversary, housewarming...


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
    points_to_redeem: int = 0
    coupon_code: str = ""
    gift_wrap: bool = False
    gift_note: str = ""


class CouponIn(BaseModel):
    code: str
    kind: str  # "percent" | "flat"
    value: float  # percent (1-100) or flat rupees
    min_order: float = 0
    max_discount: float = 0  # cap for percent coupons; 0 = no cap
    active: bool = True
    expires_at: str = ""  # ISO date string, optional


class CouponApplyIn(BaseModel):
    code: str
    subtotal: float


class OrderStatusIn(BaseModel):
    status: str


class ShortlistIn(BaseModel):
    name: str
    occasion: str = ""
    message: str = ""
    cover_image: str = ""


class ShortlistItemIn(BaseModel):
    product_id: str


class ReviewIn(BaseModel):
    rating: int
    title: str = ""
    body: str = ""
    photos: List[str] = []  # base64 or data URLs, max 3


class RedeemPointsIn(BaseModel):
    points: int = 0


class InteractionIn(BaseModel):
    product_id: str
    event: str  # view | wishlist | review | shortlist_add | cart_add


ALLOWED_EVENTS = {"view", "wishlist", "review", "shortlist_add", "cart_add"}
EVENT_WEIGHTS = {"view": 1, "cart_add": 3, "wishlist": 4, "shortlist_add": 5, "review": 6}


class EditorialTile(BaseModel):
    label: str
    image: str
    filter: dict


class EditorialSectionIn(BaseModel):
    title: str
    subtitle: str = ""
    tiles: List[dict]
    order: int = 0
    active: bool = True


ALLOWED_STATUSES = {"created", "paid", "shipped", "delivered", "cancelled"}

# Valid state transitions
STATUS_TRANSITIONS: dict = {
    "created": {"paid", "cancelled"},
    "paid": {"shipped", "cancelled"},
    "shipped": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}

POINTS_RATE_PER_RUPEE = 0.1
POINTS_REDEEM_VALUE = 0.10
GIFT_WRAP_PRICE = 49
MAX_GIFT_NOTE_LEN = 240
REFERRAL_BONUS_POINTS = 500
PHOTO_REVIEW_BONUS_POINTS = 100
MAX_REVIEW_PHOTOS = 3
# ~2MB per photo base64-encoded (base64 is ~1.33× raw bytes, so 2.7M chars ≈ 2MB raw).
MAX_REVIEW_PHOTO_CHARS = 2_800_000
MAX_REVIEW_TITLE_LEN = 120
MAX_REVIEW_BODY_LEN = 2000


# ---------- Taxonomy
CATEGORIES = [
    {
        "id": "dining", "name": "Dining",
        "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg",
        "subcategories": [
            {"id": "cups", "name": "Cups & Mugs", "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"},
            {"id": "bowls", "name": "Bowls", "image": "https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"},
            {"id": "plates", "name": "Plates", "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"},
            {"id": "platters", "name": "Platters", "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"},
            {"id": "glassware", "name": "Glassware", "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"},
            {"id": "dinner-sets", "name": "Dinner Sets", "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"},
            {"id": "table-linen", "name": "Table Linen", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
        ],
    },
    {
        "id": "kitchen", "name": "Kitchen",
        "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee",
        "subcategories": [
            {"id": "cookware", "name": "Cookware", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee"},
            {"id": "storage", "name": "Storage Jars", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
            {"id": "lunch-boxes", "name": "Lunch Boxes", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee"},
            {"id": "kitchen-tools", "name": "Kitchen Tools", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee"},
        ],
    },
    {
        "id": "decor", "name": "Decor",
        "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg",
        "subcategories": [
            {"id": "candles", "name": "Candles", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
            {"id": "vases", "name": "Vases", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"},
            {"id": "wall-decor", "name": "Wall Decor", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"},
            {"id": "lamps", "name": "Lamps", "image": "https://images.unsplash.com/photo-1609081144289-eacc3108cd03"},
            {"id": "planters", "name": "Planters", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"},
            {"id": "photo-frames", "name": "Photo Frames", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"},
        ],
    },
    {
        "id": "bath", "name": "Bath",
        "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8",
        "subcategories": [
            {"id": "bath-accessories", "name": "Accessories", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
            {"id": "organizers", "name": "Organizers", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
            {"id": "floor-mats", "name": "Floor Mats", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
        ],
    },
    {
        "id": "soft-furnishing", "name": "Soft Furnishing",
        "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80",
        "subcategories": [
            {"id": "cushions", "name": "Cushions", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"},
            {"id": "throws", "name": "Throws", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"},
            {"id": "bed-linen", "name": "Bed Linen", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"},
            {"id": "rugs", "name": "Rugs", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"},
        ],
    },
    {
        "id": "accessories", "name": "Accessories",
        "image": "https://images.unsplash.com/photo-1604578762246-41134e37f9cc",
        "subcategories": [
            {"id": "handbags", "name": "Handbags", "image": "https://images.unsplash.com/photo-1604578762246-41134e37f9cc"},
            {"id": "jewellery", "name": "Jewellery", "image": "https://images.unsplash.com/photo-1604578762246-41134e37f9cc"},
            {"id": "pouches", "name": "Pouches", "image": "https://images.unsplash.com/photo-1604578762246-41134e37f9cc"},
        ],
    },
]

COLLECTIONS = [
    {"id": "modern-minimalist", "name": "Modern Minimalist", "tagline": "Clean lines, quiet elegance", "image": "https://images.unsplash.com/photo-1609081144289-eacc3108cd03"},
    {"id": "banjara", "name": "Banjara", "tagline": "Rustic craftsmanship, bohemian soul", "image": "https://images.pexels.com/photos/7307436/pexels-photo-7307436.jpeg"},
    {"id": "wellness", "name": "Wellness Essentials", "tagline": "Soothing rituals for slow mornings", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8"},
    {"id": "nautical", "name": "Nautical", "tagline": "Coastal calm at home", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"},
    {"id": "jungle", "name": "Jungle", "tagline": "Bring the wild indoors", "image": "https://images.pexels.com/photos/7307436/pexels-photo-7307436.jpeg"},
]

GIFT_PERSONS = [
    {"id": "women", "name": "For Women"},
    {"id": "men", "name": "For Men"},
    {"id": "mom", "name": "For Mom"},
    {"id": "friend", "name": "For Friend"},
    {"id": "couples", "name": "For Couples"},
    {"id": "kids", "name": "For Kids"},
]

GIFT_OCCASIONS = [
    {"id": "birthday", "name": "Birthday"},
    {"id": "anniversary", "name": "Anniversary"},
    {"id": "housewarming", "name": "Housewarming"},
    {"id": "wedding", "name": "Wedding"},
    {"id": "diwali", "name": "Diwali"},
    {"id": "rakhi", "name": "Rakhi"},
]

# Default editorial sections (admin editable)
DEFAULT_EDITORIALS = [
    {
        "id": "boring-dinners",
        "title": "Free From Boring Dinners",
        "subtitle": "Set a table worth savouring",
        "order": 1,
        "active": True,
        "tiles": [
            {"label": "Platters", "image": "https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg", "filter": {"subcategory": "platters"}},
            {"label": "Cups & Mugs", "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d", "filter": {"subcategory": "cups"}},
            {"label": "Glassware", "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d", "filter": {"subcategory": "glassware"}},
            {"label": "Bowls", "image": "https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg", "filter": {"subcategory": "bowls"}},
        ],
    },
    {
        "id": "messy-kitchen",
        "title": "Free From A Messy Kitchen",
        "subtitle": "Storage that looks like decor",
        "order": 2,
        "active": True,
        "tiles": [
            {"label": "Lunch Boxes", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee", "filter": {"subcategory": "lunch-boxes"}},
            {"label": "Storage Jars", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8", "filter": {"subcategory": "storage"}},
            {"label": "Kitchen Tools", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee", "filter": {"subcategory": "kitchen-tools"}},
            {"label": "Cookware", "image": "https://images.unsplash.com/photo-1556185781-a47769abb7ee", "filter": {"subcategory": "cookware"}},
        ],
    },
    {
        "id": "quiet-home",
        "title": "The Quiet Home",
        "subtitle": "Soft textures, softer light",
        "order": 3,
        "active": True,
        "tiles": [
            {"label": "Candles", "image": "https://images.unsplash.com/photo-1556910633-5099dc3971e8", "filter": {"subcategory": "candles"}},
            {"label": "Vases", "image": "https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg", "filter": {"subcategory": "vases"}},
            {"label": "Cushions", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80", "filter": {"subcategory": "cushions"}},
            {"label": "Throws", "image": "https://images.unsplash.com/photo-1772797583328-f83bc3f94f80", "filter": {"subcategory": "throws"}},
        ],
    },
]

# ---------- Seed Products
SEED_PRODUCTS = [
    # DINING - Cups & Mugs
    {"name": "Sage Latte Cup", "category": "dining", "subcategory": "cups", "price": 449, "description": "Hand-thrown latte cup with a matte sage glaze.", "images": ["https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"], "material": "Stoneware", "dimensions": "300ml", "collection": "modern-minimalist", "gift_persons": ["women", "friend"], "gift_occasions": ["housewarming"], "featured": True},
    {"name": "Ivory Espresso Cup Set", "category": "dining", "subcategory": "cups", "price": 799, "description": "Set of 4 minimalist ivory espresso cups.", "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"], "material": "Porcelain", "dimensions": "80ml x 4", "collection": "modern-minimalist", "gift_persons": ["couples"], "gift_occasions": ["wedding", "anniversary"]},
    {"name": "Terracotta Mug Duo", "category": "dining", "subcategory": "cups", "price": 599, "description": "Warm terracotta mugs, ideal for cozy afternoons.", "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"], "material": "Terracotta", "dimensions": "350ml", "collection": "banjara", "gift_persons": ["mom", "friend"], "gift_occasions": ["birthday"]},

    # DINING - Bowls
    {"name": "Pastel Bowl Trio", "category": "dining", "subcategory": "bowls", "price": 899, "description": "A trio of pastel ceramic bowls for salads, soups, and desserts.", "images": ["https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"], "material": "Ceramic", "dimensions": "5 in", "collection": "modern-minimalist", "gift_persons": ["women"], "gift_occasions": ["housewarming"]},
    {"name": "Rustic Ramen Bowls", "category": "dining", "subcategory": "bowls", "price": 1199, "description": "Handmade ramen bowls with an earthy speckled glaze.", "images": ["https://images.pexels.com/photos/7674572/pexels-photo-7674572.jpeg"], "material": "Stoneware", "dimensions": "8 in", "collection": "banjara"},

    # DINING - Plates
    {"name": "Oat Dinner Plate", "category": "dining", "subcategory": "plates", "price": 549, "description": "Oat-toned wide rim dinner plate.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Ceramic", "dimensions": "11 in", "collection": "modern-minimalist"},
    {"name": "Fluted Salad Plate", "category": "dining", "subcategory": "plates", "price": 399, "description": "Fluted rim salad plate with a delicate soft edge.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Stoneware", "dimensions": "8 in"},
    {"name": "Muted Coral Side Plates", "category": "dining", "subcategory": "plates", "price": 899, "description": "Set of 4 side plates in muted coral.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Ceramic", "dimensions": "7 in x 4", "featured": True, "gift_persons": ["couples"], "gift_occasions": ["wedding"]},

    # DINING - Platters
    {"name": "Marble Serving Platter", "category": "dining", "subcategory": "platters", "price": 1499, "description": "Statement marble serving platter for cheese and charcuterie.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Marble", "dimensions": "14 in", "featured": True, "collection": "modern-minimalist", "gift_persons": ["couples", "mom"], "gift_occasions": ["housewarming", "anniversary"]},
    {"name": "Wooden Cheese Board", "category": "dining", "subcategory": "platters", "price": 999, "description": "Rustic acacia cheese board with handle.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Acacia Wood", "dimensions": "18 in", "collection": "banjara"},

    # DINING - Glassware
    {"name": "Fluted Champagne Flutes", "category": "dining", "subcategory": "glassware", "price": 1299, "description": "Set of 2 fluted champagne flutes.", "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"], "material": "Crystal", "dimensions": "180ml x 2", "collection": "modern-minimalist", "gift_persons": ["couples"], "gift_occasions": ["anniversary", "wedding"], "featured": True},
    {"name": "Amber Tumblers", "category": "dining", "subcategory": "glassware", "price": 799, "description": "Vintage-inspired amber tumbler set.", "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d"], "material": "Glass", "dimensions": "300ml x 4", "collection": "banjara"},

    # DINING - Dinner Sets
    {"name": "Blush Rose Dinner Set", "category": "dining", "subcategory": "dinner-sets", "price": 2999, "original_price": 3999, "description": "Complete 16-piece dinner set in blush rose.", "images": ["https://images.pexels.com/photos/6611494/pexels-photo-6611494.jpeg"], "material": "Bone China", "dimensions": "16 pieces", "featured": True, "gift_persons": ["couples", "women"], "gift_occasions": ["wedding", "housewarming"]},

    # DINING - Table Linen
    {"name": "Linen Table Runner", "category": "dining", "subcategory": "table-linen", "price": 749, "description": "Softened linen table runner in oat.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Linen", "dimensions": "72 x 14 in", "collection": "modern-minimalist"},
    {"name": "Cotton Napkin Set", "category": "dining", "subcategory": "table-linen", "price": 599, "description": "Set of 6 dyed cotton napkins.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Cotton", "dimensions": "18 in x 6"},

    # KITCHEN - Cookware
    {"name": "Blush Electric Kettle", "category": "kitchen", "subcategory": "cookware", "price": 3499, "description": "1.7L kettle in blush pink with matte finish.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Stainless Steel", "dimensions": "1.7L"},
    {"name": "Sage Stand Mixer", "category": "kitchen", "subcategory": "cookware", "price": 12999, "description": "Powerful stand mixer with 10 speeds.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Die Cast", "dimensions": "5 qt", "featured": True, "gift_persons": ["couples"], "gift_occasions": ["wedding"]},
    {"name": "Cream Cast Iron Pot", "category": "kitchen", "subcategory": "cookware", "price": 4999, "description": "Enamelled cast iron dutch oven.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Cast Iron", "dimensions": "5 qt", "collection": "modern-minimalist"},

    # KITCHEN - Storage
    {"name": "Fluted Storage Jar Trio", "category": "kitchen", "subcategory": "storage", "price": 1299, "description": "Set of 3 fluted glass storage jars.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Glass", "dimensions": "Small/Med/Large", "featured": True, "collection": "modern-minimalist"},
    {"name": "Ceramic Canister Set", "category": "kitchen", "subcategory": "storage", "price": 1899, "description": "Set of 4 ceramic canisters with wood lids.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Ceramic & Acacia", "dimensions": "4 pieces"},

    # KITCHEN - Lunch Boxes
    {"name": "Bento Lunch Box", "category": "kitchen", "subcategory": "lunch-boxes", "price": 799, "description": "Leakproof bento with 3 compartments.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "BPA-free", "dimensions": "800ml", "gift_persons": ["kids", "friend"]},

    # KITCHEN - Tools
    {"name": "Acacia Utensil Set", "category": "kitchen", "subcategory": "kitchen-tools", "price": 999, "description": "Set of 5 acacia wood cooking utensils.", "images": ["https://images.unsplash.com/photo-1556185781-a47769abb7ee"], "material": "Acacia Wood", "dimensions": "5 pieces"},

    # DECOR - Candles
    {"name": "Aromatic Candle - Fig & Cedar", "category": "decor", "subcategory": "candles", "price": 899, "description": "Slow burning soy candle.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Soy Wax, Ceramic", "dimensions": "8 oz", "featured": True, "collection": "wellness", "gift_persons": ["women", "friend"], "gift_occasions": ["birthday", "housewarming"]},
    {"name": "Rose Petal Candle", "category": "decor", "subcategory": "candles", "price": 649, "description": "Delicate rose scented soy candle.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Soy Wax", "dimensions": "6 oz", "collection": "wellness"},

    # DECOR - Vases
    {"name": "Minimalist Vase", "category": "decor", "subcategory": "vases", "price": 1299, "description": "Slim minimalist vase in soft ivory.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Ceramic", "dimensions": "14 in", "collection": "modern-minimalist"},
    {"name": "Bud Vase Set", "category": "decor", "subcategory": "vases", "price": 899, "description": "Set of 3 pastel bud vases.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Glass", "dimensions": "6-8 in x 3"},

    # DECOR - Wall Decor
    {"name": "Woven Wall Basket", "category": "decor", "subcategory": "wall-decor", "price": 999, "description": "Handwoven wall basket.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Seagrass", "dimensions": "16 in", "collection": "banjara"},

    # DECOR - Lamps
    {"name": "Bouclé Table Lamp", "category": "decor", "subcategory": "lamps", "price": 3499, "description": "Warm ambient table lamp with bouclé shade.", "images": ["https://images.unsplash.com/photo-1609081144289-eacc3108cd03"], "material": "Bouclé, Brass", "dimensions": "18 in", "featured": True, "collection": "modern-minimalist"},

    # DECOR - Planters
    {"name": "Scalloped Ceramic Planter", "category": "decor", "subcategory": "planters", "price": 799, "description": "Scalloped edge planter in soft peach.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Ceramic", "dimensions": "6 in"},
    {"name": "Terrazzo Planter", "category": "decor", "subcategory": "planters", "price": 1199, "description": "Modern terrazzo planter for a bold statement.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Terrazzo", "dimensions": "8 in", "collection": "jungle"},

    # DECOR - Photo Frames
    {"name": "Gold Rim Photo Frame", "category": "decor", "subcategory": "photo-frames", "price": 599, "description": "Elegant gold rim photo frame.", "images": ["https://images.pexels.com/photos/27544697/pexels-photo-27544697.jpeg"], "material": "Metal, Glass", "dimensions": "5x7 in", "gift_persons": ["couples", "friend"], "gift_occasions": ["anniversary", "wedding"]},

    # BATH
    {"name": "Ceramic Soap Dispenser", "category": "bath", "subcategory": "bath-accessories", "price": 599, "description": "Fluted ceramic soap dispenser.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Ceramic", "dimensions": "8 in", "collection": "modern-minimalist"},
    {"name": "Bath Set - 4 Piece", "category": "bath", "subcategory": "bath-accessories", "price": 1499, "description": "4-piece matching ceramic bath set.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Ceramic", "dimensions": "4 pieces", "gift_persons": ["couples"], "gift_occasions": ["housewarming"]},
    {"name": "Rattan Storage Basket", "category": "bath", "subcategory": "organizers", "price": 899, "description": "Handwoven rattan basket for bath storage.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Rattan", "dimensions": "12 in", "collection": "banjara"},
    {"name": "Cotton Bath Mat", "category": "bath", "subcategory": "floor-mats", "price": 799, "description": "Plush organic cotton bath mat.", "images": ["https://images.unsplash.com/photo-1556910633-5099dc3971e8"], "material": "Cotton", "dimensions": "24 x 36 in"},

    # SOFT FURNISHING
    {"name": "Bouclé Cushion", "category": "soft-furnishing", "subcategory": "cushions", "price": 1299, "description": "Plush bouclé cushion in ivory.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Bouclé", "dimensions": "18 x 18 in", "featured": True, "collection": "modern-minimalist"},
    {"name": "Embroidered Tulip Cushion", "category": "soft-furnishing", "subcategory": "cushions", "price": 999, "description": "Cotton cushion with embroidered tulips.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Cotton", "dimensions": "18 x 18 in"},
    {"name": "Chunky Knit Throw", "category": "soft-furnishing", "subcategory": "throws", "price": 2499, "description": "Chunky knit throw in oat.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Wool", "dimensions": "50 x 60 in", "collection": "wellness", "gift_persons": ["women"], "gift_occasions": ["birthday", "housewarming"]},
    {"name": "Muslin Bedsheet Set", "category": "soft-furnishing", "subcategory": "bed-linen", "price": 3999, "description": "Muslin cotton bedsheet set in sage.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Muslin Cotton", "dimensions": "Queen", "collection": "modern-minimalist", "gift_persons": ["couples"], "gift_occasions": ["wedding"]},
    {"name": "Boho Handwoven Rug", "category": "soft-furnishing", "subcategory": "rugs", "price": 5999, "description": "Handwoven boho rug in neutral tones.", "images": ["https://images.unsplash.com/photo-1772797583328-f83bc3f94f80"], "material": "Wool, Cotton", "dimensions": "6 x 8 ft", "collection": "banjara", "featured": True},

    # ACCESSORIES
    {"name": "Canvas Tote Bag", "category": "accessories", "subcategory": "handbags", "price": 899, "description": "Everyday canvas tote in cream.", "images": ["https://images.unsplash.com/photo-1604578762246-41134e37f9cc"], "material": "Canvas", "dimensions": "15 x 14 in"},
    {"name": "Pearl Drop Earrings", "category": "accessories", "subcategory": "jewellery", "price": 1499, "description": "Delicate freshwater pearl drop earrings.", "images": ["https://images.unsplash.com/photo-1604578762246-41134e37f9cc"], "material": "Pearl, Gold-plated", "dimensions": "1 in", "gift_persons": ["women", "mom"], "gift_occasions": ["anniversary", "birthday"]},
    {"name": "Silk Makeup Pouch", "category": "accessories", "subcategory": "pouches", "price": 599, "description": "Silk-lined makeup pouch in blush.", "images": ["https://images.unsplash.com/photo-1604578762246-41134e37f9cc"], "material": "Silk", "dimensions": "8 x 5 in", "gift_persons": ["women", "friend"], "gift_occasions": ["birthday"]},
]


# ---------- Auth Routes
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
        "id": user["id"], "name": user["name"], "email": user["email"],
        "mobile": user["mobile"], "role": user.get("role", "user"),
    }
    token = create_token(user_out)
    return {"access_token": token, "user": user_out}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.delete("/auth/me")
async def delete_account(user: dict = Depends(get_current_user)):
    """Permanently deletes the user's account and all associated personal data.
    Required for Apple App Store review (5.1.1(v)).
    Keeps orders (for accounting/refund integrity) but anonymises the user_id link.
    """
    uid = user["id"]
    if user.get("role") == "admin":
        raise HTTPException(400, "Admin accounts cannot self-delete. Contact support.")

    # Remove personal collections
    await db.shortlists.delete_many({"user_id": uid})
    await db.reviews.delete_many({"user_id": uid})
    await db.interactions.delete_many({"user_id": uid})
    await db.user_points.delete_many({"user_id": uid})
    await db.wishlist.delete_many({"user_id": uid})

    # Anonymise past orders (retain for legal/accounting)
    await db.orders.update_many(
        {"user_id": uid},
        {"$set": {"user_id": f"deleted_{uuid.uuid4().hex[:12]}", "shipping_name": "[deleted]", "shipping_phone": "[deleted]"}},
    )

    # Finally delete the user record
    await db.users.delete_one({"id": uid})
    return {"ok": True, "message": "Account deleted"}


# ---------- Taxonomy Routes
@api_router.get("/categories")
async def list_categories():
    return CATEGORIES


@api_router.get("/categories/{category_id}")
async def get_category(category_id: str):
    for c in CATEGORIES:
        if c["id"] == category_id:
            return c
    raise HTTPException(404, "Category not found")


@api_router.get("/collections")
async def list_collections():
    return COLLECTIONS


@api_router.get("/gift-persons")
async def gift_persons():
    return GIFT_PERSONS


@api_router.get("/gift-occasions")
async def gift_occasions():
    return GIFT_OCCASIONS


# ---------- Products
@api_router.get("/products")
async def list_products(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    collection: Optional[str] = None,
    gift_person: Optional[str] = None,
    gift_occasion: Optional[str] = None,
    featured: Optional[bool] = None,
    q: Optional[str] = None,
):
    query: dict = {}
    if category:
        query["category"] = category
    if subcategory:
        query["subcategory"] = subcategory
    if collection:
        query["collection"] = collection
    if gift_person:
        query["gift_persons"] = gift_person
    if gift_occasion:
        query["gift_occasions"] = gift_occasion
    if featured is not None:
        query["featured"] = featured
    if q:
        # Escape user input to prevent ReDoS via regex metacharacters
        query["name"] = {"$regex": re.escape(q), "$options": "i"}

    # Aggregation pipeline — join reviews to compute avg + count in one round-trip (no N+1)
    pipeline = [
        {"$match": query},
        {"$sort": {"created_at": -1}},
        {"$limit": 500},
        {
            "$lookup": {
                "from": "reviews",
                "localField": "id",
                "foreignField": "product_id",
                "as": "_reviews",
            }
        },
        {
            "$addFields": {
                "review_count": {"$size": "$_reviews"},
                "average_rating": {
                    "$cond": [
                        {"$gt": [{"$size": "$_reviews"}, 0]},
                        {"$round": [{"$avg": "$_reviews.rating"}, 1]},
                        0.0,
                    ]
                },
            }
        },
        {"$project": {"_id": 0, "_reviews": 0}},
    ]
    items = await db.products.aggregate(pipeline).to_list(500)
    return items


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    item = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Product not found")
    summary = await _get_review_summary(product_id)
    return {**item, **summary}


@api_router.post("/products")
async def create_product(data: ProductIn, admin: dict = Depends(require_admin)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["admin_edited"] = True
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductIn, admin: dict = Depends(require_admin)):
    payload = data.model_dump()
    payload["admin_edited"] = True
    updated = await db.products.find_one_and_update(
        {"id": product_id}, {"$set": payload},
        return_document=True, projection={"_id": 0},
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


# ---------- Editorial Sections
@api_router.get("/editorials")
async def list_editorials():
    items = await db.editorials.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(20)
    return items


@api_router.get("/admin/editorials")
async def admin_list_editorials(admin: dict = Depends(require_admin)):
    items = await db.editorials.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return items


@api_router.put("/admin/editorials/{editorial_id}")
async def admin_update_editorial(editorial_id: str, data: EditorialSectionIn, admin: dict = Depends(require_admin)):
    payload = data.model_dump()
    updated = await db.editorials.find_one_and_update(
        {"id": editorial_id}, {"$set": payload},
        return_document=True, projection={"_id": 0},
    )
    if not updated:
        raise HTTPException(404, "Editorial not found")
    return updated


# ---------- Reviews
async def _get_review_summary(product_id: str) -> dict:
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0, "rating": 1}).to_list(500)
    if not reviews:
        return {"average_rating": 0.0, "review_count": 0}
    total = sum(r["rating"] for r in reviews)
    return {"average_rating": round(total / len(reviews), 1), "review_count": len(reviews)}


@api_router.get("/products/{product_id}/reviews")
async def list_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return reviews


@api_router.post("/products/{product_id}/reviews")
async def create_review(product_id: str, data: ReviewIn, user: dict = Depends(get_current_user)):
    if not (1 <= data.rating <= 5):
        raise HTTPException(400, "Rating must be 1-5")

    title = (data.title or "").strip()
    body = (data.body or "").strip()
    if len(title) > MAX_REVIEW_TITLE_LEN:
        raise HTTPException(400, f"Title must be <= {MAX_REVIEW_TITLE_LEN} characters")
    if len(body) > MAX_REVIEW_BODY_LEN:
        raise HTTPException(400, f"Review body must be <= {MAX_REVIEW_BODY_LEN} characters")

    raw_photos = list(data.photos or [])[:MAX_REVIEW_PHOTOS]
    photos: List[str] = []
    for idx, p in enumerate(raw_photos):
        if not isinstance(p, str) or not p:
            continue
        if len(p) > MAX_REVIEW_PHOTO_CHARS:
            raise HTTPException(
                413,
                f"Photo #{idx + 1} exceeds the 2MB limit. Please choose a smaller image."
            )
        photos.append(p)

    if not await db.products.find_one({"id": product_id}):
        raise HTTPException(404, "Product not found")

    # Check whether this is a first-time PHOTO review by this user on this product
    prev = await db.reviews.find_one({"product_id": product_id, "user_id": user["id"]}, {"_id": 0, "photos": 1})
    had_photos_before = bool(prev and prev.get("photos"))

    doc = {
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "rating": data.rating,
        "title": title,
        "body": body,
        "photos": photos,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.update_one(
        {"product_id": product_id, "user_id": user["id"]},
        {"$set": doc},
        upsert=True,
    )

    points_earned = 0
    if photos and not had_photos_before:
        await _award_points(
            user["id"], PHOTO_REVIEW_BONUS_POINTS, "photo_review_bonus",
            {"product_id": product_id, "review_id": doc["id"]},
        )
        points_earned = PHOTO_REVIEW_BONUS_POINTS
    return {**doc, "points_earned": points_earned}


# ---------- Points ("Nest Rewards")
async def _get_user_points_balance(user_id: str) -> int:
    doc = await db.user_points.find_one({"user_id": user_id}, {"_id": 0})
    return int(doc["balance"]) if doc else 0


async def _award_points(user_id: str, points: int, reason: str, meta: dict) -> int:
    if points <= 0:
        return await _get_user_points_balance(user_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    tx = {
        "id": str(uuid.uuid4()), "type": "earn", "amount": points,
        "reason": reason, "meta": meta, "created_at": now_iso,
    }
    await db.user_points.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": points}, "$push": {"transactions": tx}, "$setOnInsert": {"created_at": now_iso}},
        upsert=True,
    )
    return await _get_user_points_balance(user_id)


async def _spend_points(user_id: str, points: int, reason: str, meta: dict) -> int:
    if points <= 0:
        return await _get_user_points_balance(user_id)
    bal = await _get_user_points_balance(user_id)
    if points > bal:
        raise HTTPException(400, "Not enough Nest Points")
    tx = {
        "id": str(uuid.uuid4()), "type": "spend", "amount": points,
        "reason": reason, "meta": meta, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_points.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": -points}, "$push": {"transactions": tx}},
    )
    return await _get_user_points_balance(user_id)


@api_router.get("/points")
async def get_points(user: dict = Depends(get_current_user)):
    doc = await db.user_points.find_one({"user_id": user["id"]}, {"_id": 0})
    balance = int(doc["balance"]) if doc else 0
    txs = list(reversed(doc.get("transactions", []))) if doc else []
    return {
        "balance": balance,
        "value_rupees": round(balance * POINTS_REDEEM_VALUE, 2),
        "rate_per_rupee": POINTS_RATE_PER_RUPEE,
        "redeem_value": POINTS_REDEEM_VALUE,
        "transactions": txs[:50],
    }


# ---------- Nest Concierge (Personalization)
@api_router.post("/interactions")
async def log_interaction(data: InteractionIn, user: dict = Depends(get_current_user)):
    if data.event not in ALLOWED_EVENTS:
        raise HTTPException(400, "Invalid event type")
    if not await db.products.find_one({"id": data.product_id}, {"_id": 0, "id": 1}):
        raise HTTPException(400, "Product not found")
    await db.interactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": data.product_id,
        "event": data.event,
        "weight": EVENT_WEIGHTS.get(data.event, 1),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api_router.get("/recommendations")
async def recommendations(limit: int = 8, user: dict = Depends(get_current_user)):
    # Aggregate interactions into category/subcategory/collection affinity
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$sort": {"created_at": -1}},
        {"$limit": 200},
        {
            "$lookup": {
                "from": "products", "localField": "product_id", "foreignField": "id",
                "as": "product",
            }
        },
        {"$unwind": "$product"},
        {
            "$group": {
                "_id": None,
                "seen_ids": {"$addToSet": "$product_id"},
                "by_subcategory": {"$push": {"k": "$product.subcategory", "w": "$weight"}},
                "by_category": {"$push": {"k": "$product.category", "w": "$weight"}},
                "by_collection": {"$push": {"k": "$product.collection", "w": "$weight"}},
            }
        },
    ]
    agg = await db.interactions.aggregate(pipeline).to_list(1)
    if not agg:
        # Cold start: return featured products
        pipe = [
            {"$match": {"featured": True}},
            {"$sample": {"size": limit}},
            {"$project": {"_id": 0}},
        ]
        return await db.products.aggregate(pipe).to_list(limit)

    row = agg[0]
    seen = set(row.get("seen_ids", []))

    def _tally(bucket):
        totals: dict = {}
        for entry in bucket:
            key = entry.get("k") or ""
            if not key:
                continue
            totals[key] = totals.get(key, 0) + int(entry.get("w", 1))
        return totals

    subs = _tally(row.get("by_subcategory", []))
    cats = _tally(row.get("by_category", []))
    cols = _tally(row.get("by_collection", []))

    top_subs = [k for k, _ in sorted(subs.items(), key=lambda x: -x[1])[:3]]
    top_cats = [k for k, _ in sorted(cats.items(), key=lambda x: -x[1])[:3]]
    top_cols = [k for k, _ in sorted(cols.items(), key=lambda x: -x[1])[:3]]

    match: dict = {"id": {"$nin": list(seen)}}
    or_conds = []
    if top_subs: or_conds.append({"subcategory": {"$in": top_subs}})
    if top_cats: or_conds.append({"category": {"$in": top_cats}})
    if top_cols: or_conds.append({"collection": {"$in": top_cols}})
    if or_conds:
        match["$or"] = or_conds

    pipe = [
        {"$match": match},
        {"$sample": {"size": limit}},
        {"$project": {"_id": 0}},
    ]
    items = await db.products.aggregate(pipe).to_list(limit)
    if len(items) < limit:
        # Fill with featured products if we ran out
        need = limit - len(items)
        picked_ids = {p["id"] for p in items} | seen
        fill = await db.products.aggregate([
            {"$match": {"id": {"$nin": list(picked_ids)}, "featured": True}},
            {"$sample": {"size": need}},
            {"$project": {"_id": 0}},
        ]).to_list(need)
        items = items + fill
    return items


@api_router.get("/recently-viewed")
async def recently_viewed(limit: int = 10, user: dict = Depends(get_current_user)):
    """Products the user has recently 'viewed', deduplicated + hydrated in view order. Cold start returns []."""
    pipeline = [
        {"$match": {"user_id": user["id"], "event": "view"}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$product_id", "last_at": {"$first": "$created_at"}}},
        {"$sort": {"last_at": -1}},
        {"$limit": max(1, min(limit, 30))},
    ]
    rows = await db.interactions.aggregate(pipeline).to_list(30)
    ids = [r["_id"] for r in rows]
    if not ids:
        return []
    products = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(50)
    by_id = {p["id"]: p for p in products}
    return [by_id[pid] for pid in ids if pid in by_id]


# ---------- Wishlist
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


# ---------- Shortlist ("Nest Table") — shareable gift registry
def _make_slug(name: str) -> str:
    base = "".join(c.lower() if c.isalnum() else "-" for c in name).strip("-")[:24] or "nest"
    return f"{base}-{uuid.uuid4().hex[:6]}"


async def _insert_shortlist_with_unique_slug(doc: dict, max_attempts: int = 5) -> dict:
    from pymongo.errors import DuplicateKeyError
    name_base = doc["name"]
    for _ in range(max_attempts):
        try:
            await db.shortlists.insert_one(doc)
            return doc
        except DuplicateKeyError:
            doc["share_slug"] = _make_slug(name_base)
    raise HTTPException(500, "Could not allocate a unique share link, please retry.")


async def _hydrate_shortlist(sl: dict) -> dict:
    ids = sl.get("items", [])
    products = []
    if ids:
        products = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    bought = set(sl.get("bought", []))
    return {
        **sl,
        "products": [{**p, "bought": p["id"] in bought} for p in products],
        "count": len(products),
    }


@api_router.get("/shortlists")
async def list_shortlists(user: dict = Depends(get_current_user)):
    items = await db.shortlists.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    out = []
    for sl in items:
        out.append(await _hydrate_shortlist(sl))
    return out


@api_router.post("/shortlists")
async def create_shortlist(data: ShortlistIn, user: dict = Depends(get_current_user)):
    slug = _make_slug(data.name)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "owner_name": user["name"],
        "name": data.name.strip(),
        "occasion": data.occasion,
        "message": data.message,
        "cover_image": data.cover_image,
        "share_slug": slug,
        "items": [],
        "bought": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _insert_shortlist_with_unique_slug(doc)
    doc.pop("_id", None)
    return await _hydrate_shortlist(doc)


@api_router.get("/shortlists/{shortlist_id}")
async def get_shortlist(shortlist_id: str, user: dict = Depends(get_current_user)):
    sl = await db.shortlists.find_one({"id": shortlist_id, "user_id": user["id"]}, {"_id": 0})
    if not sl:
        raise HTTPException(404, "Shortlist not found")
    return await _hydrate_shortlist(sl)


@api_router.put("/shortlists/{shortlist_id}")
async def update_shortlist(shortlist_id: str, data: ShortlistIn, user: dict = Depends(get_current_user)):
    updated = await db.shortlists.find_one_and_update(
        {"id": shortlist_id, "user_id": user["id"]},
        {"$set": {
            "name": data.name.strip(),
            "occasion": data.occasion,
            "message": data.message,
            "cover_image": data.cover_image,
        }},
        return_document=True, projection={"_id": 0},
    )
    if not updated:
        raise HTTPException(404, "Shortlist not found")
    return await _hydrate_shortlist(updated)


@api_router.delete("/shortlists/{shortlist_id}")
async def delete_shortlist(shortlist_id: str, user: dict = Depends(get_current_user)):
    res = await db.shortlists.delete_one({"id": shortlist_id, "user_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Shortlist not found")
    return {"ok": True}


@api_router.post("/shortlists/{shortlist_id}/items")
async def add_shortlist_item(shortlist_id: str, data: ShortlistItemIn, user: dict = Depends(get_current_user)):
    sl = await db.shortlists.find_one({"id": shortlist_id, "user_id": user["id"]})
    if not sl:
        raise HTTPException(404, "Shortlist not found")
    if not await db.products.find_one({"id": data.product_id}):
        raise HTTPException(400, "Product not found")
    await db.shortlists.update_one(
        {"id": shortlist_id},
        {"$addToSet": {"items": data.product_id}},
    )
    updated = await db.shortlists.find_one({"id": shortlist_id}, {"_id": 0})
    return await _hydrate_shortlist(updated)


@api_router.delete("/shortlists/{shortlist_id}/items/{product_id}")
async def remove_shortlist_item(shortlist_id: str, product_id: str, user: dict = Depends(get_current_user)):
    sl = await db.shortlists.find_one({"id": shortlist_id, "user_id": user["id"]})
    if not sl:
        raise HTTPException(404, "Shortlist not found")
    await db.shortlists.update_one(
        {"id": shortlist_id},
        {"$pull": {"items": product_id, "bought": product_id}},
    )
    updated = await db.shortlists.find_one({"id": shortlist_id}, {"_id": 0})
    return await _hydrate_shortlist(updated)


@api_router.get("/shortlists/share/{share_slug}")
async def public_shortlist(share_slug: str):
    sl = await db.shortlists.find_one({"share_slug": share_slug}, {"_id": 0, "user_id": 0})
    if not sl:
        raise HTTPException(404, "Shortlist not found")
    return await _hydrate_shortlist(sl)


@api_router.post("/shortlists/share/{share_slug}/mark-bought")
async def mark_bought(share_slug: str, data: ShortlistItemIn):
    sl = await db.shortlists.find_one({"share_slug": share_slug})
    if not sl:
        raise HTTPException(404, "Shortlist not found")
    if data.product_id not in sl.get("items", []):
        raise HTTPException(400, "Product not in shortlist")
    already_bought = data.product_id in sl.get("bought", [])
    await db.shortlists.update_one(
        {"share_slug": share_slug},
        {"$addToSet": {"bought": data.product_id}},
    )
    # First-time gift on this item → award referral bonus to the shortlist owner
    if not already_bought:
        await _award_points(
            sl["user_id"], REFERRAL_BONUS_POINTS,
            "referral_gift", {"share_slug": share_slug, "product_id": data.product_id},
        )
    updated = await db.shortlists.find_one({"share_slug": share_slug}, {"_id": 0, "user_id": 0})
    return await _hydrate_shortlist(updated)


# ---------- Orders
async def _resolve_coupon(code: str, subtotal: float) -> Optional[dict]:
    """Return the coupon dict if valid + applicable, else None. Raises HTTPException on invalid."""
    if not code:
        return None
    coupon = await db.coupons.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not coupon:
        raise HTTPException(400, "Invalid coupon code")
    if not coupon.get("active", True):
        raise HTTPException(400, "This coupon is no longer active")
    exp = coupon.get("expires_at") or ""
    if exp:
        try:
            if datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                raise HTTPException(400, "This coupon has expired")
        except HTTPException:
            raise
        except Exception:
            pass  # bad date format → treat as no expiry
    min_order = float(coupon.get("min_order", 0) or 0)
    if subtotal < min_order:
        raise HTTPException(400, f"Coupon requires minimum order of ₹{int(min_order)}")
    return coupon


def _compute_coupon_discount(coupon: dict, subtotal: float) -> float:
    kind = coupon.get("kind", "flat")
    value = float(coupon.get("value", 0) or 0)
    if kind == "percent":
        disc = subtotal * (value / 100.0)
        cap = float(coupon.get("max_discount", 0) or 0)
        if cap > 0:
            disc = min(disc, cap)
    else:  # flat
        disc = value
    return round(max(0.0, min(disc, subtotal)), 2)


@api_router.post("/coupons/apply")
async def apply_coupon(data: CouponApplyIn, user: dict = Depends(get_current_user)):
    coupon = await _resolve_coupon(data.code, data.subtotal)
    if not coupon:
        raise HTTPException(400, "Invalid coupon code")
    disc = _compute_coupon_discount(coupon, data.subtotal)
    return {
        "code": coupon["code"],
        "kind": coupon["kind"],
        "value": coupon["value"],
        "discount": disc,
    }


@api_router.get("/admin/coupons")
async def admin_list_coupons(admin: dict = Depends(require_admin)):
    return await db.coupons.find({}, {"_id": 0}).sort("code", 1).to_list(500)


@api_router.post("/admin/coupons")
async def admin_create_coupon(data: CouponIn, admin: dict = Depends(require_admin)):
    code = data.code.strip().upper()
    if not code:
        raise HTTPException(400, "Code is required")
    if data.kind not in ("percent", "flat"):
        raise HTTPException(400, "Kind must be 'percent' or 'flat'")
    if data.kind == "percent" and not (0 < data.value <= 100):
        raise HTTPException(400, "Percent value must be between 0 and 100")
    if data.kind == "flat" and data.value <= 0:
        raise HTTPException(400, "Flat value must be positive")
    doc = {
        "code": code,
        "kind": data.kind,
        "value": float(data.value),
        "min_order": float(data.min_order or 0),
        "max_discount": float(data.max_discount or 0),
        "active": bool(data.active),
        "expires_at": data.expires_at or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.coupons.update_one({"code": code}, {"$set": doc}, upsert=True)
    except Exception as e:
        raise HTTPException(500, f"Could not save coupon: {e}")
    return doc


@api_router.delete("/admin/coupons/{code}")
async def admin_delete_coupon(code: str, admin: dict = Depends(require_admin)):
    r = await db.coupons.delete_one({"code": code.strip().upper()})
    if r.deleted_count == 0:
        raise HTTPException(404, "Coupon not found")
    return {"ok": True}


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
            "product_id": product["id"], "name": product["name"],
            "image": (product.get("images") or [""])[0],
            "price": product["price"], "quantity": it.quantity, "line_total": line_total,
        })

    # Apply coupon (against subtotal BEFORE points/gift-wrap)
    coupon_discount = 0.0
    coupon_summary: Optional[dict] = None
    if data.coupon_code:
        coupon = await _resolve_coupon(data.coupon_code, total)
        if coupon:
            coupon_discount = _compute_coupon_discount(coupon, total)
            coupon_summary = {
                "code": coupon["code"],
                "kind": coupon["kind"],
                "value": coupon["value"],
                "discount": coupon_discount,
            }

    # Apply redemption (against subtotal AFTER coupon)
    subtotal_after_coupon = max(0.0, total - coupon_discount)
    points_to_redeem = max(0, int(data.points_to_redeem or 0))
    if points_to_redeem > 0:
        bal = await _get_user_points_balance(user["id"])
        if points_to_redeem > bal:
            raise HTTPException(400, "Not enough Nest Points")
        # Cap redemption at 30% of order total after coupon
        max_redeemable_rupees = subtotal_after_coupon * 0.3
        max_redeemable_points = int(max_redeemable_rupees / POINTS_REDEEM_VALUE)
        points_to_redeem = min(points_to_redeem, max_redeemable_points)
    points_discount = round(points_to_redeem * POINTS_REDEEM_VALUE, 2)

    # Gift wrap add-on
    gift_wrap = bool(data.gift_wrap)
    gift_note = (data.gift_note or "").strip()[:MAX_GIFT_NOTE_LEN]
    gift_wrap_fee = GIFT_WRAP_PRICE if gift_wrap else 0

    total_discount = round(coupon_discount + points_discount, 2)
    payable = max(0.0, subtotal_after_coupon - points_discount + gift_wrap_fee)
    amount_paise = int(round(payable * 100))

    razorpay_order_id = None
    mock = False
    if razor_client and amount_paise > 0:
        try:
            ro = razor_client.order.create({
                "amount": amount_paise, "currency": "INR",
                "receipt": f"rcpt_{uuid.uuid4().hex[:12]}", "payment_capture": 1,
            })
            razorpay_order_id = ro["id"]
        except Exception as e:
            logger.error(f"Razorpay error: {e}")
            mock = True
    else:
        mock = True

    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id, "user_id": user["id"], "items": line_items,
        "shipping_address": data.shipping_address, "shipping_name": data.shipping_name,
        "shipping_phone": data.shipping_phone,
        "subtotal": total,
        "coupon": coupon_summary,
        "coupon_discount": coupon_discount,
        "points_redeemed": points_to_redeem,
        "points_discount": points_discount,
        "discount": total_discount,
        "gift_wrap": gift_wrap,
        "gift_note": gift_note if gift_wrap else "",
        "gift_wrap_fee": gift_wrap_fee,
        "amount": payable, "amount_paise": amount_paise,
        "currency": "INR", "razorpay_order_id": razorpay_order_id, "status": "created",
        "mock_payment": mock,
        "history": [{"status": "created", "at": datetime.now(timezone.utc).isoformat()}],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order_doc)
    order_doc.pop("_id", None)

    # Reserve/spend redeemed points now (will be rolled back on cancellation later if needed)
    if points_to_redeem > 0:
        await _spend_points(user["id"], points_to_redeem, "order_redemption", {"order_id": order_id})

    return {
        "order": order_doc,
        "key_id": RAZORPAY_KEY_ID or "",
        "checkout_url": f"{API_BASE_URL}/api/payments/checkout/{order_id}",
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
    if order.get("status") == "paid":
        return {"ok": True, "status": "paid"}
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": "paid", "payment_id": f"mock_{uuid.uuid4().hex[:12]}", "paid_at": now_iso},
            "$push": {"history": {"status": "paid", "at": now_iso}},
        },
    )
    # Award points on paid amount (net of discount)
    earn = int(round(float(order.get("amount", 0)) * POINTS_RATE_PER_RUPEE))
    if earn > 0:
        await _award_points(user["id"], earn, "order_earn", {"order_id": order_id})
    return {"ok": True, "status": "paid", "points_earned": earn}


@api_router.get("/admin/orders")
async def admin_list_orders(admin: dict = Depends(require_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api_router.get("/admin/analytics")
async def admin_analytics(admin: dict = Depends(require_admin)):
    """Aggregate dashboard for the admin panel:
    - Totals: users, products, orders, revenue (paid+shipped+delivered)
    - Orders by status (breakdown)
    - Top 5 selling products by units sold in paid+shipped+delivered orders
    - Low-stock items (products with stock < 5 if the `stock` field is set)
    - Recent orders (last 5)
    - Last 30 days revenue by day
    """
    from collections import defaultdict

    # Totals
    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})

    # Orders by status
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "revenue": {"$sum": "$amount"}}},
    ]
    by_status_rows = await db.orders.aggregate(status_pipeline).to_list(20)
    by_status = {r["_id"]: {"count": r["count"], "revenue": round(r.get("revenue", 0) or 0, 2)} for r in by_status_rows}

    paid_statuses = {"paid", "shipped", "delivered"}
    total_revenue = round(sum(v["revenue"] for k, v in by_status.items() if k in paid_statuses), 2)
    paid_orders_count = sum(v["count"] for k, v in by_status.items() if k in paid_statuses)

    # Top selling products (from paid+shipped+delivered orders)
    top_pipeline = [
        {"$match": {"status": {"$in": list(paid_statuses)}}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.product_id",
                "name": {"$first": "$items.name"},
                "image": {"$first": "$items.image"},
                "units_sold": {"$sum": "$items.quantity"},
                "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
            }
        },
        {"$sort": {"units_sold": -1}},
        {"$limit": 5},
    ]
    top_products = [
        {
            "product_id": r["_id"],
            "name": r.get("name"),
            "image": r.get("image"),
            "units_sold": int(r.get("units_sold", 0)),
            "revenue": round(r.get("revenue", 0) or 0, 2),
        }
        for r in await db.orders.aggregate(top_pipeline).to_list(5)
    ]

    # Low stock (only for products that have a `stock` numeric field)
    low_stock = await db.products.find(
        {"stock": {"$exists": True, "$type": "number", "$lt": 5}},
        {"_id": 0, "id": 1, "name": 1, "stock": 1, "image": 1, "images": 1},
    ).sort("stock", 1).to_list(20)
    # Normalise image field
    for p in low_stock:
        if not p.get("image"):
            p["image"] = (p.get("images") or [""])[0] if isinstance(p.get("images"), list) else ""
        p.pop("images", None)

    # Recent 5 orders
    recent = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)

    # Last 30 days revenue by day
    from datetime import timedelta as _td
    since = (datetime.now(timezone.utc) - _td(days=30)).isoformat()
    trend_pipeline = [
        {"$match": {"status": {"$in": list(paid_statuses)}, "created_at": {"$gte": since}}},
        {
            "$group": {
                "_id": {"$substrBytes": ["$created_at", 0, 10]},
                "revenue": {"$sum": "$amount"},
                "orders": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    trend = [
        {"date": r["_id"], "revenue": round(r.get("revenue", 0) or 0, 2), "orders": int(r["orders"])}
        for r in await db.orders.aggregate(trend_pipeline).to_list(60)
    ]

    return {
        "totals": {
            "users": total_users,
            "products": total_products,
            "orders": total_orders,
            "paid_orders": paid_orders_count,
            "revenue": total_revenue,
        },
        "orders_by_status": by_status,
        "top_products": top_products,
        "low_stock": low_stock,
        "recent_orders": recent,
        "revenue_trend_30d": trend,
    }


@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, data: OrderStatusIn, admin: dict = Depends(require_admin)):
    if data.status not in ALLOWED_STATUSES:
        raise HTTPException(400, f"Invalid status")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")

    current = order.get("status", "created")
    # No-op transitions are allowed silently
    if data.status != current:
        if data.status not in STATUS_TRANSITIONS.get(current, set()):
            raise HTTPException(400, f"Invalid transition: {current} → {data.status}")

    now_iso = datetime.now(timezone.utc).isoformat()
    updated = await db.orders.find_one_and_update(
        {"id": order_id},
        {
            "$set": {"status": data.status, "status_updated_at": now_iso},
            "$push": {"history": {"status": data.status, "at": now_iso}},
        },
        return_document=True, projection={"_id": 0},
    )

    # Refund redeemed points ONLY when moving from a refundable state to 'cancelled'
    # (i.e. before shipping). Cancelling after shipped/delivered does not refund.
    was_cancelled = current == "cancelled"
    refundable_prev = current in {"created", "paid"}
    if data.status == "cancelled" and not was_cancelled and refundable_prev:
        redeemed = int(order.get("points_redeemed", 0) or 0)
        if redeemed > 0:
            await _award_points(order["user_id"], redeemed, "order_refund", {"order_id": order_id})
    return updated


@api_router.get("/payments/checkout/{order_id}", response_class=HTMLResponse)
async def hosted_checkout(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if not RAZORPAY_KEY_ID or not order.get("razorpay_order_id"):
        return HTMLResponse(f"<html><body style='font-family:system-ui;padding:24px;background:#FCFBF8;'><h2>Payment Preview</h2><p>Razorpay keys not configured. Order {order_id}: ₹{order['amount']:.2f}</p></body></html>")

    # Fetch user for prefill
    u = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0, "password_hash": 0}) or {}
    prefill_name = order.get("shipping_name") or u.get("name") or ""
    prefill_phone = order.get("shipping_phone") or u.get("mobile") or ""
    prefill_email = u.get("email") or ""

    html = f"""<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'/>
<title>Garlic Checkout</title>
<style>
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#FCFBF8;color:#2C2925;padding:32px 24px;text-align:center;margin:0;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;}}
  h1{{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:28px;margin:8px 0;}}
  p.brand{{letter-spacing:3px;text-transform:uppercase;font-size:11px;color:#7A756F;margin:0 0 24px;}}
  .amt{{font-family:Georgia,serif;font-size:36px;font-weight:700;color:#4A5F45;margin:16px 0 4px;}}
  .lbl{{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7A756F;}}
  button{{background:#2C2925;color:#FCFBF8;border:0;padding:16px 40px;border-radius:999px;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;cursor:pointer;margin-top:24px;}}
  button:disabled{{opacity:0.6;}}
  .card{{background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 4px 24px rgba(0,0,0,0.06);max-width:400px;width:100%;box-sizing:border-box;}}
  .note{{font-size:12px;color:#7A756F;margin-top:16px;}}
</style>
</head>
<body>
  <div class='card'>
    <p class='brand'>Garlic by Urban Nest</p>
    <h1>Complete Your Payment</h1>
    <div class='lbl'>Total Payable</div>
    <div class='amt'>₹{order['amount']:.2f}</div>
    <button id='pay'>Pay Now</button>
    <p class='note'>Powered by Razorpay · Secure Test Mode</p>
  </div>
<script src='https://checkout.razorpay.com/v1/checkout.js'></script>
<script>
  var options = {{
    key: '{RAZORPAY_KEY_ID}',
    order_id: '{order['razorpay_order_id']}',
    amount: {order['amount_paise']},
    currency: 'INR',
    name: 'Garlic',
    description: 'Order #{order_id[:8]}',
    prefill: {{ name: {json.dumps(prefill_name)}, contact: {json.dumps(prefill_phone)}, email: {json.dumps(prefill_email)} }},
    theme: {{ color: '#4A5F45' }},
    callback_url: '{API_BASE_URL}/api/payments/verify?order_id={order_id}',
    redirect: true
  }};
  var rzp = new Razorpay(options);
  document.getElementById('pay').onclick = function(){{ rzp.open(); }};
  // Auto-open on load for smoother UX
  window.addEventListener('load', function(){{ setTimeout(function(){{ rzp.open(); }}, 300); }});
</script>
</body></html>"""
    return HTMLResponse(html)


@api_router.post("/payments/verify")
async def verify_payment(request: Request):
    form = await request.form()
    order_id = request.query_params.get("order_id")
    razorpay_order_id = form.get("razorpay_order_id")
    razorpay_payment_id = form.get("razorpay_payment_id")
    razorpay_signature = form.get("razorpay_signature")
    if not (order_id and razorpay_order_id and razorpay_payment_id and razorpay_signature):
        raise HTTPException(400, "Missing verification data")
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(500, "Razorpay not configured")
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), f"{razorpay_order_id}|{razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(400, "Invalid signature")

    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")

    # Cross-check: verify the razorpay_order_id from the callback matches the one stored on this order.
    # This prevents replaying a (order_id, signature) tuple against a different internal order.
    if order.get("razorpay_order_id") and order["razorpay_order_id"] != razorpay_order_id:
        raise HTTPException(400, "Order mismatch")

    # Idempotent: skip if already paid
    if order.get("status") != "paid":
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"id": order_id},
            {
                "$set": {"status": "paid", "payment_id": razorpay_payment_id, "paid_at": now_iso},
                "$push": {"history": {"status": "paid", "at": now_iso}},
            },
        )
        # Award reward points on the net paid amount
        earn = int(round(float(order.get("amount", 0)) * POINTS_RATE_PER_RUPEE))
        if earn > 0:
            await _award_points(order["user_id"], earn, "order_earn", {"order_id": order_id})

    return HTMLResponse(
        "<html><body style='font-family:system-ui;padding:32px;text-align:center;background:#FCFBF8;color:#2C2925;'>"
        "<h2 style='font-family:Georgia,serif;'>Payment Successful</h2>"
        "<p>Thank you for shopping with Garlic. You may close this window.</p>"
        "</body></html>"
    )


# ---------- Health
@api_router.get("/")
async def root():
    return {"app": "Garlic by Urban Nest", "status": "ok"}


# ---------- Include Router + CORS
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- Startup Seed
@app.on_event("startup")
async def seed_data():
    # Ensure unique index on shortlists.share_slug + performance indexes
    try:
        await db.shortlists.create_index("share_slug", unique=True)
        await db.reviews.create_index("product_id")
        await db.reviews.create_index([("product_id", 1), ("user_id", 1)], unique=True)
        await db.interactions.create_index([("user_id", 1), ("created_at", -1)])
    except Exception as e:
        logger.warning(f"Index create warning: {e}")

    # Admin — only seed if all required env vars are provided (no source defaults for safety)
    if ADMIN_EMAIL and ADMIN_MOBILE and ADMIN_PASSWORD:
        if not await db.users.find_one({"email": ADMIN_EMAIL}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": "Garlic Admin", "email": ADMIN_EMAIL,
                "mobile": ADMIN_MOBILE, "password_hash": hash_password(ADMIN_PASSWORD),
                "role": "admin", "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info("Seeded admin user")
    else:
        logger.warning("Admin seed skipped: ADMIN_EMAIL/ADMIN_MOBILE/ADMIN_PASSWORD not fully configured in environment")

    # Reseed products only if collection is empty or all products are original untouched seeds
    count = await db.products.count_documents({})
    admin_edited = await db.products.count_documents({"admin_edited": True})
    if count == 0 or (admin_edited == 0 and count > 0 and not await db.settings.find_one({"key": "seeded"})):
        await db.products.delete_many({})
        docs = []
        for p in SEED_PRODUCTS:
            docs.append({
                **p, "id": str(uuid.uuid4()),
                "stock": p.get("stock", 100), "featured": p.get("featured", False),
                "original_price": p.get("original_price"),
                "collection": p.get("collection", ""),
                "gift_persons": p.get("gift_persons", []),
                "gift_occasions": p.get("gift_occasions", []),
                "admin_edited": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        if docs:
            await db.products.insert_many(docs)
            await db.settings.update_one({"key": "seeded"}, {"$set": {"key": "seeded", "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
            logger.info(f"Seeded {len(docs)} products")
    else:
        logger.info(f"Skipping product reseed: {admin_edited} admin edits detected across {count} products")

    # Seed editorial sections
    await db.editorials.delete_many({})
    for e in DEFAULT_EDITORIALS:
        await db.editorials.insert_one({**e, "created_at": datetime.now(timezone.utc).isoformat()})
    logger.info(f"Seeded {len(DEFAULT_EDITORIALS)} editorial sections")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
