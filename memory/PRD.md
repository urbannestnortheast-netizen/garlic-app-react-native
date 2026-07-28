# Garlic by Urban Nest — PRD

## Vision
A minimalist, aesthetic pastel shopping experience for home essentials, crockery, and decor curated for a young female audience.

## MVP Features
- Onboarding hero with brand intro ("Enter the Nest")
- Auth: signup (name, email, mobile, password) + login (email OR mobile + password), JWT-based
- Shop: category chips (All / Home Essentials / Crockery / Decor / Appliance / Cups / Plates / Furniture) + featured editorials carousel + product grid
- Product detail: image gallery, description, material, dimensions, sticky Add-to-Cart, wishlist toggle
- Cart: quantity control, remove, live subtotal + shipping calculation
- Checkout: shipping form + Razorpay hosted checkout (WebView) with automatic mock fallback when keys are missing
- Orders: history with per-order status (Pending / Confirmed) and item breakdown
- Wishlist: authenticated favorites synced to backend
- Admin panel: full CRUD for products (name, category, price, images, material, dimensions, stock, featured toggle)

## Tech
- Frontend: Expo SDK 54 (React Native), expo-router file-based routes, expo-image, expo-linear-gradient, react-native-webview
- Backend: FastAPI + Motor (MongoDB), JWT auth (PyJWT), bcrypt password hashing, Razorpay SDK 2.0
- Design: Editorial Mobile LIGHT + custom pastel palette (Dusty Rose, Sage, Oat) with Cormorant Garamond + DM Sans fonts

## Integrations
- Razorpay: hosted checkout via WebView; verify signature on `/api/payments/verify`. Falls back to mock when keys unset.

## Admin Access
- Seeded admin: `admin@garlic.app` / `Admin@123` (mobile `9999999999`)
