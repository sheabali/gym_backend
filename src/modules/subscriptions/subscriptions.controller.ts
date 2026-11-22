import { Request, Response } from 'express';
import { SubscriptionStatus } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import * as subscriptionsService from './subscriptions.service';

export const checkoutSubscription = async (req: Request, res: Response): Promise<void> => {
  const { planId } = req.body;
  const result = await subscriptionsService.checkout(req.user!.userId, planId);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Subscription checkout initiated',
    data: result,
  });
};

export const getMySubscriptions = async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as SubscriptionStatus | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const result = await subscriptionsService.getMySubscriptions(req.user!.userId, {
    status,
    page,
    limit,
  });

  sendSuccess(res, {
    statusCode: 200,
    message: 'Subscriptions retrieved successfully',
    data: result,
  });
};

export const getSubscriptionById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const subscription = await subscriptionsService.getSubscriptionById(id, req.user!);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Subscription retrieved successfully',
    data: { subscription },
  });
};

export const adminRecordSubscription = async (req: Request, res: Response): Promise<void> => {
  const { userId, planId, method, note } = req.body;
  const result = await subscriptionsService.recordCashSubscription(req.user!, {
    userId,
    planId,
    method,
    note,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Offline subscription recorded and activated successfully',
    data: result,
  });
};
