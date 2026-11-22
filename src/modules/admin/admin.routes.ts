import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { asyncHandler } from '../../utils/asyncHandler';
import * as adminController from './admin.controller';
import {
  getMemberByIdSchema,
  listMembersQuerySchema,
  updateMemberStatusSchema,
} from './admin.schemas';

export const adminRouter = Router();

// All admin routes require ADMIN role
adminRouter.use(authenticate, requireRole(Role.ADMIN));

adminRouter.get('/overview', asyncHandler(adminController.getOverview));
adminRouter.get('/members', validateRequest(listMembersQuerySchema), asyncHandler(adminController.listMembers));
adminRouter.get('/members/:id', validateRequest(getMemberByIdSchema), asyncHandler(adminController.getMemberDetails));
adminRouter.patch(
  '/members/:id/status',
  validateRequest(updateMemberStatusSchema),
  asyncHandler(adminController.updateMemberStatus)
);
