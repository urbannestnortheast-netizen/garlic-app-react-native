#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Enable live Razorpay (test mode) integration for the Garlic by Urban Nest e-commerce app.
  Credentials are stored in /app/backend/.env (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET).
  Do not commit secrets into this file.

backend:
  - task: "Razorpay live integration (test keys wired up)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: |
          - Added real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to /app/backend/.env.
          - razor_client now initializes at module load with real credentials.
          - POST /api/orders/create now returns mock=false and a real razorpay_order_id (e.g. order_TJO1VFEZckXTMa) — smoke-tested via python requests against localhost:8001.
          - GET /api/payments/checkout/{order_id} now renders a polished HTML page with the Razorpay checkout script, auto-opens the modal, prefills name/phone/email from the order+user, and posts to /api/payments/verify.
          - POST /api/payments/verify now:
              * Validates signature via HMAC-SHA256 with RAZORPAY_KEY_SECRET.
              * Is idempotent (skips update if order already paid).
              * Awards Nest Points on paid amount (was missing — bug fix).
              * Pushes a "paid" event into order.history array.
              * Returns a friendly HTML success page.

metadata:
  created_by: "main_agent"
  version: "1.7"
  test_sequence: 7
  run_ui: false

test_plan:
  current_focus:
    - "Admin Panel Phase 2 — Inventory, Customers, Reviews, Promotions"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Admin Panel Phase 2 built. Four new admin sections added + backend endpoints.

      NEW BACKEND ENDPOINTS (all admin-only in /app/backend/server.py):
      - PATCH /api/admin/products/{product_id}/stock   body: {stock: int>=0}
      - GET   /api/admin/customers                     → users with orders_count, total_spent (paid+shipped+delivered), last_order_at
      - GET   /api/admin/customers/{customer_id}       → user + orders + orders_count + total_spent + points_balance
      - GET   /api/admin/reviews                       → all reviews hydrated with product_name/product_image
      - DELETE /api/admin/reviews/{review_id}          → deletes + recomputes product's avg_rating and reviews_count

      NEW FRONTEND ROUTES:
      - /admin/inventory     — search + 4 filters (All/Low/Out/In), quick +/- stepper per product, dirty state, SAVE pill
      - /admin/customers     — search, list cards with initials avatar, orders_count + total_spent badges, last order date
      - /admin/customer/[id] — profile card with Call/Email actions, contact card, 3 stat cards (Orders/Total/Points), orders list
      - /admin/reviews       — search + 6 rating filters (All/★5/★4/★3/★1-2/Photos), review cards with stars, product tap → product edit, photos row, delete with confirm
      - /admin/promotions    — coupon list + FAB (+), each card shows discount summary/min-order/expiry/active badge; delete with confirm. Bottom-sheet form for creating coupons (code, percent/flat toggle, value, min_order, max_discount for percent, expires_at, active switch)

      MORE MENU wired up — Inventory/Customers/Reviews/Promotions now link to real screens instead of "Coming soon".

      Please regression + verify (viewport 390x844):

      BACKEND
      B1. Login as admin (admin@garlic.app / Admin@123). Hit each new endpoint via the app:
        - GET /api/admin/customers → 200, array of customers, each has `orders_count` and `total_spent` numeric.
        - GET /api/admin/customers/{customer_id} for any customer → 200, has `user`, `orders`, `orders_count`, `total_spent`, `points_balance`.
        - GET /api/admin/reviews → 200 array (may be empty). Any items should have `product_name` and `product_image` fields (hydrated).
        - PATCH /api/admin/products/{product_id}/stock with body {stock: 42} → 200, returns product with new stock.
        - PATCH with body {stock: -1} → 400 "Stock cannot be negative".
        - DELETE /api/admin/reviews/{review_id} for a real review id → 200; product's avg_rating recomputes.
      B2. Auth check: same endpoints hit without admin token → 401 or 403.

      FRONTEND
      F1. Login as admin → dashboard. Tap More tab.
      F2. Tap "Inventory" row → screen loads with product list. Filter "Low Stock" applies. Search "cushion" filters. Tap + or − on a stepper — the SAVE pill appears next to that row. Tap SAVE → row updates, badge changes. Screenshot.
      F3. Back → tap "Customers" → list loads. Tap first customer → detail loads with initials avatar, contact rows, 3 stat cards, orders list. Tap Call → on web should show alert; on native it would open dialer. Screenshot.
      F4. Back → tap "Reviews" → list loads (may be empty). If present, tap a review's product row → navigates to `/admin/product/[id]`. Back → tap Delete on a review → confirmation → confirmed → item disappears. Screenshot.
      F5. Back → tap "Promotions" → list loads (may be empty). Tap + → form sheet opens. Fill code "PHASE2", pick "% Percent", value 10, min_order 500, max_discount 200, active on. Tap Activate → sheet closes, "PHASE2" appears in list with "Active" badge. Tap Delete → confirm → row disappears. Screenshot.
      F6. Regression: dashboard still renders, orders tab still renders, product editor still saves. Bottom tab bar still shows exactly 4 tabs (Dashboard/Orders/Products/More) — no new tabs leaked.

      Please report to /app/test_reports/iteration_14.json.