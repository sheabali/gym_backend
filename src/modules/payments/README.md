# Payments Module

Handles SSLCommerz payment processing, gateway abstraction, IPN callbacks, order validation, and idempotent activation.

## Features
- **Gateway Abstraction (`PaymentGateway`):**
  - Seamlessly swaps between `FakePaymentGateway` (tests and local dev) and `SSLCommerzGateway` (sandbox & production) without modifying service logic.
- **Server-Decided Amounts in Paisa:**
  - Client never specifies the payment amount. Amounts are derived strictly from the database in integer paisa (1 BDT = 100 paisa).
- **Mandatory Server-Side Validation:**
  - Every callback and IPN triggers the SSLCommerz Order Validation API (`val_id`) to confirm transaction ID, currency, and amount.
  - Rejects tampered amounts with `400 Bad Request` and marks the payment `FAILED`.
- **Atomic & Idempotent Activation:**
  - Conditional MongoDB transaction ensures duplicate callbacks (e.g. concurrent IPN and user browser redirect) never activate or credit twice.
- **Reconciliation Engine:**
  - Queries unsettled `PENDING` payments against the gateway transaction query API to resolve lost callbacks automatically.
- **Cash / Offline Payments:**
  - Admins can record cash payments (`method: CASH`) that activate immediately.

## Endpoints
- `GET /api/v1/payments/:tranId/status` (Protected - Owner or Admin)
- `POST /api/v1/payments/sslcommerz/success` (Public gateway/browser POST)
- `POST /api/v1/payments/sslcommerz/fail` (Public gateway/browser POST)
- `POST /api/v1/payments/sslcommerz/cancel` (Public gateway/browser POST)
- `POST /api/v1/payments/sslcommerz/ipn` (Public server-to-server webhook)
- `POST /api/v1/payments/reconcile` (Protected - Admin only)
