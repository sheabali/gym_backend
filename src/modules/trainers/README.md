# Trainer Profiles Module

Handles public-facing trainer directory, specialties, certifications, and trainer profile self-management.

## Ownership Rule
Every protected trainer route enforces a dual check:
1. `requireRole(Role.TRAINER)`
2. Ownership verification: trainers can only edit their own profile via `/api/v1/trainers/me` (`req.user.userId`).

## Endpoints
- `GET /api/v1/trainers` - Public list of active trainers with public profiles, sorted by `sortOrder`.
- `GET /api/v1/trainers/:id` - Public single trainer details by ID.
- `POST /api/v1/trainers` - Admin-only creation of trainer accounts and attached `TrainerProfile`.
- `PATCH /api/v1/trainers/me` - Protected trainer self-service endpoint to update their own bio, specialties, certifications, and photo.
- `PATCH /api/v1/trainers/:id` - Admin-only update to any trainer's profile (including visibility `isPublic` and `sortOrder`).
