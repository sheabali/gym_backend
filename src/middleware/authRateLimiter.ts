import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

// Stricter rate limiter for sensitive authentication endpoints (15 min window, max 10 attempts)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, {
      statusCode: 429,
      message: 'Too many authentication attempts, please try again after 15 minutes.',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});
