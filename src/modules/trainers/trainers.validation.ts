import { z } from 'zod';

export const createTrainerSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    phone: z.string().trim().min(10, 'Phone must be at least 10 characters').max(15),
    password: z.string().min(8, 'Password must be at least 8 characters').max(100),
    bio: z.string().trim().max(2000).optional(),
    specialties: z.array(z.string().trim().min(1)).optional().default([]),
    certifications: z.array(z.string().trim().min(1)).optional().default([]),
    photoUrl: z.string().url('Invalid photo URL').optional().or(z.literal('')),
    isPublic: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
  }),
};

export const updateTrainerProfileSchema = {
  body: z.object({
    bio: z.string().trim().max(2000).optional(),
    specialties: z.array(z.string().trim().min(1)).optional(),
    certifications: z.array(z.string().trim().min(1)).optional(),
    photoUrl: z.string().url('Invalid photo URL').optional().or(z.literal('')),
    isPublic: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
};

export const getTrainerByIdSchema = {
  params: z.object({
    id: z.string().min(1, 'Trainer ID is required'),
  }),
};

export type CreateTrainerInput = z.infer<typeof createTrainerSchema.body>;
export type UpdateTrainerProfileInput = z.infer<typeof updateTrainerProfileSchema.body>;
