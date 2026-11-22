import { z } from 'zod';
import { Difficulty, SessionStatus } from '@prisma/client';

export const createClassTypeSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
    difficulty: z.nativeEnum(Difficulty).default(Difficulty.ALL_LEVELS),
    durationMinutes: z
      .number({ required_error: 'Duration in minutes is required' })
      .int()
      .min(15, 'Duration must be at least 15 minutes')
      .max(240, 'Duration cannot exceed 4 hours'),
    isActive: z.boolean().default(true),
  }),
};

export const updateClassTypeSchema = {
  params: z.object({
    id: z.string().min(1, 'Class type ID is required'),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    difficulty: z.nativeEnum(Difficulty).optional(),
    durationMinutes: z.number().int().min(15).max(240).optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createSessionSchema = {
  body: z.object({
    classTypeId: z.string().min(1, 'Class type ID is required'),
    trainerId: z.string().min(1, 'Trainer ID is required'),
    startsAt: z.string().datetime({ message: 'startsAt must be a valid ISO 8601 UTC date string' }),
    endsAt: z.string().datetime({ message: 'endsAt must be a valid ISO 8601 UTC date string' }).optional(),
    capacity: z.number().int().min(1, 'Capacity must be at least 1').max(100),
    room: z.string().trim().max(50).optional(),
  }),
};

export const createRecurringSessionsSchema = {
  body: z.object({
    classTypeId: z.string().min(1, 'Class type ID is required'),
    trainerId: z.string().min(1, 'Trainer ID is required'),
    firstStartsAt: z.string().datetime({ message: 'firstStartsAt must be a valid ISO 8601 date string' }),
    weeks: z.number().int().min(1).max(12).default(4),
    capacity: z.number().int().min(1).max(100),
    room: z.string().trim().max(50).optional(),
  }),
};

export const updateSessionSchema = {
  params: z.object({
    id: z.string().min(1, 'Session ID is required'),
  }),
  body: z.object({
    trainerId: z.string().optional(),
    capacity: z.number().int().min(1).max(100).optional(),
    room: z.string().trim().max(50).optional(),
    status: z.nativeEnum(SessionStatus).optional(),
  }),
};

export const getSessionsQuerySchema = {
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    classTypeId: z.string().optional(),
    trainerId: z.string().optional(),
    difficulty: z.nativeEnum(Difficulty).optional(),
  }),
};

export type CreateClassTypeInput = z.infer<typeof createClassTypeSchema.body>;
export type UpdateClassTypeInput = z.infer<typeof updateClassTypeSchema.body>;
export type CreateSessionInput = z.infer<typeof createSessionSchema.body>;
export type CreateRecurringSessionsInput = z.infer<typeof createRecurringSessionsSchema.body>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema.body>;
export type GetSessionsQuery = z.infer<typeof getSessionsQuerySchema.query>;
