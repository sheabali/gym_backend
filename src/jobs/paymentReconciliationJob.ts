import { reconcilePendingPayments } from '../modules/payments/payments.service';
import { logger } from '../utils/logger';

/**
 * Periodically checks stale PENDING payments against the PaymentGateway
 * and recovers any lost callbacks or network disconnects.
 */
export const runPaymentReconciliationJob = async () => {
  logger.info('Running Payment Reconciliation Job...');
  try {
    const result = await reconcilePendingPayments();
    logger.info(
      result,
      `Payment Reconciliation Job completed: Checked ${result.checkedCount}, Activated ${result.activatedCount}, Failed ${result.failedCount}`
    );
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to execute Payment Reconciliation Job');
    throw error;
  }
};
