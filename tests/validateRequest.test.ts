import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateRequest } from '../src/middleware/validateRequest';
import { errorHandler } from '../src/middleware/errorHandler';
import { sendSuccess } from '../src/utils/response';

describe('Validation Middleware (validateRequest)', () => {
  const createTestApp = () => {
    const app = express();
    app.use(express.json());

    const testSchema = {
      body: z.object({
        email: z.string().email(),
        age: z.number().min(18),
      }),
      query: z.object({
        source: z.string().optional(),
      }),
    };

    app.post('/test-validate', validateRequest(testSchema), (req: Request, res: Response) => {
      sendSuccess(res, {
        statusCode: 200,
        message: 'Validation passed',
        data: req.body,
      });
    });

    app.use(errorHandler);
    return app;
  };

  it('should accept valid request body and call next handler', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/test-validate')
      .send({ email: 'member@gym.com', age: 25 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ email: 'member@gym.com', age: 25 });
  });

  it('should reject invalid body with 400 and detailed field issues', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/test-validate')
      .send({ email: 'not-an-email', age: 16 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(Array.isArray(res.body.error.details)).toBe(true);

    const details = res.body.error.details;
    const emailError = details.find((d: { field: string }) => d.field === 'email');
    const ageError = details.find((d: { field: string }) => d.field === 'age');

    expect(emailError).toBeDefined();
    expect(ageError).toBeDefined();
  });
});
