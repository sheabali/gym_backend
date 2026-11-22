import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { PaymentStatus, Role, SubscriptionStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';
import { setTestPaymentGateway } from '../src/modules/payments/gateway';
import { FakePaymentGateway } from '../src/modules/payments/gateway/fakeGateway';

describe('Payments & SSLCommerz Integration', () => {
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

  const mockPlan = {
    id: '674000000000000000000010',
    name: 'Pro Quarterly',
    slug: 'pro-quarterly',
    price: 800000, // 8,000 BDT in paisa
    durationDays: 90,
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
    plan: mockPlan,
  };

  const mockPayment = {
    id: '674000000000000000000030',
    subscriptionId: mockSubscription.id,
    userId: memberId,
    tranId: 'GYM-TX-TEST-001',
    amount: 800000,
    currency: 'BDT',
    status: PaymentStatus.PENDING,
    method: null,
    valId: null,
    bankTranId: null,
    gatewayResponse: null,
    paidAt: null,
    createdAt: new Date(),
    subscription: mockSubscription,
  };

  describe('POST /api/v1/payments/sslcommerz/success', () => {
    it('should successfully validate payment and activate subscription', async () => {
      fakeGateway.setSimulatedValidationResult({
        status: 'VALID',
        tranId: mockPayment.tranId,
        valId: 'VAL-12345',
        amountPaisa: 800000,
        currency: 'BDT',
        cardType: 'BKASH-BKash',
        bankTranId: 'BANK-TR-100',
      });

      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);
      vi.spyOn(prisma.subscription, 'findMany').mockResolvedValueOnce([]); // No existing active sub

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          payment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({
              ...mockPayment,
              status: PaymentStatus.SUCCESS,
              valId: 'VAL-12345',
            }),
          },
          subscription: {
            update: vi.fn().mockResolvedValue({
              ...mockSubscription,
              status: SubscriptionStatus.ACTIVE,
            }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/payments/sslcommerz/success')
        .set('Accept', 'application/json')
        .send({
          tran_id: mockPayment.tranId,
          val_id: 'VAL-12345',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyProcessed).toBe(false);
    });

    it('should be idempotent on duplicate payment notifications (no double activation)', async () => {
      const alreadySuccessPayment = {
        ...mockPayment,
        status: PaymentStatus.SUCCESS,
        valId: 'VAL-12345',
      };

      fakeGateway.setSimulatedValidationResult({
        status: 'VALID',
        tranId: mockPayment.tranId,
        valId: 'VAL-12345',
        amountPaisa: 800000,
        currency: 'BDT',
      });

      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(alreadySuccessPayment as any);

      const res = await request(app)
        .post('/api/v1/payments/sslcommerz/success')
        .set('Accept', 'application/json')
        .send({
          tran_id: mockPayment.tranId,
          val_id: 'VAL-12345',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyProcessed).toBe(true);
    });

    it('should reject tampered payment amounts with 400 and flag payment as FAILED', async () => {
      // Gateway validates an amount lower than our plan price (e.g. 500 paisa instead of 800000)
      fakeGateway.setSimulatedValidationResult({
        status: 'VALID',
        tranId: mockPayment.tranId,
        valId: 'VAL-FRAUD',
        amountPaisa: 500, // Tampered
        currency: 'BDT',
      });

      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);
      const updateSpy = vi.spyOn(prisma.payment, 'update').mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/api/v1/payments/sslcommerz/success')
        .set('Accept', 'application/json')
        .send({
          tran_id: mockPayment.tranId,
          val_id: 'VAL-FRAUD',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.message).toContain('amount');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPayment.id },
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        })
      );
    });
  });

  describe('POST /api/v1/payments/sslcommerz/fail and cancel', () => {
    it('should mark payment and pending subscription as FAILED on failure callback', async () => {
      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          payment: {
            update: vi.fn().mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED }),
          },
          subscription: {
            update: vi.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.CANCELLED }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/payments/sslcommerz/fail')
        .set('Accept', 'application/json')
        .send({ tran_id: mockPayment.tranId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.status).toBe(PaymentStatus.FAILED);
    });

    it('should mark payment and pending subscription as CANCELLED on cancel callback', async () => {
      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          payment: {
            update: vi.fn().mockResolvedValue({ ...mockPayment, status: PaymentStatus.CANCELLED }),
          },
          subscription: {
            update: vi.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.CANCELLED }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/payments/sslcommerz/cancel')
        .set('Accept', 'application/json')
        .send({ tran_id: mockPayment.tranId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.status).toBe(PaymentStatus.CANCELLED);
    });
  });

  describe('POST /api/v1/payments/sslcommerz/ipn', () => {
    it('should process server-to-server IPN successfully', async () => {
      fakeGateway.setSimulatedValidationResult({
        status: 'VALID',
        tranId: mockPayment.tranId,
        valId: 'VAL-IPN-999',
        amountPaisa: 800000,
        currency: 'BDT',
      });

      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);
      vi.spyOn(prisma.subscription, 'findMany').mockResolvedValueOnce([]);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          payment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ ...mockPayment, status: PaymentStatus.SUCCESS }),
          },
          subscription: {
            update: vi.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.ACTIVE }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/payments/sslcommerz/ipn')
        .send({
          tran_id: mockPayment.tranId,
          val_id: 'VAL-IPN-999',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/payments/reconcile (Lost Callback Recovery)', () => {
    it('should allow admin to reconcile old pending payments against gateway', async () => {
      const oldPendingPayment = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes old
      };

      vi.spyOn(prisma.payment, 'findMany').mockResolvedValueOnce([oldPendingPayment as any]);
      fakeGateway.setSimulatedQueryResult({
        status: 'VALID',
        tranId: oldPendingPayment.tranId,
        valId: 'VAL-RECONCILED',
        amountPaisa: 800000,
        currency: 'BDT',
      });

      // Find unique for processSuccessfulPayment
      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(oldPendingPayment as any);
      vi.spyOn(prisma.subscription, 'findMany').mockResolvedValueOnce([]);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          payment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ ...oldPendingPayment, status: PaymentStatus.SUCCESS }),
          },
          subscription: {
            update: vi.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.ACTIVE }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/payments/reconcile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkedCount).toBe(1);
      expect(res.body.data.activatedCount).toBe(1);
    });

    it('should block non-admins from running reconciliation with 403', async () => {
      const res = await request(app)
        .post('/api/v1/payments/reconcile')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/payments/:tranId/status', () => {
    it('should allow member to view their own payment status', async () => {
      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);

      const res = await request(app)
        .get(`/api/v1/payments/${mockPayment.tranId}/status`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tranId).toBe(mockPayment.tranId);
      expect(res.body.data.amountPaisa).toBe(800000);
    });

    it('should block another member from viewing payment status with 403', async () => {
      vi.spyOn(prisma.payment, 'findUnique').mockResolvedValueOnce(mockPayment as any);

      const res = await request(app)
        .get(`/api/v1/payments/${mockPayment.tranId}/status`)
        .set('Authorization', `Bearer ${otherMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
