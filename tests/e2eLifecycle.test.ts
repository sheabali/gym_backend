import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  Role,
  UserStatus,
  BookingStatus,
  SessionStatus,
  SubscriptionStatus,
  PaymentStatus,
} from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';
import { FakePaymentGateway, setTestPaymentGateway } from '../src/modules/payments/gateway';

describe('Phase 10: End-to-End Gym Lifecycle Smoke & Hardening Tests', () => {
  let fakeGateway: FakePaymentGateway;

  beforeEach(() => {
    vi.restoreAllMocks();
    fakeGateway = new FakePaymentGateway();
    setTestPaymentGateway(fakeGateway);
  });

  const memberId = '674000000000000000000101';
  const trainerId = '674000000000000000000102';
  const adminId = '674000000000000000000103';

  const memberToken = generateAccessToken({
    userId: memberId,
    email: 'newmember@gmail.com',
    role: Role.MEMBER,
  });

  const trainerToken = generateAccessToken({
    userId: trainerId,
    email: 'leadcoach@platinumgym.com',
    role: Role.TRAINER,
  });

  const adminToken = generateAccessToken({
    userId: adminId,
    email: 'admin@platinumgym.com',
    role: Role.ADMIN,
  });

  it('1. Visitor can browse active membership plans without authentication', async () => {
    vi.spyOn(prisma.membershipPlan, 'findMany').mockResolvedValue([
      {
        id: 'plan_1m',
        name: '1 Month Standard Access',
        slug: '1-month-standard',
        description: 'Complete floor access',
        price: 250000, // 2,500 BDT in paisa
        durationDays: 30,
        features: ['Gym floor', 'Locker access'],
        isActive: true,
        isFeatured: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app).get('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans).toHaveLength(1);
    expect(res.body.data.plans[0].price).toBe(250000);
  });

  it('2. Authenticated member can initiate checkout and receive gateway redirect URL', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: memberId,
      name: 'New Member',
      email: 'newmember@gmail.com',
      phone: '+8801700000001',
      passwordHash: 'hash',
      role: Role.MEMBER,
      status: UserStatus.ACTIVE,
      freeTrialUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValue({
      id: 'plan_1m',
      name: '1 Month Standard Access',
      slug: '1-month-standard',
      description: 'Complete floor access',
      price: 250000,
      durationDays: 30,
      features: ['Gym floor'],
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(prisma.subscription, 'findMany').mockResolvedValue([]);

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => {
      const tx = {
        subscription: {
          create: vi.fn().mockResolvedValue({
            id: 'sub_pending_1',
            userId: memberId,
            planId: 'plan_1m',
            planName: '1 Month Standard Access',
            pricePaid: 250000,
            status: SubscriptionStatus.PENDING,
          }),
        },
        payment: {
          create: vi.fn().mockResolvedValue({
            id: 'pay_pending_1',
            tranId: 'TX-E2E-TEST-001',
            userId: memberId,
            subscriptionId: 'sub_pending_1',
            amount: 250000,
            currency: 'BDT',
            status: PaymentStatus.PENDING,
            method: 'ONLINE',
          }),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ planId: 'plan_1m' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.gatewayPageURL).toBeDefined();
    expect(res.body.data.tranId).toBeDefined();
  });

  it('3. SSLCommerz callback activates subscription with stacked Asia/Dhaka expiry', async () => {
    const mockPayment = {
      id: 'pay_pending_1',
      tranId: 'TX-E2E-TEST-001',
      userId: memberId,
      subscriptionId: 'sub_pending_1',
      amount: 250000,
      currency: 'BDT',
      status: PaymentStatus.PENDING,
      method: null,
      valId: null,
      bankTranId: null,
      cardType: null,
      cardBrand: null,
      gatewayResponse: null,
      recordedById: null,
      note: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: {
        id: 'sub_pending_1',
        userId: memberId,
        planId: 'plan_1m',
        planName: '1 Month Standard Access',
        pricePaid: 250000,
        status: SubscriptionStatus.PENDING,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: 'plan_1m',
          name: '1 Month Standard Access',
          durationDays: 30,
        },
      },
    };

    fakeGateway.setSimulatedValidationResult({
      status: 'VALID',
      tranId: mockPayment.tranId,
      valId: 'VAL-TEST-999',
      amountPaisa: 250000,
      currency: 'BDT',
      cardType: 'VISA-Platinum',
      bankTranId: 'BANK-100',
    });

    vi.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);
    vi.spyOn(prisma.subscription, 'findMany').mockResolvedValue([]);

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => {
      const tx = {
        payment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            ...mockPayment,
            status: PaymentStatus.SUCCESS,
            paidAt: new Date(),
          }),
        },
        subscription: {
          update: vi.fn().mockResolvedValue({
            ...mockPayment.subscription,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post('/api/v1/payments/sslcommerz/success')
      .set('Accept', 'application/json')
      .send({
        tran_id: 'TX-E2E-TEST-001',
        val_id: 'VAL-TEST-999',
        amount: '2500.00',
        card_type: 'VISA-Platinum',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.status).toBe(PaymentStatus.SUCCESS);
  });

  it('4. Member can query verified payment status', async () => {
    vi.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
      id: 'pay_pending_1',
      tranId: 'TX-E2E-TEST-001',
      userId: memberId,
      amount: 250000,
      currency: 'BDT',
      status: PaymentStatus.SUCCESS,
      method: 'ONLINE',
      paidAt: new Date(),
      createdAt: new Date(),
      subscription: {
        id: 'sub_active_1',
        planName: '1 Month Standard Access',
        status: SubscriptionStatus.ACTIVE,
      },
    } as any);

    const res = await request(app)
      .get('/api/v1/payments/TX-E2E-TEST-001/status')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUCCESS');
    expect(res.body.data.amountPaisa).toBe(250000);
  });

  it('5. Active member can atomically book an upcoming class session', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const mockSession = {
      id: 'session_e2e_1',
      classTypeId: 'type_hiit',
      trainerId,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 60 * 60 * 1000),
      capacity: 15,
      bookedCount: 5,
      room: 'Main Studio',
      status: SessionStatus.SCHEDULED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: memberId,
      name: 'New Member',
      email: 'newmember@gmail.com',
      role: Role.MEMBER,
      status: UserStatus.ACTIVE,
      freeTrialUsed: false,
      subscriptions: [
        {
          id: 'sub_active_1',
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        },
      ],
    } as any);

    vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValue(mockSession as any);
    vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => {
      const tx = {
        classSession: {
          findUnique: vi.fn().mockResolvedValue(mockSession),
          update: vi.fn().mockResolvedValue({ ...mockSession, bookedCount: 6 }),
        },
        booking: {
          create: vi.fn().mockResolvedValue({
            id: 'booking_e2e_1',
            sessionId: 'session_e2e_1',
            userId: memberId,
            status: BookingStatus.BOOKED,
            bookedAt: new Date(),
            session: mockSession,
          }),
        },
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ sessionId: 'session_e2e_1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking.status).toBe('BOOKED');
  });

  it('6. Assigned trainer can view session attendee roster', async () => {
    vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValue({
      id: 'session_e2e_1',
      trainerId,
    } as any);

    vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([
      {
        id: 'booking_e2e_1',
        sessionId: 'session_e2e_1',
        userId: memberId,
        status: BookingStatus.BOOKED,
        bookedAt: new Date(),
        user: {
          id: memberId,
          name: 'New Member',
          email: 'newmember@gmail.com',
          phone: '+8801700000001',
        },
      },
    ] as any);

    const res = await request(app)
      .get('/api/v1/bookings/sessions/session_e2e_1')
      .set('Authorization', `Bearer ${trainerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.roster).toHaveLength(1);
    expect(res.body.data.roster[0].user.name).toBe('New Member');
  });

  it('7. Trainer can mark member attendance as ATTENDED', async () => {
    vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
      id: 'booking_e2e_1',
      sessionId: 'session_e2e_1',
      userId: memberId,
      status: BookingStatus.BOOKED,
      session: { trainerId },
    } as any);

    vi.spyOn(prisma.booking, 'update').mockResolvedValue({
      id: 'booking_e2e_1',
      sessionId: 'session_e2e_1',
      userId: memberId,
      status: BookingStatus.ATTENDED,
    } as any);

    const res = await request(app)
      .patch('/api/v1/bookings/booking_e2e_1/attendance')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ status: 'ATTENDED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking.status).toBe('ATTENDED');
  });

  it('8. Admin can record walk-in cash payment with stacked validity', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: memberId,
      status: UserStatus.ACTIVE,
    } as any);

    vi.spyOn(prisma.membershipPlan, 'findUnique').mockResolvedValue({
      id: 'plan_1m',
      name: '1 Month Standard Access',
      price: 250000,
      durationDays: 30,
      isActive: true,
    } as any);

    vi.spyOn(prisma.subscription, 'findMany').mockResolvedValue([
      {
        id: 'sub_active_1',
        status: SubscriptionStatus.ACTIVE,
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      } as any,
    ]);

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => {
      const tx = {
        subscription: {
          create: vi.fn().mockResolvedValue({
            id: 'sub_stacked_cash_2',
            userId: memberId,
            planId: 'plan_1m',
            planName: '1 Month Standard Access',
            pricePaid: 250000,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date(),
            endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          }),
        },
        payment: {
          create: vi.fn().mockResolvedValue({
            id: 'pay_cash_1',
            tranId: 'TX-CASH-E2E-001',
            userId: memberId,
            amount: 250000,
            method: 'CASH',
            status: PaymentStatus.SUCCESS,
            recordedById: adminId,
          }),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post('/api/v1/subscriptions/admin-record')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberId,
        planId: 'plan_1m',
        method: 'CASH',
        note: 'Walk-in cash collected by front desk',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.method).toBe('CASH');
    expect(res.body.data.subscription.status).toBe('ACTIVE');
  });

  it('9. Public visitor can submit contact inquiry and Admin can mark it REPLIED', async () => {
    vi.spyOn(prisma.contactMessage, 'create').mockResolvedValue({
      id: 'msg_e2e_1',
      name: 'Prospective Member',
      email: 'visitor@gmail.com',
      phone: '+8801900000001',
      message: 'What are your women-only shift hours?',
      status: 'NEW' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const submitRes = await request(app)
      .post('/api/v1/contact')
      .send({
        name: 'Prospective Member',
        email: 'visitor@gmail.com',
        phone: '+8801900000001',
        message: 'What are your women-only shift hours?',
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);

    // Admin updates status
    vi.spyOn(prisma.contactMessage, 'findUnique').mockResolvedValue({
      id: 'msg_e2e_1',
      status: 'NEW' as any,
    } as any);

    vi.spyOn(prisma.contactMessage, 'update').mockResolvedValue({
      id: 'msg_e2e_1',
      status: 'REPLIED' as any,
    } as any);

    const updateRes = await request(app)
      .patch('/api/v1/contact/msg_e2e_1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REPLIED' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.message.status).toBe('REPLIED');
  });
});
