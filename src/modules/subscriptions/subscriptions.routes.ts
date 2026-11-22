import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { asyncHandler } from '../../utils/asyncHandler';
import * as subscriptionsController from './subscriptions.controller';
import {
  adminRecordSubscriptionSchema,
  checkoutSchema,
  listSubscriptionsQuerySchema,
  subscriptionIdParamSchema,
} from './subscriptions.schemas';

export const subscriptionsRouter = Router();

// Member Checkout Initiation
subscriptionsRouter.post(
  '/checkout',
  authenticate,
  validateRequest(checkoutSchema),
  asyncHandler(subscriptionsController.checkoutSubscription)
);

// Member Subscription History
subscriptionsRouter.get(
  '/my',
  authenticate,
  validateRequest(listSubscriptionsQuerySchema),
  asyncHandler(subscriptionsController.getMySubscriptions)
);

// Subscription Details by ID (Owner or Admin)
subscriptionsRouter.get(
  '/:id',
  authenticate,
  validateRequest(subscriptionIdParamSchema),
  asyncHandler(subscriptionsController.getSubscriptionById)
);

// Admin-Recorded Offline / Cash Payment
subscriptionsRouter.post(
  '/admin-record',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(adminRecordSubscriptionSchema),
  asyncHandler(subscriptionsController.adminRecordSubscription)
);
