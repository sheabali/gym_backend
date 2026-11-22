import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
} from '../src/utils/errors';
import { errorHandler } from '../src/middleware/errorHandler';
import { env } from '../src/config';

describe('Central Error Handler', () => {
  const createErrorApp = () => {
    const app = express();
    app.use(express.json());

    app.get('/error/bad-request', () => {
      throw new BadRequestError('Invalid input provided');
    });

    app.get('/error/unauthorized', () => {
      throw new UnauthorizedError('Token is invalid');
    });

    app.get('/error/forbidden', () => {
      throw new ForbiddenError('Access restricted to administrators');
    });

    app.get('/error/not-found', () => {
      throw new NotFoundError('Class session not found');
    });

    app.get('/error/conflict', () => {
      throw new ConflictError('Class session is fully booked');
    });

    app.get('/error/too-many-requests', () => {
      throw new TooManyRequestsError('Rate limit exceeded');
    });

    app.get('/error/unknown', () => {
      throw new Error('Database password failed');
    });

    app.use(errorHandler);
    return app;
  };

  it('should format BadRequestError correctly (400)', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/bad-request');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid input provided');
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('should format UnauthorizedError correctly (401)', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/unauthorized');

    expect(res.status).toBe(401);
    expect(res.body.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should format ForbiddenError correctly (403)', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/forbidden');

    expect(res.status).toBe(403);
    expect(res.body.statusCode).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should format NotFoundError correctly (404)', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/not-found');

    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should format ConflictError correctly (409)', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/conflict');

    expect(res.status).toBe(409);
    expect(res.body.statusCode).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should format TooManyRequestsError correctly (429)', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/too-many-requests');

    expect(res.status).toBe(429);
    expect(res.body.statusCode).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('should mask unknown errors with a generic 500 error envelope', async () => {
    const app = createErrorApp();
    const res = await request(app).get('/error/unknown');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(500);
    expect(res.body.message).toBe('An unexpected internal server error occurred.');
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    // Ensure raw error message ('Database password failed') is never leaked to client
    expect(res.body.message).not.toContain('Database password');
  });

  it('should omit stack traces when NODE_ENV is production', async () => {
    const originalEnv = env.NODE_ENV;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';

    const app = createErrorApp();
    const res = await request(app).get('/error/unknown');

    expect(res.body.stack).toBeUndefined();

    // Restore NODE_ENV
    (env as { NODE_ENV: string }).NODE_ENV = originalEnv;
  });
});
