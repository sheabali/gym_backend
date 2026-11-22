import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { planRoutes } from './modules/plans/plans.routes';
import { trainerRoutes } from './modules/trainers/trainers.routes';
import { classRoutes } from './modules/classes/classes.routes';
import { bookingRoutes } from './modules/bookings/bookings.routes';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { contentRouter } from './modules/content/content.routes';
import { contactRouter } from './modules/content/contact.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/plans', planRoutes);
router.use('/trainers', trainerRoutes);
router.use('/classes', classRoutes);
router.use('/bookings', bookingRoutes);
router.use('/subscriptions', subscriptionsRouter);
router.use('/payments', paymentsRouter);
router.use('/admin', adminRouter);
router.use('/content', contentRouter);
router.use('/contact', contactRouter);

export const apiRouter = router;
