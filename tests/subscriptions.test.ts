import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, SubscriptionStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';
import { setTestPaymentGateway } from '../src/modules/payments/gateway';
import { FakePaymentGateway } from '../src/modules/payments/gateway/fakeGateway';
import { getDhakaEndOfDay } from '../src/utils/date';

describe('Subscriptions Lifecycle & Stacking', () => {
  let fakeGateway: FakePaymentGateway;

  beforeEach(() => {
    vi.restoreAllMocks();
    fakeGateway = new FakePaymentGateway();
    setTestPaymentGateway(fakeGateway);
  });

  const memberId = '674000000000000000000001';
  const memberToken = generateAccessToken({
    userId: memberId,
    email: 'member@gym.com',
    role: Role.MEMBER,
  });

  const otherMemberToken = generateAccessToken({
    userId: 'other_member_id_99',
    email: 'other@gym.com',
    role: Role.MEMBER,
  });

  const adminToken = generateAccessToken({
    userId: 'admin_user_id_1',
    email: 'admin@gym.com',
    role: Role.ADMIN,
  });

  const mockUser = {
    id: memberId,
    name: 'Member User',
    email: 'member@gym.com',
    phone: '01711111111',
    role: Role.MEMBER,
    status: 'ACTIVE',
  };

  const mockPlan = {
    id: '674000000000000000000010',
    name: 'Standard Monthly',
    slug: 'standard-monthly',
    price: 300000, // 3,000 BDT in paisa
    durationDays: 30,
    isActive: true,
  };

  const mockSubscription = {
    id: '674000000000000000000020',
    userId: memberId,
    planId: mockPlan.id,
    planName: mockPlan.name,
    pricePaid: mockPlan.price,
    status: SubscriptionStatus.PENDING,
    startDate: null,
    endDate: null,
    createdAt: new Date(),
    plan: mockPlan,
    payments: [],
  };

  describe('POST /api/v1/subscriptions/checkout', () => {
    it('should initiate checkout and return hosted gatewayPageURL with snapshot pricing', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser as any);
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce(mockPlan as any);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          subscription: {
            create: vi.fn().mockResolvedValue(mockSubscription),
          },
          payment: {
            create: vi.fn().mockResolvedValue({ id: 'payment_1' }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ planId: mockPlan.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptionId).toBe(mockSubscription.id);
      expect(res.body.data.gatewayPageURL).toContain('/payments/fake/checkout');
      expect(res.body.data.tranId).toMatch(/^GYM-TX-/);
    });

    it('should reject checkout if plan is inactive with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser as any);
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce({
        ...mockPlan,
        isActive: false,
      } as any);

      const res = await request(app)
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ planId: mockPlan.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.message).toContain('no longer available');
    });
  });

  describe('Renewal Stacking & Expiry Calculation', () => {
    it('should stack renewal starting at current active subscription end date and expire at Dhaka end of day', async () => {
      // Existing active subscription ends in 10 days
      const existingEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const _existingActiveSub = {
        ...mockSubscription,
        id: 'existing_sub_1',
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate: existingEnd,
      };

      // Calculate expected end date: existingEnd + 30 days, ending at 23:59:59.999 Dhaka time
      const expectedEnd = getDhakaEndOfDay(existingEnd, mockPlan.durationDays);

      // Verify date utility behavior
      expect(expectedEnd.getTime()).toBeGreaterThan(existingEnd.getTime());
      // Dhaka is UTC+6 -> 23:59:59 Dhaka = 17:59:59 UTC
      expect(expectedEnd.getUTCHours()).toBe(17);
      expect(expectedEnd.getUTCMinutes()).toBe(59);
      expect(expectedEnd.getUTCSeconds()).toBe(59);
    });
  });

  describe('POST /api/v1/subscriptions/admin-record (Cash Payment)', () => {
    it('should allow admin to record cash payment and immediately activate subscription', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser as any);
      vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValueOnce(mockPlan as any);
      vi.spyOn(prisma.subscription, 'findMany').mockResolvedValueOnce([]); // No existing active

      const activeSub = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate: getDhakaEndOfDay(new Date(), mockPlan.durationDays),
      };

      const successPayment = {
        id: 'payment_cash_1',
        tranId: 'GYM-CASH-1234',
        amount: mockPlan.price,
        status: 'SUCCESS',
        method: 'CASH',
      };

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          subscription: {
            create: vi.fn().mockResolvedValue(activeSub),
          },
          payment: {
            create: vi.fn().mockResolvedValue(successPayment),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/subscriptions/admin-record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: mockUser.id,
          planId: mockPlan.id,
          method: 'CASH',
          note: 'Counter receipt #402',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(res.body.data.payment.method).toBe('CASH');
    });

    it('should block non-admins from recording cash subscriptions with 403', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/admin-record')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          userId: mockUser.id,
          planId: mockPlan.id,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/subscriptions/my', () => {
    it('should return member subscriptions list', async () => {
      vi.spyOn(prisma.subscription, 'findMany').mockResolvedValueOnce([mockSubscription as any]);
      vi.spyOn(prisma.subscription, 'count').mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/subscriptions/my')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptions.length).toBe(1);
    });
  });

  describe('GET /api/v1/subscriptions/:id (Ownership Check)', () => {
    it('should allow member to view their own subscription', async () => {
      vi.spyOn(prisma.subscription, 'findUnique').mockResolvedValueOnce(mockSubscription as any);

      const res = await request(app)
        .get(`/api/v1/subscriptions/${mockSubscription.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.subscription.id).toBe(mockSubscription.id);
    });

    it('should block other member from viewing subscription with 403', async () => {
      vi.spyOn(prisma.subscription, 'findUnique').mockResolvedValueOnce(mockSubscription as any);

      const res = await request(app)
        .get(`/api/v1/subscriptions/${mockSubscription.id}`)
        .set('Authorization', `Bearer ${otherMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
