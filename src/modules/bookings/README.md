# Bookings Module

Atomic class bookings engine, attendance recording, and cancellation enforcement.

## Features
- **Atomic Capacity Enforcement:**
  - Prevents race conditions and overbooking using transactional capacity checks.
  - Returns `409 Conflict` when a session reaches capacity.
  - Enforces compound uniqueness to prevent double bookings by the same user.
- **Eligibility & Entitlement:**
  - Active member status check.
  - Active subscription verification covering the session date, or complimentary 1-class free trial entitlement (`freeTrialUsed: false`).
- **2-Hour Cancellation Cutoff Policy:**
  - Cancellations > 2 hours before session start: capacity is refunded/decremented (`bookedCount -= 1`).
  - Late cancellations <= 2 hours before session start: booking status becomes `CANCELLED`, but capacity is retained and trial/usage is not refunded.
- **Attendance Management:**
  - Trainers can mark attendance (`ATTENDED` / `NO_SHOW`) only for their own classes.
  - Admins can mark attendance for any session.

## Endpoints
- `POST /api/v1/bookings` (Member)
- `GET /api/v1/bookings/my` (Member)
- `GET /api/v1/bookings/sessions/:sessionId` (Admin or Class Trainer)
- `POST /api/v1/bookings/:id/cancel` (Member)
- `PATCH /api/v1/bookings/:id/attendance` (Trainer / Admin)
