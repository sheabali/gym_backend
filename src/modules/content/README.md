# Content & Contact Module

Handles website content (FAQs, announcements, gallery images) and public contact inquiries.

## Features
- **Public Contact Inquiries:**
  - Public submission endpoint with contact validation (requires name, message, and at least email or phone).
  - Admin inbox to filter and manage inquiry statuses (`NEW`, `REPLIED`, `CLOSED`).
- **Frequently Asked Questions (FAQs):**
  - Public listing of published FAQs sorted by `sortOrder`.
  - Admin CRUD endpoints to manage question/answer entries.
- **Announcements:**
  - Public active announcements (supports optional `expiresAt` expiration).
  - Admin management endpoints.
- **Gallery Images:**
  - Public gallery image listing by category and sort order.
  - Admin image addition and removal.

## Endpoints
- `POST /api/v1/contact` (Public submission)
- `GET /api/v1/contact` (Admin inbox)
- `PATCH /api/v1/contact/:id/status` (Admin status update)
- `GET /api/v1/content/faq` (Public / Admin)
- `POST /api/v1/content/faq` (Admin)
- `PATCH /api/v1/content/faq/:id` (Admin)
- `DELETE /api/v1/content/faq/:id` (Admin)
- `GET /api/v1/content/announcements` (Public / Admin)
- `POST /api/v1/content/announcements` (Admin)
- `PATCH /api/v1/content/announcements/:id` (Admin)
- `DELETE /api/v1/content/announcements/:id` (Admin)
- `GET /api/v1/content/gallery` (Public)
- `POST /api/v1/content/gallery` (Admin)
- `DELETE /api/v1/content/gallery/:id` (Admin)
