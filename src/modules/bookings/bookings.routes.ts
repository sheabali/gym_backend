import { Router } from 'express';
import { Role } from '@prisma/client';
import { validateRequest } from '../../middleware/validateRequest';
import { authenticate, requireRole } from '../../middleware/auth';
import {
  createBookingSchema,
  cancelBookingSchema,
  updateAttendanceSchema,
  getSessionBookingsSchema,
} from './bookings.validation';
import * as bookingsController from './bookings.controller';

const router = Router();

// Member self-service routes
router.post(
  '/',
  authenticate,
  validateRequest(createBookingSchema),
  bookingsController.bookSession
);

router.get('/my', authenticate, bookingsController.getMyBookings);

router.post(
  '/:id/cancel',
  authenticate,
  validateRequest(cancelBookingSchema),
  bookingsController.cancelBooking
);

// Trainer & Admin roster and attendance routes
router.get(
  '/sessions/:sessionId',
  authenticate,
  requireRole(Role.TRAINER, Role.ADMIN),
  validateRequest(getSessionBookingsSchema),
  bookingsController.getSessionRoster
);

router.patch(
  '/:id/attendance',
  authenticate,
  requireRole(Role.TRAINER, Role.ADMIN),
  validateRequest(updateAttendanceSchema),
  bookingsController.markAttendance
);

export const bookingRoutes = router;
