import crypto from 'crypto';
import { Payment, PaymentStatus, Prisma, Role, Subscription, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config';
import { BUSINESS_RULES } from '../../config/businessRules';
import { AuthUser } from '../../types/express';
import { getDhakaEndOfDay, nowInUtc } from '../../utils/date';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors';
import { logger } from '../../utils/logger';
import { getPaymentGateway } from './gateway';

export interface CheckoutResult {
  subscriptionId: string;
  tranId: string;
  gatewayPageURL: string;
}

export interface PaymentStatusResult {
  tranId: string;
  status: PaymentStatus;
  amountPaisa: number;
  currency: string;
  method?: string | null;
  valId?: string | null;
  bankTranId?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  subscription: {
    id: string;
    planName: string;
    status: SubscriptionStatus;
    startDate?: Date | null;
    endDate?: Date | null;
  };
}

/**
 * Initiates an SSLCommerz hosted checkout session for a membership plan.
 * Creates PENDING Subscription and Payment records with snapshot pricing.
 */
export const initiateSubscriptionCheckout = async (
  userId: string,
  planId: string
): Promise<CheckoutResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError(`User '${userId}' not found`);
  }

  if (user.status !== 'ACTIVE') {
    throw new ForbiddenError(`Account status is ${user.status}. Only active accounts can purchase subscriptions.`);
  }

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new NotFoundError(`Membership plan '${planId}' not found`);
  }

  if (!plan.isActive) {
    throw new BadRequestError('This membership plan is no longer available for purchase');
  }

  // Generate unique transaction ID (Section 5 & 8)
  const tranId = `GYM-TX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Create PENDING Subscription & Payment in atomic transaction
  const { subscription } = await prisma.$transaction(async (tx) => {
    const newSub = await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        planName: plan.name,
        pricePaid: plan.price, // Paisa snapshot
        status: SubscriptionStatus.PENDING,
      },
    });

    await tx.payment.create({
      data: {
        subscriptionId: newSub.id,
        userId: user.id,
        tranId,
        amount: plan.price,
        currency: 'BDT',
        status: PaymentStatus.PENDING,
      },
    });

    return { subscription: newSub };
  });

  // Call Gateway to initiate hosted checkout
  const gateway = getPaymentGateway();
  const initResult = await gateway.initPayment({
    tranId,
    amountPaisa: plan.price,
    currency: 'BDT',
    planName: plan.name,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: user.phone,
    successUrl: `${env.BACKEND_URL}/api/v1/payments/sslcommerz/success`,
    failUrl: `${env.BACKEND_URL}/api/v1/payments/sslcommerz/fail`,
    cancelUrl: `${env.BACKEND_URL}/api/v1/payments/sslcommerz/cancel`,
    ipnUrl: `${env.BACKEND_URL}/api/v1/payments/sslcommerz/ipn`,
  });

  return {
    subscriptionId: subscription.id,
    tranId,
    gatewayPageURL: initResult.gatewayPageURL,
  };
};

/**
 * Idempotent, atomic payment success processor.
 * Guarantees that duplicate callbacks (IPN + browser redirect) do not double-credit.
 * Enforces amount tampering verification and subscription renewal stacking.
 */
export const processSuccessfulPayment = async (
  tranId: string,
  valId: string,
  paymentDetails: {
    amountPaisa: number;
    currency: string;
    method?: string;
    bankTranId?: string;
    rawResponse: Record<string, unknown>;
  }
): Promise<{ payment: Payment; subscription?: Subscription; alreadyProcessed: boolean }> => {
  const payment = await prisma.payment.findUnique({
    where: { tranId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!payment) {
    throw new NotFoundError(`Payment with tranId '${tranId}' not found`);
  }

  // 1. Anti-Tampering Check: Confirm amount and currency match DB record
  if (payment.amount !== paymentDetails.amountPaisa) {
    logger.error(
      { tranId, expectedAmount: payment.amount, receivedAmount: paymentDetails.amountPaisa },
      'Payment amount mismatch! Potential fraud or payload tampering detected.'
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        valId,
        gatewayResponse: paymentDetails.rawResponse as unknown as Prisma.InputJsonValue,
      },
    });

    throw new BadRequestError('Payment amount verification failed: amount mismatch');
  }

  if (payment.currency !== paymentDetails.currency) {
    logger.error(
      { tranId, expectedCurrency: payment.currency, receivedCurrency: paymentDetails.currency },
      'Payment currency mismatch!'
    );
    throw new BadRequestError('Payment currency verification failed');
  }

  // 2. Idempotency Check: If already marked SUCCESS, do not re-activate
  if (payment.status === PaymentStatus.SUCCESS) {
    logger.info({ tranId }, 'Payment was already processed successfully. Returning idempotently.');
    return {
      payment,
      subscription: payment.subscription,
      alreadyProcessed: true,
    };
  }

  // 3. Stacking Renewal Calculation (Section 6)
  // Check if user has an existing active subscription expiring in the future
  const now = nowInUtc();
  const existingActive = await prisma.subscription.findMany({
    where: {
      userId: payment.userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: now },
    },
    orderBy: { endDate: 'desc' },
    take: 1,
  });

  let startDate: Date;
  if (existingActive.length > 0 && existingActive[0].endDate) {
    // Stack renewal: start date begins when the currently active subscription ends
    startDate = existingActive[0].endDate;
  } else {
    // Immediate activation
    startDate = now;
  }

  const durationDays = payment.subscription.plan.durationDays;
  const endDate = getDhakaEndOfDay(startDate, durationDays);

  // 4. Atomic conditional update via Prisma transaction
  return await prisma.$transaction(async (tx) => {
    // Conditional update: only proceed if status is still PENDING
    const updateResult = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.SUCCESS,
        valId,
        method: paymentDetails.method || payment.method,
        bankTranId: paymentDetails.bankTranId,
        gatewayResponse: paymentDetails.rawResponse as unknown as Prisma.InputJsonValue,
        paidAt: now,
      },
    });

    if (updateResult.count === 0) {
      // Concurrently updated by another process/IPN
      const updatedCurrent = await tx.payment.findUnique({
        where: { id: payment.id },
        include: { subscription: true },
      });
      return {
        payment: updatedCurrent!,
        subscription: updatedCurrent!.subscription,
        alreadyProcessed: true,
      };
    }

    // Activate the subscription
    const updatedSub = await tx.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      },
    });

    const finalPayment = await tx.payment.findUnique({
      where: { id: payment.id },
      include: { subscription: true },
    });

    logger.info(
      { tranId, subscriptionId: updatedSub.id, startDate, endDate },
      'Subscription successfully activated with stacked validity'
    );

    return {
      payment: finalPayment!,
      subscription: updatedSub,
      alreadyProcessed: false,
    };
  });
};

/**
 * Handles browser redirect POST from SSLCommerz upon payment success.
 */
export const handleSuccessCallback = async (payload: Record<string, unknown>) => {
  const tranId = String(payload.tran_id || '');
  const valId = String(payload.val_id || '');

  if (!tranId || !valId) {
    throw new BadRequestError('Invalid success callback: missing tran_id or val_id');
  }

  const gateway = getPaymentGateway();
  const validation = await gateway.validatePayment({ valId, tranId });

  if (validation.status !== 'VALID') {
    logger.warn({ tranId, valId, status: validation.status }, 'Gateway returned non-valid status');
    throw new BadRequestError(`Payment validation failed with status ${validation.status}`);
  }

  return await processSuccessfulPayment(tranId, valId, {
    amountPaisa: validation.amountPaisa,
    currency: validation.currency,
    method: validation.cardType,
    bankTranId: validation.bankTranId,
    rawResponse: validation.rawResponse,
  });
};

/**
 * Handles browser redirect POST from SSLCommerz upon payment failure.
 */
export const handleFailCallback = async (payload: Record<string, unknown>) => {
  const tranId = String(payload.tran_id || '');
  if (!tranId) {
    throw new BadRequestError('Invalid fail callback: missing tran_id');
  }

  const payment = await prisma.payment.findUnique({
    where: { tranId },
    include: { subscription: true },
  });

  if (!payment) {
    throw new NotFoundError(`Payment with tranId '${tranId}' not found`);
  }

  if (payment.status === PaymentStatus.SUCCESS) {
    // If already successful, do not mark as failed
    return { payment, subscription: payment.subscription };
  }

  return await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: payload as unknown as Prisma.InputJsonValue,
      },
      include: { subscription: true },
    });

    let updatedSub = payment.subscription;
    if (payment.subscription.status === SubscriptionStatus.PENDING) {
      updatedSub = await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    }

    return { payment: updatedPayment, subscription: updatedSub };
  });
};

/**
 * Handles browser redirect POST from SSLCommerz upon payment cancellation.
 */
export const handleCancelCallback = async (payload: Record<string, unknown>) => {
  const tranId = String(payload.tran_id || '');
  if (!tranId) {
    throw new BadRequestError('Invalid cancel callback: missing tran_id');
  }

  const payment = await prisma.payment.findUnique({
    where: { tranId },
    include: { subscription: true },
  });

  if (!payment) {
    throw new NotFoundError(`Payment with tranId '${tranId}' not found`);
  }

  if (payment.status === PaymentStatus.SUCCESS) {
    return { payment, subscription: payment.subscription };
  }

  return await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CANCELLED,
        gatewayResponse: payload as unknown as Prisma.InputJsonValue,
      },
      include: { subscription: true },
    });

    let updatedSub = payment.subscription;
    if (payment.subscription.status === SubscriptionStatus.PENDING) {
      updatedSub = await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    }

    return { payment: updatedPayment, subscription: updatedSub };
  });
};

/**
 * Handles server-to-server IPN webhook from SSLCommerz.
 */
export const handleIpnWebhook = async (payload: Record<string, unknown>) => {
  const tranId = String(payload.tran_id || '');
  const valId = String(payload.val_id || '');

  if (!tranId || !valId) {
    throw new BadRequestError('Invalid IPN payload: missing tran_id or val_id');
  }

  const gateway = getPaymentGateway();

  // Signature validation if verify_sign is provided
  if (!gateway.verifySignature(payload)) {
    logger.warn({ tranId, valId }, 'IPN signature verification failed');
    throw new BadRequestError('IPN signature verification failed');
  }

  const validation = await gateway.validatePayment({ valId, tranId });

  if (validation.status !== 'VALID') {
    logger.warn({ tranId, status: validation.status }, 'IPN validation check failed');
    throw new BadRequestError(`Gateway reported status ${validation.status}`);
  }

  return await processSuccessfulPayment(tranId, valId, {
    amountPaisa: validation.amountPaisa,
    currency: validation.currency,
    method: validation.cardType,
    bankTranId: validation.bankTranId,
    rawResponse: validation.rawResponse,
  });
};

/**
 * Retrieves payment status by tranId for frontend result page.
 * Enforces ownership check (member or admin).
 */
export const getPaymentStatus = async (
  tranId: string,
  requestingUser: AuthUser
): Promise<PaymentStatusResult> => {
  const payment = await prisma.payment.findUnique({
    where: { tranId },
    include: {
      subscription: true,
    },
  });

  if (!payment) {
    throw new NotFoundError(`Payment '${tranId}' not found`);
  }

  if (requestingUser.role !== Role.ADMIN && payment.userId !== requestingUser.userId) {
    throw new ForbiddenError('You do not have permission to view this payment');
  }

  return {
    tranId: payment.tranId,
    status: payment.status,
    amountPaisa: payment.amount,
    currency: payment.currency,
    method: payment.method,
    valId: payment.valId,
    bankTranId: payment.bankTranId,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    subscription: {
      id: payment.subscription.id,
      planName: payment.subscription.planName,
      status: payment.subscription.status,
      startDate: payment.subscription.startDate,
      endDate: payment.subscription.endDate,
    },
  };
};

/**
 * Records an offline/cash payment by an Admin.
 * Immediately creates an ACTIVE subscription and a SUCCESS payment.
 */
export const recordCashPayment = async (
  _adminUser: AuthUser,
  params: {
    userId: string;
    planId: string;
    method?: string;
    note?: string;
  }
): Promise<{ subscription: Subscription; payment: Payment }> => {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new NotFoundError(`User '${params.userId}' not found`);
  }

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: params.planId },
  });

  if (!plan) {
    throw new NotFoundError(`Membership plan '${params.planId}' not found`);
  }

  // Renewal stacking
  const now = nowInUtc();
  const existingActive = await prisma.subscription.findMany({
    where: {
      userId: user.id,
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: now },
    },
    orderBy: { endDate: 'desc' },
    take: 1,
  });

  let startDate: Date;
  if (existingActive.length > 0 && existingActive[0].endDate) {
    startDate = existingActive[0].endDate;
  } else {
    startDate = now;
  }

  const endDate = getDhakaEndOfDay(startDate, plan.durationDays);
  const tranId = `GYM-CASH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  return await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        planName: plan.name,
        pricePaid: plan.price,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      },
    });

    const payment = await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: user.id,
        tranId,
        amount: plan.price,
        currency: 'BDT',
        status: PaymentStatus.SUCCESS,
        method: params.method || 'CASH',
        paidAt: now,
        gatewayResponse: (params.note ? { note: params.note } : undefined) as unknown as Prisma.InputJsonValue | undefined,
      },
    });

    return { subscription, payment };
  });
};

