import { z } from 'zod';
import { ContactStatus } from '@prisma/client';
import { RequestValidationSchema } from '../../middleware/validateRequest';

// Contact Schemas
export const createContactMessageSchema: RequestValidationSchema = {
  body: z
    .object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email address').optional(),
      phone: z.string().min(6, 'Phone number must be at least 6 digits').optional(),
      message: z.string().min(5, 'Message must be at least 5 characters'),
    })
    .refine((data) => Boolean(data.email || data.phone), {
      message: 'Either email or phone must be provided so we can contact you',
      path: ['email'],
    }) as unknown as z.AnyZodObject,
};

export const updateContactStatusSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Message ID is required'),
  }),
  body: z.object({
    status: z.nativeEnum(ContactStatus, {
      errorMap: () => ({ message: 'Status must be NEW, REPLIED, or CLOSED' }),
    }),
  }),
};

export const listContactMessagesSchema: RequestValidationSchema = {
  query: z.object({
    status: z.nativeEnum(ContactStatus).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
};

// FAQ Schemas
export const createFaqSchema: RequestValidationSchema = {
  body: z.object({
    question: z.string().min(3, 'Question must be at least 3 characters'),
    answer: z.string().min(3, 'Answer must be at least 3 characters'),
    sortOrder: z.coerce.number().int().optional().default(0),
    isPublished: z.boolean().optional().default(true),
  }),
};

export const updateFaqSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'FAQ ID is required'),
  }),
  body: z.object({
    question: z.string().min(3).optional(),
    answer: z.string().min(3).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isPublished: z.boolean().optional(),
  }),
};

export const faqIdParamSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'FAQ ID is required'),
  }),
};

// Announcement Schemas
export const createAnnouncementSchema: RequestValidationSchema = {
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    body: z.string().min(3, 'Body must be at least 3 characters'),
    isActive: z.boolean().optional().default(true),
    expiresAt: z.string().datetime().optional().nullable(),
  }),
};

export const updateAnnouncementSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Announcement ID is required'),
  }),
  body: z.object({
    title: z.string().min(3).optional(),
    body: z.string().min(3).optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
  }),
};

export const announcementIdParamSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Announcement ID is required'),
  }),
};

// Gallery Schemas
export const createGallerySchema: RequestValidationSchema = {
  body: z.object({
    url: z.string().url('A valid image URL is required'),
    caption: z.string().optional(),
    category: z.string().optional(),
    sortOrder: z.coerce.number().int().optional().default(0),
  }),
};

export const galleryIdParamSchema: RequestValidationSchema = {
  params: z.object({
    id: z.string().min(1, 'Gallery Image ID is required'),
  }),
};
