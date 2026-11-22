import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { asyncHandler } from '../../utils/asyncHandler';
import * as contentController from './content.controller';
import {
  announcementIdParamSchema,
  createAnnouncementSchema,
  createFaqSchema,
  createGallerySchema,
  faqIdParamSchema,
  galleryIdParamSchema,
  updateAnnouncementSchema,
  updateFaqSchema,
} from './content.schemas';

export const contentRouter = Router();

// ---------- FAQs ----------
contentRouter.get('/faq', asyncHandler(contentController.getFaqs));
contentRouter.post(
  '/faq',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createFaqSchema),
  asyncHandler(contentController.createFaq)
);
contentRouter.patch(
  '/faq/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(updateFaqSchema),
  asyncHandler(contentController.updateFaq)
);
contentRouter.delete(
  '/faq/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(faqIdParamSchema),
  asyncHandler(contentController.deleteFaq)
);

// ---------- Announcements ----------
contentRouter.get('/announcements', asyncHandler(contentController.getAnnouncements));
contentRouter.post(
  '/announcements',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createAnnouncementSchema),
  asyncHandler(contentController.createAnnouncement)
);
contentRouter.patch(
  '/announcements/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(updateAnnouncementSchema),
  asyncHandler(contentController.updateAnnouncement)
);
contentRouter.delete(
  '/announcements/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(announcementIdParamSchema),
  asyncHandler(contentController.deleteAnnouncement)
);

// ---------- Gallery Images ----------
contentRouter.get('/gallery', asyncHandler(contentController.getGallery));
contentRouter.post(
  '/gallery',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createGallerySchema),
  asyncHandler(contentController.createGalleryImage)
);
contentRouter.delete(
  '/gallery/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(galleryIdParamSchema),
  asyncHandler(contentController.deleteGalleryImage)
);
