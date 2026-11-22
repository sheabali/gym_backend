import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('OpenAPI & Swagger UI Documentation Endpoints', () => {
  it('GET /api-docs/openapi.json should return valid OpenAPI 3.0 specification JSON', async () => {
    const res = await request(app).get('/api-docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('Gym Management System API');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/auth/login');
    expect(res.body.paths).toHaveProperty('/bookings');
    expect(res.body.paths).toHaveProperty('/subscriptions/checkout');
    expect(res.body.paths).toHaveProperty('/payments/sslcommerz/success');
  });

  it('GET /api-docs should return interactive Swagger UI HTML page', async () => {
    const res = await request(app).get('/api-docs');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
    expect(res.text).toContain('id="swagger-ui"');
    expect(res.text).toContain('SwaggerUIBundle');
  });

  it('GET /api/v1/docs should also serve Swagger UI HTML page', async () => {
    const res = await request(app).get('/api/v1/docs');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
    expect(res.text).toContain('id="swagger-ui"');
  });
});
