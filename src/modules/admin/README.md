# Admin Module

Handles administrative reporting, overview metrics, member directory management, and status updates.

## Features
- **Overview Metrics:**
  - Real-time aggregation of active subscriber counts, monthly/lifetime revenue (in paisa), today's scheduled classes and bookings, and pending payments.
- **Member Directory:**
  - Searchable and filterable by status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) and subscription coverage.
  - Aggregates member booking history and payment metrics.
- **Account Status Toggling:**
  - Admin can suspend or deactivate member accounts.
  - Revokes all active refresh tokens for suspended/deactivated users immediately.
  - Prevents modification of administrative user accounts.

## Endpoints
- `GET /api/v1/admin/overview` (Admin)
- `GET /api/v1/admin/members` (Admin)
- `GET /api/v1/admin/members/:id` (Admin)
- `PATCH /api/v1/admin/members/:id/status` (Admin)
