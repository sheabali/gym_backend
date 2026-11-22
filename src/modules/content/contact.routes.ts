import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { asyncHandler } from '../../utils/asyncHandler';
import * as contentController from './content.controller';
import {
  createContactMessageSchema,
  listContactMessagesSchema,
  updateContactStatusSchema,
} from './content.schemas';

export const contactRouter = Router();

// Public contact inquiry submission
contactRouter.post(
  '/',
  validateRequest(createContactMessageSchema),
  asyncHandler(contentController.submitContactMessage)
);

// Admin-only contact messages management
contactRouter.get(
  '/',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(listContactMessagesSchema),
  asyncHandler(contentController.listContactMessages)
);

contactRouter.patch(
  '/:id/status',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(updateContactStatusSchema),
  asyncHandler(contentController.updateContactStatus)
);
