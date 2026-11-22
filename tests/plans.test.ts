import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Membership Plans Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = generateAccessToken({
    userId: 'admin_user_id_1',
    email: 'admin@gym.com',
    role: Role.ADMIN,
  });

  const memberToken = generateAccessToken({
    userId: 'member_user_id_1',
    email: 'member@gym.com',
    role: Role.MEMBER,
  });

  const mockPlan = {
    id: '674000000000000000000010',
    name: 'Standard Monthly',
    slug: 'standard-monthly',
    description: 'Full access to gym floor and lockers.',
    price: 300000, // 3,000 BDT in paisa
    durationDays: 30,
    features: ['Gym access', 'Locker access'],
    isActive: true,
    isFeatured: false,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('GET /api/v1/plans', () => {
    it('should return a list of active membership plans', async () => {
      vi.spyOn(prisma.membershipPlan, 'findMany').mockResolvedValueOnce([mockPlan]);

      const res = await request(app).get('/api/v1/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.plans)).toBe(true);
      expect(res.body.data.plans[0].slug).toBe('standard-monthly');
      expect(res.body.data.plans[0].price).toBe(300000);
    });
  });

  describe('GET /api/v1/plans/:slug', () => {
    it('should return a single plan by slug', async () => {
      vi.spyOn(prisma.membershipPlan, 'findFirst').mockResolvedValueOnce(mockPlan);

      const res = await request(app).get('/api/v1/plans/standard-monthly');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan.name).toBe('Standard Monthly');
    });

    it('should return 404 if plan is not found', async () => {
      vi.spyOn(prisma.membershipPlan, 'findFirst').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/plans/non-existent-plan');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/plans', () => {
    it('should allow ADMIN to create a plan with price in paisa', async () => {
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(prisma.membershipPlan, 'create').mockResolvedValueOnce(mockPlan);

      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Standard Monthly',
          description: 'Full access to gym floor and lockers.',
          price: 300000,
          durationDays: 30,
          features: ['Gym access', 'Locker access'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan.slug).toBe('standard-monthly');
    });

    it('should block non-admin (MEMBER) from creating a plan with 403', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Hacked Plan',
          price: 100,
          durationDays: 30,
          features: ['Hacked'],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject invalid or non-integer price with 400', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Price Plan',
          price: -500, // Invalid negative price
          durationDays: 30,
          features: ['Feature 1'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('should reject duplicate slug with 409 Conflict', async () => {
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce(mockPlan);

      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Standard Monthly',
          price: 300000,
          durationDays: 30,
          features: ['Feature 1'],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('PATCH /api/v1/plans/:id', () => {
    it('should allow ADMIN to update plan details', async () => {
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce(mockPlan);
      vi.spyOn(prisma.membershipPlan, 'update').mockResolvedValueOnce({
        ...mockPlan,
        price: 350000,
      });

      const res = await request(app)
        .patch(`/api/v1/plans/${mockPlan.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 350000 });

      expect(res.status).toBe(200);
      expect(res.body.data.plan.price).toBe(350000);
    });

    it('should block non-admin from updating a plan with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/plans/${mockPlan.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ price: 350000 });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/plans/:id', () => {
    it('should soft-deactivate the plan (isActive: false) rather than deleting it', async () => {
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce(mockPlan);
      vi.spyOn(prisma.membershipPlan, 'update').mockResolvedValueOnce({
        ...mockPlan,
        isActive: false,
      });

      const res = await request(app)
        .delete(`/api/v1/plans/${mockPlan.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.plan.isActive).toBe(false);
    });

    it('should block non-admin from deactivating a plan with 403', async () => {
      const res = await request(app)
        .delete(`/api/v1/plans/${mockPlan.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });
});
