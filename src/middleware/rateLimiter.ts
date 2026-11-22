import rateLimit from 'express-rate-limit';
import { env } from '../config';
import { sendError } from '../utils/response';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, {
      statusCode: 429,
      message: 'Too many requests from this IP, please try again later.',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});
