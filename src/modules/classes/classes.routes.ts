import { Router } from 'express';
import { Role } from '@prisma/client';
import { validateRequest } from '../../middleware/validateRequest';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  createClassTypeSchema,
  updateClassTypeSchema,
  createSessionSchema,
  createRecurringSessionsSchema,
  updateSessionSchema,
  getSessionsQuerySchema,
} from './classes.validation';
import * as classesController from './classes.controller';

const router = Router();

// ---------- Class Types Routes ----------
router.get('/types', classesController.getClassTypes);
router.get('/types/:slug', classesController.getClassType);

router.post(
  '/types',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createClassTypeSchema),
  classesController.createClassType
);

router.patch(
  '/types/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(updateClassTypeSchema),
  classesController.updateClassType
);

router.delete(
  '/types/:id',
  authenticate,
  requireRole(Role.ADMIN),
  classesController.deleteClassType
);

// ---------- Class Sessions (Schedule) Routes ----------
router.get(
  '/sessions',
  validateRequest(getSessionsQuerySchema),
  classesController.getSessions
);

router.get('/sessions/:id', classesController.getSession);

router.post(
  '/sessions',
  authenticate,
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest(createSessionSchema),
  classesController.createSession
);

router.post(
  '/sessions/recurring',
  authenticate,
  requireRole(Role.ADMIN),
  validateRequest(createRecurringSessionsSchema),
  classesController.createRecurringSessions
);

router.patch(
  '/sessions/:id',
  authenticate,
  requireRole(Role.ADMIN, Role.TRAINER),
  validateRequest(updateSessionSchema),
  classesController.updateSession
);

router.delete(
  '/sessions/:id',
  authenticate,
  requireRole(Role.ADMIN),
  classesController.cancelSession
);

export const classRoutes = router;
