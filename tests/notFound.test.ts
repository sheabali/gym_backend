import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Not Found Route Handler', () => {
  it('should return standard 404 envelope for an unknown GET route', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      statusCode: 404,
      message: 'Cannot GET /api/v1/unknown-endpoint',
      error: {
        code: 'NOT_FOUND',
      },
    });
  });

  it('should return standard 404 envelope for an unknown POST route', async () => {
    const res = await request(app).post('/non-existent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      statusCode: 404,
      message: 'Cannot POST /non-existent',
      error: {
        code: 'NOT_FOUND',
      },
    });
  });
});
