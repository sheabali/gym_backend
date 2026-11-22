import { z } from 'zod';
import { UserStatus } from '@prisma/client';
import { RequestValidationSchema } from '../../middleware/validateRequest';

export const updateMemberStatusSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Member ID is required'),
  }),
  body: z.object({
    status: z.nativeEnum(UserStatus, {
      errorMap: () => ({ message: 'Status must be ACTIVE, SUSPENDED, or DEACTIVATED' }),
    }),
  }),
};

export const listMembersQuerySchema: RequestValidationSchema = {
  query: z.object({
    search: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional(),
    hasActiveSubscription: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
};

export const getMemberByIdSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Member ID is required'),
  }),
};
