# Membership Plans Module

Handles the gym membership catalog, pricing (in paisa), duration, and availability.

## Money Convention
All prices are stored as **positive integers in paisa** (1 BDT = 100 paisa). Floating point money is strictly prohibited per the project instructions.

## Endpoints
- `GET /api/v1/plans` - Public list of active membership plans sorted by `sortOrder`. Admin can pass `?includeInactive=true`.
- `GET /api/v1/plans/:slug` - Public single plan details by slug or MongoDB ObjectId.
- `POST /api/v1/plans` - Admin-only plan creation. Automatically generates unique slug from name if not provided.
- `PATCH /api/v1/plans/:id` - Admin-only plan update. Edits affect only future purchases; past subscriptions retain historical price snapshots.
- `DELETE /api/v1/plans/:id` - Admin-only soft deactivation (`isActive: false`). Plans are never hard-deleted.
