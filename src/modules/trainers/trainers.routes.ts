import { Router } from 'express';
import { Role } from '@prisma/client';
import { validateRequest } from '../../middleware/validateRequest';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  createTrainerSchema,
  updateTrainerProfileSchema,
  getTrainerByIdSchema,
} from './trainers.validation';
import * as trainersController from './trainers.controller';

const router = Router();

// Public routes
router.get('/', trainersController.getTrainers);
router.get('/:id', validateRequest(getTrainerByIdSchema), trainersController.getTrainer);

// Trainer self-service route (Ownership check enforced via req.user.userId)
router.patch(
  '/me',
  authenticate,
  requireRole(Role.TRAINER),
  validateRequest(updateTrainerProfileSchema),
  trainersController.updateMyProfile
);

// Admin management routes
router.post(
  '/',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createTrainerSchema),
  trainersController.createTrainer
);

router.patch(
  '/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(updateTrainerProfileSchema),
  trainersController.updateTrainerProfile
);

export const trainerRoutes = router;
