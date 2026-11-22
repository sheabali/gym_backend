import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Admin Module', () => {
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

  const mockMember = {
    id: '674000000000000000000001',
    name: 'Karim Ahmed',
    email: 'karim@example.com',
    phone: '01712345678',
    role: Role.MEMBER,
    status: UserStatus.ACTIVE,
    trialUsed: false,
    emergencyContact: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    subscriptions: [],
    _count: { bookings: 2, payments: 1 },
  };

  describe('GET /api/v1/admin/overview', () => {
    it('should return aggregated metrics for ADMIN', async () => {
      vi.spyOn(prisma.user, 'count')
        .mockResolvedValueOnce(50) // total members
        .mockResolvedValueOnce(35); // active with sub

      vi.spyOn(prisma.payment, 'aggregate')
        .mockResolvedValueOnce({ _sum: { amount: 1500000 } } as any) // total revenue (paisa)
        .mockResolvedValueOnce({ _sum: { amount: 500000 } } as any); // monthly revenue (paisa)

      vi.spyOn(prisma.classSession, 'count').mockResolvedValueOnce(4); // today sessions
      vi.spyOn(prisma.booking, 'count').mockResolvedValueOnce(18); // today bookings
      vi.spyOn(prisma.contactMessage, 'count').mockResolvedValueOnce(3); // new inquiries
      vi.spyOn(prisma.payment, 'count').mockResolvedValueOnce(1); // pending payments

      vi.spyOn(prisma.payment, 'findMany').mockResolvedValueOnce([]); // recent payments
      vi.spyOn(prisma.classSession, 'findMany').mockResolvedValueOnce([]); // today sessions

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.members.total).toBe(50);
      expect(res.body.data.members.activeWithSubscription).toBe(35);
      expect(res.body.data.revenue.monthlyPaisa).toBe(500000);
      expect(res.body.data.revenue.totalPaisa).toBe(1500000);
      expect(res.body.data.revenue.currency).toBe('BDT');
      expect(res.body.data.inbox.newInquiriesCount).toBe(3);
    });

    it('should block non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should block unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/overview');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/admin/members', () => {
    it('should return paginated member list for ADMIN', async () => {
      vi.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([mockMember as any]);
      vi.spyOn(prisma.user, 'count').mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/admin/members?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.members)).toBe(true);
      expect(res.body.data.members[0].email).toBe('karim@example.com');
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('should filter members by status and search query', async () => {
      vi.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([mockMember as any]);
      vi.spyOn(prisma.user, 'count').mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/admin/members?search=Karim&status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.members[0].name).toBe('Karim Ahmed');
    });
  });

  describe('PATCH /api/v1/admin/members/:id/status', () => {
    it('should update member status and revoke active sessions on SUSPENDED', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockMember as any);

      const updatedUser = { ...mockMember, status: UserStatus.SUSPENDED };
      vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([
        updatedUser,
        { count: 2 }, // revoked tokens
      ] as any);

      const res = await request(app)
        .patch(`/api/v1/admin/members/${mockMember.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.status).toBe('SUSPENDED');
    });

    it('should reject status modification for administrative accounts with 400', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockMember,
        role: Role.ADMIN,
      } as any);

      const res = await request(app)
        .patch(`/api/v1/admin/members/${mockMember.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DEACTIVATED' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('administrative account');
    });
  });
});
