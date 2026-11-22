import { Booking, BookingStatus, SessionStatus, Role, UserStatus, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BUSINESS_RULES } from '../../config/businessRules';
import { AuthUser } from '../../types/express';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors';

export interface BookingWithDetails extends Booking {
  session?: unknown;
  user?: unknown;
}

export const bookSession = async (
  userId: string,
  sessionId: string
): Promise<BookingWithDetails> => {
  // 1. Validate user status and retrieve subscriptions/trial
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: SubscriptionStatus.ACTIVE },
      },
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError('Your account is not active');
  }

  // 2. Validate Session existence and status
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { classType: true },
  });

  if (!session) {
    throw new NotFoundError(`Class session '${sessionId}' not found`);
  }

  if (session.status !== SessionStatus.SCHEDULED) {
    throw new BadRequestError(`Cannot book a session with status '${session.status}'`);
  }

  const now = new Date();
  if (session.startsAt <= now) {
    throw new BadRequestError('Cannot book a class that has already started or completed');
  }

  // 3. Enforce 7-day booking window per Section 6
  const maxBookingDate = new Date(
    now.getTime() + BUSINESS_RULES.BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  if (session.startsAt > maxBookingDate) {
    throw new BadRequestError(
      `Classes can only be booked up to ${BUSINESS_RULES.BOOKING_WINDOW_DAYS} days in advance`
    );
  }

  // 4. Verify subscription / free trial eligibility
  const hasActiveSubscription = user.subscriptions.some(
    (sub) =>
      sub.startDate &&
      sub.endDate &&
      sub.startDate <= session.startsAt &&
      sub.endDate >= session.startsAt
  );

  const isExempt = user.role === Role.ADMIN || user.role === Role.TRAINER;
  const canUseTrial = BUSINESS_RULES.FREE_TRIAL_ENABLED && !user.trialUsed;

  if (!hasActiveSubscription && !canUseTrial && !isExempt) {
    throw new ForbiddenError(
      'An active membership subscription covering the class date is required to book. Your complimentary trial has already been used.'
    );
  }

  // 5. Check duplicate booking
  const existingBooking = await prisma.booking.findUnique({
    where: {
      sessionId_userId: {
        sessionId,
        userId,
      },
    },
  });

  if (existingBooking && existingBooking.status === BookingStatus.BOOKED) {
    throw new ConflictError('You have already booked a spot in this session');
  }

  // 6. Enforce capacity & atomic reservation in a transaction
  if (session.bookedCount >= session.capacity) {
    throw new ConflictError('Class session is fully booked');
  }

  return prisma.$transaction(async (tx) => {
    // Re-verify capacity inside transaction
    const lockedSession = await tx.classSession.findUnique({
      where: { id: sessionId },
    });

    if (!lockedSession || lockedSession.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestError('Class session is no longer available for booking');
    }

    if (lockedSession.bookedCount >= lockedSession.capacity) {
      throw new ConflictError('Class session is fully booked');
    }

    // Atomic increment of bookedCount
    await tx.classSession.update({
      where: { id: sessionId },
      data: { bookedCount: { increment: 1 } },
    });

    // Re-booking reuses the existing row per Section 5 instructions
    let booking: Booking;
    if (existingBooking) {
      booking = await tx.booking.update({
        where: { id: existingBooking.id },
        data: {
          status: BookingStatus.BOOKED,
          bookedAt: new Date(),
          cancelledAt: null,
        },
        include: {
          session: {
            include: { classType: true },
          },
        },
      });
    } else {
      booking = await tx.booking.create({
        data: {
          sessionId,
          userId,
          status: BookingStatus.BOOKED,
        },
        include: {
          session: {
            include: { classType: true },
          },
        },
      });
    }

    // Consume trial if booking on trial
    if (!hasActiveSubscription && canUseTrial && !isExempt) {
      await tx.user.update({
        where: { id: userId },
        data: { trialUsed: true },
      });
    }

    return booking;
  });
};

export const getMyBookings = async (userId: string): Promise<Booking[]> => {
  return prisma.booking.findMany({
    where: { userId },
    include: {
      session: {
        include: {
          classType: true,
          trainer: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
            },
          },
        },
      },
    },
    orderBy: {
      session: {
        startsAt: 'desc',
      },
    },
  });
};

export const getSessionRoster = async (
  sessionId: string,
  requestingUser: AuthUser
): Promise<Booking[]> => {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError(`Class session '${sessionId}' not found`);
  }

  // Trainer ownership check: trainers can only see rosters for their own classes
  if (
    requestingUser.role === Role.TRAINER &&
    session.trainerId !== requestingUser.userId
  ) {
    throw new ForbiddenError('You can only view rosters for classes you instruct');
  }

  return prisma.booking.findMany({
    where: {
      sessionId,
      status: { in: [BookingStatus.BOOKED, BookingStatus.ATTENDED, BookingStatus.NO_SHOW] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          photoUrl: true,
        },
      },
    },
    orderBy: { bookedAt: 'asc' },
  });
};

export const cancelBooking = async (
  bookingId: string,
  requestingUser: AuthUser
): Promise<{ booking: Booking; isLateCancellation: boolean }> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: true },
  });

  if (!booking) {
    throw new NotFoundError(`Booking '${bookingId}' not found`);
  }

  // Ownership check: Member can only cancel their own booking (Admins can cancel any)
  if (
    requestingUser.role !== Role.ADMIN &&
    booking.userId !== requestingUser.userId
  ) {
    throw new ForbiddenError('You are not authorized to cancel this booking');
  }

  if (booking.status !== BookingStatus.BOOKED) {
    throw new BadRequestError(`Cannot cancel a booking with status '${booking.status}'`);
  }

  const now = new Date();
  const msUntilStart = booking.session.startsAt.getTime() - now.getTime();
  const hoursUntilStart = msUntilStart / (1000 * 60 * 60);

  // Per Section 6: Free cancellation until 2 hours before the class; later counts as used
  const isLateCancellation = hoursUntilStart < BUSINESS_RULES.CANCELLATION_CUTOFF_HOURS;

  const updatedBooking = await prisma.$transaction(async (tx) => {
    // Decrement session bookedCount if session still scheduled
    if (booking.session.bookedCount > 0) {
      await tx.classSession.update({
        where: { id: booking.sessionId },
        data: { bookedCount: { decrement: 1 } },
      });
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: {
        session: true,
      },
    });
  });

  return {
    booking: updatedBooking,
    isLateCancellation,
  };
};

export const markAttendance = async (
  bookingId: string,
  newStatus: 'ATTENDED' | 'NO_SHOW',
  requestingUser: AuthUser
): Promise<Booking> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { session: true },
  });

  if (!booking) {
    throw new NotFoundError(`Booking '${bookingId}' not found`);
  }

  // Trainer ownership check: Trainer must be the instructor of this class
  if (
    requestingUser.role === Role.TRAINER &&
    booking.session.trainerId !== requestingUser.userId
  ) {
    throw new ForbiddenError('You can only mark attendance for classes you instruct');
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new BadRequestError('Cannot mark attendance for a cancelled booking');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: newStatus },
  });
};
