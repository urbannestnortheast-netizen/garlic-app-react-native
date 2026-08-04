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
    - "Deployment readiness fixes — iOS permissions, admin-seed safety, account deletion"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Deployment agent flagged 2 blockers + 3 warnings. Fixes applied — please regression-test the affected surfaces:

      A) Backend account-deletion (NEW endpoint DELETE /api/auth/me)
         - Signup a fresh user (unique email/mobile), get token.
         - GET /api/auth/me → 200 with user.
         - Add a wishlist item, create a shortlist, post a review, place an order (mock or Razorpay flow):
             POST /api/orders/create → paid via mock-pay OR verify signature.
         - Call DELETE /api/auth/me with the user's bearer token → expect 200 {ok:true}.
         - Verify user is gone: subsequent GET /api/auth/me with same token → 401 "User not found".
         - Verify personal collections purged for that user_id: shortlists, reviews, interactions, points_history, wishlists.
         - Verify the past order still exists but user_id anonymised (starts with "deleted_") and shipping_name/phone == "[deleted]".
         - Admin cannot self-delete: login as admin (admin@garlic.app / Admin@123 — creds in /app/memory/test_credentials.md), DELETE /api/auth/me → 400 "Admin accounts cannot self-delete."

      B) Admin seed safety
         - Confirm current backend still boots cleanly (admin seed still runs because .env has ADMIN_* set — we removed only the source-code defaults, .env values are intact).
         - Confirm admin login still works: POST /api/auth/login {identifier: admin@garlic.app, password: Admin@123} → 200 with token & role=admin.

      C) Razorpay regression
         - Rerun the core Razorpay path used in iteration 7:
             POST /api/orders/create (mock:false, real order_id, key_id set)
             HMAC verify to /api/payments/verify → 200 + status paid + points award + idempotency.
         - Confirm no regressions from the API_BASE_URL / server.py env-var changes.

      D) Regression: existing endpoints unchanged
         - GET /api/products, /api/categories, /api/editorials, /api/points, POST /api/reviews/{product_id}, admin STATUS_TRANSITIONS guardrails.

      Testing type: backend only. Skip frontend UI tests.
      Report to /app/test_reports/iteration_10.json.
      Credentials file: /app/memory/test_credentials.md.
      Razorpay secret & key_id: read from /app/backend/.env — do NOT commit them into the report.