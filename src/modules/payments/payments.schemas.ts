import { z } from 'zod';
import { RequestValidationSchema } from '../../middleware/validateRequest';

export const paymentStatusParamSchema: RequestValidationSchema = {
  params: z.object({
    tranId: z.string().min(1, 'Transaction ID is required'),
  }),
};

export const sslcommerzCallbackSchema: RequestValidationSchema = {
  body: z.object({}).passthrough(),
};

export const adminRecordPaymentSchema: RequestValidationSchema = {
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    planId: z.string().min(1, 'Plan ID is required'),
    method: z.string().optional(),
    note: z.string().optional(),
  }),
};
