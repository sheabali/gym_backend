import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 and UP status when database is reachable', async () => {
    // Mock prisma raw command to simulate successful MongoDB ping
    vi.spyOn(prisma, '$runCommandRaw').mockResolvedValueOnce({ ok: 1 });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Server is healthy',
      data: {
        status: 'UP',
        database: {
          status: 'connected',
        },
      },
    });
    expect(response.body.data.uptimeSeconds).toBeDefined();
    expect(response.body.data.timestamp).toBeDefined();
  });

  it('should return 503 and DOWN status when database is unreachable', async () => {
    // Mock prisma raw command to simulate database error
    vi.spyOn(prisma, '$runCommandRaw').mockRejectedValueOnce(
      new Error('MongoDB connection timeout')
    );

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 503,
      message: 'Service unavailable - database connection issue',
      error: {
        code: 'SERVICE_UNAVAILABLE',
        details: {
          status: 'DOWN',
          database: {
            status: 'disconnected',
            error: 'MongoDB connection timeout',
          },
        },
      },
    });
  });
});
