import { z } from 'zod';

export const createPlanSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
    description: z.string().trim().max(1000).optional(),
    price: z
      .number({
        required_error: 'Price in paisa is required',
      })
      .int('Price must be an integer in paisa')
      .positive('Price must be greater than zero'),
    durationDays: z
      .number({
        required_error: 'Duration in days is required',
      })
      .int('Duration must be an integer')
      .min(1, 'Duration must be at least 1 day')
      .max(3650, 'Duration cannot exceed 10 years'),
    features: z
      .array(z.string().trim().min(1, 'Feature description cannot be empty'))
      .min(1, 'At least one feature is required'),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  }),
};

export const updatePlanSchema = {
  params: z.object({
    id: z.string().min(1, 'Plan ID is required'),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
    description: z.string().trim().max(1000).optional(),
    price: z.number().int().positive().optional(),
    durationDays: z.number().int().min(1).max(3650).optional(),
    features: z.array(z.string().trim().min(1)).min(1).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
};

export const getPlanBySlugSchema = {
  params: z.object({
    slug: z.string().min(1, 'Plan slug or ID is required'),
  }),
};

export type CreatePlanInput = z.infer<typeof createPlanSchema.body>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema.body>;
