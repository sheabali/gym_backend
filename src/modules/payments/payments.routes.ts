import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { asyncHandler } from '../../utils/asyncHandler';
import * as paymentsController from './payments.controller';
import { paymentStatusParamSchema } from './payments.schemas';

export const paymentsRouter = Router();

// SSLCommerz Callbacks & Webhook (Publicly reachable by gateway & browser redirects)
paymentsRouter.post(
  '/sslcommerz/success',
  asyncHandler(paymentsController.handleSslcommerzSuccess)
);

paymentsRouter.post(
  '/sslcommerz/fail',
  asyncHandler(paymentsController.handleSslcommerzFail)
);

paymentsRouter.post(
  '/sslcommerz/cancel',
  asyncHandler(paymentsController.handleSslcommerzCancel)
);

paymentsRouter.post(
  '/sslcommerz/ipn',
  asyncHandler(paymentsController.handleSslcommerzIpn)
);

// Payment Status Check (Protected: Member who owns it or Admin)
paymentsRouter.get(
  '/:tranId/status',
  authenticate,
  validateRequest(paymentStatusParamSchema),
  asyncHandler(paymentsController.getPaymentStatus)
);

// Admin Payment Reconciliation (Protected: Admin only)
paymentsRouter.post(
  '/reconcile',
  authenticate,
  requireRole(Role.ADMIN),
  asyncHandler(paymentsController.reconcilePayments)
);
