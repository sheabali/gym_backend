import { z } from 'zod';
import { SubscriptionStatus } from '@prisma/client';
import { RequestValidationSchema } from '../../middleware/validateRequest';

export const checkoutSchema: RequestValidationSchema = {
  body: z.object({
    planId: z.string().min(1, 'planId is required'),
  }),
};

export const adminRecordSubscriptionSchema: RequestValidationSchema = {
  body: z.object({
    userId: z.string().min(1, 'userId is required'),
    planId: z.string().min(1, 'planId is required'),
    method: z.string().optional().default('CASH'),
    note: z.string().optional(),
  }),
};

export const subscriptionIdParamSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
};

export const listSubscriptionsQuerySchema: RequestValidationSchema = {
  query: z.object({
    status: z.nativeEnum(SubscriptionStatus).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
};
