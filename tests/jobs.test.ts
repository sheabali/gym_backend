import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  runSubscriptionExpiryJob,
  runPaymentReconciliationJob,
  startBackgroundJobs,
  stopBackgroundJobs,
} from '../src/jobs';
import * as paymentsService from '../src/modules/payments/payments.service';

describe('Background Scheduled Jobs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('runSubscriptionExpiryJob', () => {
    it('should sweep active subscriptions whose endDate has passed and set status to EXPIRED', async () => {
      const updateManySpy = vi
        .spyOn(prisma.subscription, 'updateMany')
        .mockResolvedValueOnce({ count: 5 });

      const result = await runSubscriptionExpiryJob();

      expect(result.expiredCount).toBe(5);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: SubscriptionStatus.ACTIVE,
            endDate: { lt: expect.any(Date) },
          },
          data: {
            status: SubscriptionStatus.EXPIRED,
          },
        })
      );
    });

    it('should propagate errors if database query fails', async () => {
      vi.spyOn(prisma.subscription, 'updateMany').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(runSubscriptionExpiryJob()).rejects.toThrow('Database connection failed');
    });
  });

  describe('runPaymentReconciliationJob', () => {
    it('should call reconcilePendingPayments and return reconciliation counts', async () => {
      const reconcileSpy = vi
        .spyOn(paymentsService, 'reconcilePendingPayments')
        .mockResolvedValueOnce({
          checkedCount: 3,
          activatedCount: 2,
          failedCount: 1,
        });

      const result = await runPaymentReconciliationJob();

      expect(reconcileSpy).toHaveBeenCalled();
      expect(result.activatedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });
  });

  describe('startBackgroundJobs & stopBackgroundJobs Lifecycle', () => {
    it('should initialize cron tasks and stop them without error', () => {
      expect(() => {
        startBackgroundJobs();
        stopBackgroundJobs();
      }).not.toThrow();
    });
  });
});
