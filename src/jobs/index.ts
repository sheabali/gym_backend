import cron, { ScheduledTask } from 'node-cron';
import { runSubscriptionExpiryJob } from './subscriptionExpiryJob';
import { runPaymentReconciliationJob } from './paymentReconciliationJob';
import { BUSINESS_RULES } from '../config/businessRules';
import { logger } from '../utils/logger';

export * from './subscriptionExpiryJob';
export * from './paymentReconciliationJob';

const scheduledTasks: ScheduledTask[] = [];

/**
 * Initializes and starts all periodic background cron tasks.
 */
export const startBackgroundJobs = (): void => {
  logger.info('Initializing background cron jobs...');

  // 1. Subscription Expiry Job: Runs daily at 00:05 (midnight) in Asia/Dhaka timezone
  const expiryTask = cron.schedule(
    '5 0 * * *',
    async () => {
      try {
        await runSubscriptionExpiryJob();
      } catch (err) {
        logger.error({ err }, 'Error in scheduled SubscriptionExpiryJob');
      }
    },
    {
      timezone: BUSINESS_RULES.TIMEZONE,
    }
  );
  scheduledTasks.push(expiryTask);
  logger.info(`⏰ Registered SubscriptionExpiryJob (Daily 00:05 ${BUSINESS_RULES.TIMEZONE})`);

  // 2. Payment Reconciliation Job: Runs every 15 minutes
  const reconciliationTask = cron.schedule(
    '*/15 * * * *',
    async () => {
      try {
        await runPaymentReconciliationJob();
      } catch (err) {
        logger.error({ err }, 'Error in scheduled PaymentReconciliationJob');
      }
    }
  );
  scheduledTasks.push(reconciliationTask);
  logger.info('⏰ Registered PaymentReconciliationJob (Every 15 minutes)');
};

/**
 * Gracefully stops all active cron jobs before process termination.
 */
export const stopBackgroundJobs = (): void => {
  logger.info(`Stopping ${scheduledTasks.length} background cron jobs...`);
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  logger.info('All background cron jobs stopped.');
};