/**
 * Reconciles PENDING payments older than PENDING_PAYMENT_EXPIRY_MINUTES against Gateway.
 * Resolves lost callbacks to ensure members are not left pending.
 */
export const reconcilePendingPayments = async (): Promise<{
  checkedCount: number;
  activatedCount: number;
  failedCount: number;
}> => {
  const cutoffTime = new Date(Date.now() - BUSINESS_RULES.PENDING_PAYMENT_EXPIRY_MINUTES * 60 * 1000);

  const pendingPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      createdAt: { lte: cutoffTime },
    },
    take: 50,
  });

  const gateway = getPaymentGateway();
  let activatedCount = 0;
  let failedCount = 0;

  for (const payment of pendingPayments) {
    try {
      const queryResult = await gateway.queryTransaction(payment.tranId);

      if (queryResult.status === 'VALID' && queryResult.valId) {
        await processSuccessfulPayment(payment.tranId, queryResult.valId, {
          amountPaisa: queryResult.amountPaisa,
          currency: queryResult.currency,
          method: queryResult.cardType,
          bankTranId: queryResult.bankTranId,
          rawResponse: queryResult.rawResponse,
        });
        activatedCount += 1;
      } else if (queryResult.status === 'FAILED' || queryResult.status === 'CANCELLED') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: queryResult.status === 'CANCELLED' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED,
              gatewayResponse: queryResult.rawResponse as unknown as Prisma.InputJsonValue,
            },
          });
          await tx.subscription.update({
            where: { id: payment.subscriptionId },
            data: { status: SubscriptionStatus.CANCELLED },
          });
        });
        failedCount += 1;
      }
    } catch (err) {
      logger.error({ err, tranId: payment.tranId }, 'Error reconciling payment');
    }
  }

  return {
    checkedCount: pendingPayments.length,
    activatedCount,
    failedCount,
  };
};
