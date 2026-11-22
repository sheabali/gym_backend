import { Role, Subscription, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AuthUser } from '../../types/express';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import * as paymentsService from '../payments/payments.service';

export const checkout = async (
  userId: string,
  planId: string
): Promise<paymentsService.CheckoutResult> => {
  return await paymentsService.initiateSubscriptionCheckout(userId, planId);
};

export const getMySubscriptions = async (
  userId: string,
  query: {
    status?: SubscriptionStatus;
    page?: number;
    limit?: number;
  }
): Promise<{
  subscriptions: Subscription[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> => {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: { userId: string; status?: SubscriptionStatus } = { userId };
  if (query.status) {
    where.status = query.status;
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    subscriptions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getSubscriptionById = async (
  id: string,
  requestingUser: AuthUser
): Promise<Subscription> => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      plan: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!subscription) {
    throw new NotFoundError(`Subscription '${id}' not found`);
  }

  // Ownership verification: Member can only view their own subscription
  if (requestingUser.role !== Role.ADMIN && subscription.userId !== requestingUser.userId) {
    throw new ForbiddenError('You do not have permission to view this subscription');
  }

  return subscription;
};

export const recordCashSubscription = async (
  adminUser: AuthUser,
  params: {
    userId: string;
    planId: string;
    method?: string;
    note?: string;
  }
) => {
  return await paymentsService.recordCashPayment(adminUser, params);
};
