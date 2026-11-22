import { Router } from 'express';
import { Role } from '@prisma/client';
import { validateRequest } from '../../middleware/validateRequest';
import { authenticate, requireRole } from '../../middleware/auth';
import { createPlanSchema, updatePlanSchema, getPlanBySlugSchema } from './plans.validation';
import * as plansController from './plans.controller';

const router = Router();

// Public routes
router.get('/', plansController.getPlans);
router.get('/:slug', validateRequest(getPlanBySlugSchema), plansController.getPlan);

// Admin-only management routes
router.post(
  '/',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createPlanSchema),
  plansController.createPlan
);

router.patch(
  '/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(updatePlanSchema),
  plansController.updatePlan
);

router.delete(
  '/:id',
  authenticate,
  requireRole(Role.ADMIN),
  plansController.deletePlan
);

export const planRoutes = router;
