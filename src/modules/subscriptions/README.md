# Subscriptions Module

Handles member subscription lifecycles, plan snapshotting, renewal stacking, and expiry tracking.

## Features
- **Plan Snapshotting:**
  - Snapshots `planName` and `pricePaid` (paisa integer) on the subscription at checkout.
  - Future plan edits or price changes never alter past subscriptions.
- **Renewal Stacking:**
  - When an active member renews or buys another plan before their current membership expires, the new subscription period stacks: its `startDate` begins at the existing subscription's `endDate`.
  - Expiry is calculated to 23:59:59.999 in the `Asia/Dhaka` timezone (UTC+6).
- **Ownership Verification:**
  - Members can only view their own subscriptions.
  - Admins can query any subscription and record offline cash memberships.

## Endpoints
- `POST /api/v1/subscriptions/checkout` (Member checkout initiation)
- `GET /api/v1/subscriptions/my` (Member subscriptions history)
- `GET /api/v1/subscriptions/:id` (Subscription details - Owner or Admin)
- `POST /api/v1/subscriptions/admin-record` (Admin cash payment & subscription activation)
