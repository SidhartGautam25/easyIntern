# EzyIntern Client Migration & Integration Plan

This document outlines the modifications, changes, new design patterns, and architecture of the React client (`easyintern`) to seamlessly interface with our migrated Koa backend.

---

## 1. Core Architectural Changes

### A. Centralized Backend API Client (`src/lib/apiClient.ts`)
Instead of direct Supabase client database writes (which are prone to permission/rules security issues and do not trigger worker queues), the frontend will transition to using a unified backend API client.
- **Base URL Routing**: Read from a new environment variable `VITE_BACKEND_URL` (e.g. `http://localhost:5000` in dev).
- **Session Header Injection**: Automatically extract the JWT token from `supabase.auth.getSession()` and inject it as `Authorization: Bearer <token>` in the request headers for authenticated routes.

### B. Enforced Order-to-Verification Checkout
Legacy "browser-only" checkout (where Razorpay payments were captured instantly without order verification) will be retired:
1. **Order Creation**: Client hits `/payment/create-order` with the student registration JSON payload.
2. **Order Cache**: The backend creates a secure order on Razorpay and caches student metadata in Redis.
3. **Overlay & Capture**: The client opens the Razorpay modal bound to the `order_id`.
4. **Signature Verification**: Once completed, the client sends the verification signature to `/payment/verify`.

### C. Async Fulfillment Polling (`src/hooks/useEnrollmentStatus.ts`)
Because enrollment is offloaded to a BullMQ worker (`EnrollmentWorker`), verification does not instantly return the student account credentials.
- **Design**: Once `/payment/verify` confirms the signature is valid, the client displays a loader page ("Completing enrollment...") and polls `/payment/status/:orderId` every 2 seconds.
- **Completion**: When the endpoint returns `{ status: "fulfilled", registrationId: "EZY/..." }`, the loader resolves, and the student's registration ID and generated credentials are displayed.

---

## 2. Page and Component Modifications

### `easyintern/src/lib/paymentApi.ts`
- **Current**: Tries legacy Vercel routes `/api/payment/...` or calls Supabase Edge Functions.
- **Change**: Target the new Koa payment endpoints exclusively:
  - `POST /payment/create-order`
  - `POST /payment/verify`
  - `GET /payment/status/:orderId` (New)

### `easyintern/src/lib/registrationPayment.ts`
- **Current**: Has logic for both `ORDER_API_ENABLED = false` (legacy) and `true`.
- **Change**: Make order-based payments mandatory. Remove all legacy fallbacks to prevent security bypasses.
- Integrate the polling helper post-verification.

### `easyintern/src/components/RegistrationForm.tsx`
- **Change**: Enhance Step 5 (Payment Confirmation). When a payment is made, show a dynamic progress tracker showing the current background processing step:
  - 🔄 Verifying Payment...
  - 🔄 Creating Student Account...
  - 🔄 Generating Enrollment Documents...
  - ✅ Account Ready!

### `easyintern/src/pages/StaffDashboard.tsx` & `Admin.tsx`
- **Current**: Invokes Supabase API to create sub-users, send single/bulk notifications, and sign out users.
- **Change**: Call the backend Koa admin routes:
  - `POST /admin/register` (For manual student registration by staff)
  - `POST /admin/tasks` (For sub-user creation, role assignment, permissions, and force logouts)
  - `POST /admin/send-mail` (For single notifications/certificates)
  - `POST /admin/send-bulk-mail` (For mass announcements)

---

## 3. Configuration & Deployment

### `.env` Updates
Add the following to `/easyintern/.env`:
```ini
# Address of the stateful Koa backend
VITE_BACKEND_URL=http://localhost:5000

# Require server-side verification and order tracking
VITE_REGISTRATION_USE_ORDER_API=true
```

---

## 4. Migration Execution Checklist

- [ ] 1. Add `VITE_BACKEND_URL` to client `.env` files.
- [ ] 2. Create `src/lib/apiClient.ts` to manage backend requests with session headers.
- [ ] 3. Refactor `paymentApi.ts` to route requests to the Koa server.
- [ ] 4. Force order-based checkout in `registrationPayment.ts`.
- [ ] 5. Implement `/payment/status/:orderId` polling logic inside the registration/payment flow.
- [ ] 6. Update Admin and Staff page actions to direct operations to the Koa backend `/admin/*` routes.
