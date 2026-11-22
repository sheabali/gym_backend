import { ContactStatus, PaymentStatus, Role, SessionStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../utils/errors';

export interface OverviewMetrics {
  members: {
    total: number;
    activeWithSubscription: number;
  };
  revenue: {
    monthlyPaisa: number;
    totalPaisa: number;
    currency: string;
  };
  today: {
    sessionsCount: number;
    bookingsCount: number;
    sessions: unknown[];
  };
  inbox: {
    newInquiriesCount: number;
  };
  payments: {
    pendingCount: number;
    recentSuccessful: unknown[];
  };
}

export const getOverviewMetrics = async (): Promise<OverviewMetrics> => {
  const now = new Date();

  // UTC Start of current calendar month
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

  // Dhaka (UTC+6) Start and End of today
  const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  dhakaNow.setUTCHours(0, 0, 0, 0);
  const startOfTodayUtc = new Date(dhakaNow.getTime() - DHAKA_OFFSET_MS);
  const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  const [
    totalMembers,
    activeWithSub,
    allSuccessfulPayments,
    monthlySuccessfulPayments,
    todaySessionsCount,
    todayBookingsCount,
    newInquiriesCount,
    pendingPaymentsCount,
    recentPayments,
    todaySessions,
  ] = await Promise.all([
    // Total registered members
    prisma.user.count({
      where: { role: Role.MEMBER },
    }),
    // Active members holding an active subscription covering today
    prisma.user.count({
      where: {
        role: Role.MEMBER,
        status: UserStatus.ACTIVE,
        subscriptions: {
          some: {
            status: SubscriptionStatus.ACTIVE,
            endDate: { gte: now },
          },
        },
      },
    }),
    // Lifetime successful revenue
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    }),
    // Current month successful revenue
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        paidAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    // Scheduled sessions today
    prisma.classSession.count({
      where: {
        startsAt: { gte: startOfTodayUtc, lte: endOfTodayUtc },
        status: { not: SessionStatus.CANCELLED },
      },
    }),
    // Bookings made today
    prisma.booking.count({
      where: {
        bookedAt: { gte: startOfTodayUtc, lte: endOfTodayUtc },
      },
    }),
    // Unread contact inbox messages
    prisma.contactMessage.count({
      where: { status: ContactStatus.NEW },
    }),
    // Unsettled pending payments
    prisma.payment.count({
      where: { status: PaymentStatus.PENDING },
    }),
    // Recent 5 successful payments
    prisma.payment.findMany({
      where: { status: PaymentStatus.SUCCESS },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        subscription: { select: { id: true, planName: true, startDate: true, endDate: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 5,
    }),
    // Today's classes schedule
    prisma.classSession.findMany({
      where: {
        startsAt: { gte: startOfTodayUtc, lte: endOfTodayUtc },
      },
      include: {
        classType: { select: { id: true, name: true, difficulty: true } },
        trainer: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  return {
    members: {
      total: totalMembers,
      activeWithSubscription: activeWithSub,
    },
    revenue: {
      monthlyPaisa: monthlySuccessfulPayments._sum.amount || 0,
      totalPaisa: allSuccessfulPayments._sum.amount || 0,
      currency: 'BDT',
    },
    today: {
      sessionsCount: todaySessionsCount,
      bookingsCount: todayBookingsCount,
      sessions: todaySessions,
    },
    inbox: {
      newInquiriesCount,
    },
    payments: {
      pendingCount: pendingPaymentsCount,
      recentSuccessful: recentPayments,
    },
  };
};

export const listMembers = async (query: {
  search?: string;
  status?: UserStatus;
  hasActiveSubscription?: boolean;
  page?: number;
  limit?: number;
}) => {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const now = new Date();
  const where: Record<string, unknown> = {
    role: Role.MEMBER,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.hasActiveSubscription === true) {
    where.subscriptions = {
      some: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gte: now },
      },
    };
  } else if (query.hasActiveSubscription === false) {
    where.subscriptions = {
      none: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gte: now },
      },
    };
  }

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        trialUsed: true,
        emergencyContact: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: {
          where: {
            status: SubscriptionStatus.ACTIVE,
            endDate: { gte: now },
          },
          select: {
            id: true,
            planName: true,
            status: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            bookings: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    members,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getMemberDetails = async (memberId: string) => {
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      trialUsed: true,
      emergencyContact: true,
      createdAt: true,
      updatedAt: true,
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
      bookings: {
        include: {
          session: {
            include: { classType: true },
          },
        },
        orderBy: { bookedAt: 'desc' },
        take: 20,
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!member) {
    throw new NotFoundError(`Member '${memberId}' not found`);
  }

  return member;
};

export const updateMemberStatus = async (
  memberId: string,
  newStatus: UserStatus
) => {
  const user = await prisma.user.findUnique({
    where: { id: memberId },
  });

  if (!user) {
    throw new NotFoundError(`User '${memberId}' not found`);
  }

  if (user.role === Role.ADMIN) {
    throw new BadRequestError('Cannot modify status of an administrative account');
  }

  // Update status and revoke refresh token sessions if suspended/deactivated
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: memberId },
      data: { status: newStatus },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    }),
    ...(newStatus !== UserStatus.ACTIVE
      ? [
          prisma.refreshToken.updateMany({
            where: { userId: memberId },
            data: { isRevoked: true },
          }),
        ]
      : []),
  ]);

  return updatedUser;
};
