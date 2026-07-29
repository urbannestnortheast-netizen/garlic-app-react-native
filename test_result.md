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
  User provided:
    RAZORPAY_KEY_ID = rzp_test_TJNt4zJB9d9bpu
    RAZORPAY_KEY_SECRET = E2QTv6G6CipaxHMtBMGBmBJE

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
    - "Razorpay live integration (test keys wired up)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Please backend-test the Razorpay integration end-to-end.
      1. Login as admin (admin@garlic.app / Admin@123) OR create/register a new user.
      2. POST /api/orders/create with a valid product → expect:
           - HTTP 200
           - response.mock == false
           - response.order.razorpay_order_id matches ^order_[A-Za-z0-9]+$
           - response.key_id == "rzp_test_TJNt4zJB9d9bpu"
           - response.checkout_url points to /api/payments/checkout/{order_id}
      3. GET the checkout_url and confirm the HTML contains:
           - the key_id string
           - the razorpay_order_id string
           - checkout.razorpay.com/v1/checkout.js script tag
      4. Simulate a payment signature and POST /api/payments/verify:
           - With WRONG signature → expect HTTP 400 "Invalid signature".
           - With CORRECT HMAC-SHA256 signature of "{razorpay_order_id}|{fake_payment_id}" using the real secret → expect HTTP 200 HTML "Payment Successful", and:
             * order.status transitions to "paid"
             * order.history contains a "paid" event
             * user's Nest Points balance increases by floor(amount * POINTS_RATE_PER_RUPEE)
             * repeating the same verify call is idempotent (no double point award, no duplicate history entry) — points balance and history length stay the same on 2nd call.
      5. Regression: existing endpoints must still function
           - GET /api/products, /api/categories, /api/editorials
           - POST /api/reviews/{product_id}
           - POST /api/orders/{order_id}/mock-pay (should still work if razorpay_order_id is missing / for legacy orders — but for orders created now, real Razorpay path is taken)
           - Admin order status transitions guardrails still active.
      Skip frontend testing for this iteration.