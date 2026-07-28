# Garlic by Urban Nest — PRD

## Vision
A minimalist, aesthetic pastel shopping experience for home essentials, crockery, and decor curated for a young female audience. Inspired by Nestasia + Anthropologie design language.

## MVP Features
- **Onboarding** with elegant hero + custom "Garlic — BY URBAN NEST" typographic wordmark (Cormorant Garamond italic + flourish lines)
- **Auth**: signup (name/email/mobile/password) + login (email OR mobile + password), JWT-based
- **Shop Home (Nestasia-style)**:
  - Sticky brand-mark header + wishlist shortcut
  - Peach "SUMMER EDIT" promo banner
  - Round pastel category tiles (NEW, GIFTS, DINNERS, BOWLS, PLATTERS, DECOR, KITCHEN, GLASSWARE, COMFORT, COLLECTIONS)
  - "Shop by Category" grid (Dining, Kitchen, Decor, Bath, Soft Furnishing, Accessories)
  - Editorial sections (Free From Boring Dinners, Free From A Messy Kitchen, The Quiet Home) with 4-tile grids
  - Curated Collections carousel (Modern Minimalist, Banjara, Wellness, Nautical, Jungle)
  - Best Sellers grid with strike-through original prices for sale items
- **Category detail** with sticky subcategory chips (e.g. Dining → Cups, Bowls, Plates, Platters, Glassware, Dinner Sets, Table Linen)
- **Collection detail** with hero + grid
- **Gifts hub** with By Person / By Occasion toggle + pastel filter chips
- **Product detail** with image gallery, sticky Add-to-Cart, wishlist toggle
- **Cart**: quantity control, remove, live subtotal + shipping
- **Checkout**: shipping form + Razorpay hosted checkout (WebView) with automatic mock fallback when keys are missing
- **Orders**: user history with status badges (Pending / Confirmed / Shipped / Delivered / Cancelled)
- **Wishlist**: authenticated favorites synced to backend
- **Admin panel**:
  - Products CRUD with full schema (category, subcategory, price, original_price, collection, gift_persons[], gift_occasions[], images, material, dimensions, stock, featured)
  - Orders view + status management (created → paid → shipped → delivered → cancelled)
  - Editorial sections editable via API (admin/editorials endpoints)

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
