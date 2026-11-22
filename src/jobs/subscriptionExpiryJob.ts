import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Sweeps active subscriptions whose endDate has passed and transitions them to EXPIRED.
 * Utilizes the compound index @@index([status, endDate]) on Subscription.
 */
export const runSubscriptionExpiryJob = async (): Promise<{ expiredCount: number }> => {
  const now = new Date();
  logger.info({ timestamp: now.toISOString() }, 'Running Subscription Expiry Job...');

  try {
    const result = await prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lt: now },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    logger.info(
      { expiredCount: result.count },
      `Subscription Expiry Job completed: ${result.count} subscriptions marked as EXPIRED`
    );

    return { expiredCount: result.count };
  } catch (error) {
    logger.error({ error }, 'Failed to execute Subscription Expiry Job');
    throw error;
  }
};
