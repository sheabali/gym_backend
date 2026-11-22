# Classes Module

Handles class types (definitions, difficulty levels, duration, default capacities) and scheduled class sessions.

## Features
- **Class Types Catalog:**
  - Create and manage class templates (e.g. HIIT, Yoga, Boxing).
  - Validation: title, description, duration in minutes, default capacity, difficulty level.
- **Session Scheduling:**
  - Schedule concrete class sessions with designated instructor (`TRAINER`), room/location, start time, and end time.
  - Recurring schedule generator (`POST /api/v1/classes/sessions/recurring`) for recurring weekly batches.
  - Advance booking window enforcement (`BOOKING_WINDOW_DAYS: 7`).
  - Session cancellation by admin cascades to cancel all active bookings and flag participants for notifications.

## Endpoints
- `GET /api/v1/classes/types` (Public)
- `POST /api/v1/classes/types` (Admin)
- `PATCH /api/v1/classes/types/:id` (Admin)
- `GET /api/v1/classes/sessions` (Public, queryable by `trainerId`, `classTypeId`, `startDate`, `endDate`)
- `POST /api/v1/classes/sessions` (Admin)
- `POST /api/v1/classes/sessions/recurring` (Admin)
- `PATCH /api/v1/classes/sessions/:id/cancel` (Admin)
