import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, UserStatus, BookingStatus, SessionStatus, SubscriptionStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Bookings & Attendance Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const memberId = '674000000000000000000050';
  const memberToken = generateAccessToken({
    userId: memberId,
    email: 'member@gym.com',
    role: Role.MEMBER,
  });

  const trainerId = '674000000000000000000060';
  const trainerToken = generateAccessToken({
    userId: trainerId,
    email: 'trainer@gym.com',
    role: Role.TRAINER,
  });

  const otherTrainerToken = generateAccessToken({
    userId: 'other_trainer_id',
    email: 'other_trainer@gym.com',
    role: Role.TRAINER,
  });

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sessionStartsAt = tomorrow;

  const mockSession = {
    id: '674000000000000000000070',
    classTypeId: 'type_1',
    trainerId,
    startsAt: sessionStartsAt,
    endsAt: new Date(sessionStartsAt.getTime() + 60 * 60 * 1000),
    capacity: 10,
    bookedCount: 5,
    room: 'Studio A',
    status: SessionStatus.SCHEDULED,
  };

  const mockUserWithSubscription = {
    id: memberId,
    name: 'Rahim Ahmed',
    email: 'member@gym.com',
    status: UserStatus.ACTIVE,
    role: Role.MEMBER,
    trialUsed: false,
    subscriptions: [
      {
        id: 'sub_1',
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
    ],
  };

  const mockBooking = {
    id: '674000000000000000000080',
    sessionId: mockSession.id,
    userId: memberId,
    status: BookingStatus.BOOKED,
    bookedAt: new Date(),
    cancelledAt: null,
    session: mockSession,
  };

  describe('POST /api/v1/bookings', () => {
    it('should successfully book a class session for an active subscriber', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUserWithSubscription as any);
      vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce(null);

      // Mock transaction
      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          classSession: {
            findUnique: vi.fn().mockResolvedValue(mockSession),
            update: vi.fn().mockResolvedValue({ ...mockSession, bookedCount: 6 }),
          },
          booking: {
            create: vi.fn().mockResolvedValue(mockBooking),
            update: vi.fn().mockResolvedValue(mockBooking),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sessionId: mockSession.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.status).toBe(BookingStatus.BOOKED);
    });

    it('should reject booking if session is already fully booked with 409 Conflict', async () => {
      const fullSession = { ...mockSession, capacity: 10, bookedCount: 10 };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUserWithSubscription as any);
      vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValueOnce(fullSession as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sessionId: mockSession.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.message).toContain('fully booked');
    });

    it('should reject duplicate booking for the same session with 409 Conflict', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUserWithSubscription as any);
      vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce(mockBooking as any);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sessionId: mockSession.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.message).toContain('already booked');
    });

    it('should block members without active subscription when trial has already been used with 403', async () => {
      const userWithNoSubUsedTrial = {
        ...mockUserWithSubscription,
        trialUsed: true, // Trial already used
        subscriptions: [], // No active subscription
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(userWithNoSubUsedTrial as any);
      vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValueOnce(mockSession as any);

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sessionId: mockSession.id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.message).toContain('active membership subscription');
    });
  });

  describe('POST /api/v1/bookings/:id/cancel (2-Hour Cutoff Rule)', () => {
    it('should allow free cancellation when more than 2 hours before session start', async () => {
      // Session starts tomorrow (> 2 hours)
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce(mockBooking as any);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          classSession: {
            update: vi.fn().mockResolvedValue({}),
          },
          booking: {
            update: vi.fn().mockResolvedValue({
              ...mockBooking,
              status: BookingStatus.CANCELLED,
            }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post(`/api/v1/bookings/${mockBooking.id}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLateCancellation).toBe(false);
      expect(res.body.data.booking.status).toBe(BookingStatus.CANCELLED);
    });

    it('should flag late cancellation when within 2 hours of session start', async () => {
      // Session starts in 1 hour (< 2 hours)
      const soonSession = {
        ...mockSession,
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce({
        ...mockBooking,
        session: soonSession,
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        const tx = {
          classSession: {
            update: vi.fn().mockResolvedValue({}),
          },
          booking: {
            update: vi.fn().mockResolvedValue({
              ...mockBooking,
              status: BookingStatus.CANCELLED,
            }),
          },
        };
        return cb(tx);
      });

      const res = await request(app)
        .post(`/api/v1/bookings/${mockBooking.id}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isLateCancellation).toBe(true);
      expect(res.body.message).toContain('within 2 hours');
    });

    it('should block a member from cancelling another member booking with 403', async () => {
      const otherUserBooking = {
        ...mockBooking,
        userId: 'different_user_id',
      };

      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce(otherUserBooking as any);

      const res = await request(app)
        .post(`/api/v1/bookings/${mockBooking.id}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/bookings/sessions/:sessionId (Trainer Roster Ownership Check)', () => {
    it('should allow the assigned trainer to view the session roster', async () => {
      vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValueOnce(mockSession as any);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValueOnce([mockBooking as any]);

      const res = await request(app)
        .get(`/api/v1/bookings/sessions/${mockSession.id}`)
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.roster)).toBe(true);
    });

    it('should block a trainer from viewing roster for a class taught by another trainer with 403', async () => {
      vi.spyOn(prisma.classSession, 'findUnique').mockResolvedValueOnce(mockSession as any);

      const res = await request(app)
        .get(`/api/v1/bookings/sessions/${mockSession.id}`)
        .set('Authorization', `Bearer ${otherTrainerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.message).toContain('classes you instruct');
    });
  });

  describe('PATCH /api/v1/bookings/:id/attendance', () => {
    it('should allow the assigned trainer to mark attendance as ATTENDED', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValueOnce(mockBooking as any);
      vi.spyOn(prisma.booking, 'update').mockResolvedValueOnce({
        ...mockBooking,
        status: BookingStatus.ATTENDED,
      });

      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBooking.id}/attendance`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ status: BookingStatus.ATTENDED });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.status).toBe(BookingStatus.ATTENDED);
    });
  });
});
