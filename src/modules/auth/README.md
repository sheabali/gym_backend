# Auth Module

Production-ready authentication and authorization module for the Gym Management System API.

## Endpoints
- `POST /api/v1/auth/register` - Registers a new member (role is strictly enforced as `MEMBER`).
- `POST /api/v1/auth/login` - Authenticates credentials with generic error messages, issues a short-lived access token, and sets an `httpOnly` refresh token cookie.
- `POST /api/v1/auth/refresh` - Rotates refresh token with reuse-theft detection and issues a new access token.
- `POST /api/v1/auth/logout` - Revokes session in database and clears the refresh cookie.
- `GET /api/v1/auth/me` - Returns sanitized profile of the currently authenticated user.

## Middlewares
- `authenticate`: Validates JWT Bearer access token.
- `requireRole(...roles)`: Verifies user role against required roles (`MEMBER`, `TRAINER`, `ADMIN`).
- `authRateLimiter`: Rate limits sensitive endpoints (max 10 requests per 15 minutes).
