# Garlic by Urban Nest — PRD

## Vision
A minimalist, aesthetic pastel shopping experience for home essentials, crockery, and decor curated for a young female audience. Inspired by Nestasia + Anthropologie design language.

## Personalization — Nest Concierge
- `interactions` collection logs {view, cart_add, wishlist, shortlist_add, review} events with weights 1/3/4/5/6
- `GET /api/recommendations` aggregates user's top subcategory / category / collection affinities and returns products in those buckets that they haven't seen yet
- Cold start (no interactions) → featured products
- Shop home "Curated for You" carousel (auth users only)
- Indexes: `interactions(user_id, created_at desc)`, `reviews(product_id)`, `reviews(product_id, user_id) unique`

## Polish (Iteration 5)
- Regex escape on `?q=` search (ReDoS hardening)
- Product list now includes `average_rating` + `review_count` via `$lookup` (no N+1)
- Points refunded automatically when admin sets order → `cancelled`

## MVP Features
- **Onboarding** with elegant hero + custom "Garlic — BY URBAN NEST" typographic wordmark
- **Auth**: signup + login (email OR mobile + password), JWT-based
- **Shop Home (Nestasia-style)**:
  - Header with logo + **search shortcut** + wishlist
  - Peach "SUMMER EDIT" promo banner
  - Round pastel category tiles (NEW, GIFTS, DINNERS, BOWLS, PLATTERS, DECOR, KITCHEN, GLASSWARE, COMFORT, COLLECTIONS)
  - Category grid, Editorial sections (3), Curated Collections, Best Sellers
- **Search screen** with live debounced results
- **Category/Collection detail** pages
- **Gifts hub** with By Person / By Occasion
- **Product detail** with image gallery, sticky Add-to-Cart, wishlist, Add to Nest Table
  - **Star rating summary** + **Reviews section** + "Write a Review" modal (1 review per user per product, upsert)
- **The Nest Table (Gift Registry)** shareable via public link + owner earns 500 bonus pts per gift
- **Cart** + **Checkout** with **Nest Points redemption toggle** (30% cap)
- **Orders history** + **Order Detail with vertical delivery-tracking timeline** (Order Placed → Payment Confirmed → On the Way → Delivered)
- **Nest Rewards** page: hero balance card (sage green), rules explanation, transaction history (earn/spend/referral)
- **Wishlist** (auth-synced)
- **Admin panel**: Products / Orders / Editorials tabs; order status updates append to timeline; editorials inline editor

## Points Economy (Nest Rewards)
- 2% back: **10 pts per ₹100 spent** (POINTS_RATE_PER_RUPEE = 0.1)
- Redeem value: **1 pt = ₹0.10** (POINTS_REDEEM_VALUE = 0.10)
- **500 pts (₹50)** bonus when a friend marks a gift on your Nest Table (first-time only)
- Redemption capped at 30% of order subtotal
- Points spent immediately on order create; earned on paid; mock-pay idempotent

## Design System
- **Palette**: Sage green brand `#4A5F45` (from logo) + Peach/coral accent `#F5CBB6` + oat/cream neutrals
- **Fonts**: Cormorant Garamond (display, italic wordmarks) + DM Sans (body, buttons, meta)
- **Tile pastels**: Rotating rose/peach/mint/sand/lilac/sky/cream for round category chips
- **Reference**: Nestasia.in aesthetic (curated Indian home decor)

## Tech
- Frontend: Expo SDK 54, React Native, expo-router, expo-image, expo-linear-gradient, react-native-webview, custom `<BrandLogo/>` component
- Backend: FastAPI + Motor (MongoDB), JWT auth, bcrypt, Razorpay SDK 2.0
- Responsive: uses `useWindowDimensions()` for correct sizing on web preview

## Integrations
- **Razorpay** (via WebView hosted checkout, signature verify on `/api/payments/verify`) — currently MOCKED because keys unset; falls back to `/api/orders/{id}/mock-pay`

## Admin Access
- `admin@garlic.app` / `Admin@123` (mobile `9999999999`) — seeded on startup

## Data Model (products)
```
id, name, category, subcategory, price, original_price?, description,
images[], material?, dimensions?, stock, featured,
collection?, gift_persons[], gift_occasions[], created_at
```

## Seed
- 41 curated products spanning 6 parent categories × subcategories
- 5 curated collections
- 3 editorial sections
- 6 gift-person tags + 6 gift-occasion tags
- 1 admin user
