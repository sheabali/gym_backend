import { Request, Response } from 'express';
import { UserStatus } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import * as adminService from './admin.service';

export const getOverview = async (_req: Request, res: Response): Promise<void> => {
  const metrics = await adminService.getOverviewMetrics();

  sendSuccess(res, {
    statusCode: 200,
    message: 'Admin overview metrics retrieved successfully',
    data: metrics,
  });
};

export const listMembers = async (req: Request, res: Response): Promise<void> => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const status = req.query.status as UserStatus | undefined;
  const hasActiveSubscription =
    req.query.hasActiveSubscription !== undefined
      ? req.query.hasActiveSubscription === 'true'
      : undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const result = await adminService.listMembers({
    search,
    status,
    hasActiveSubscription,
    page,
    limit,
  });

  sendSuccess(res, {
    statusCode: 200,
    message: 'Members retrieved successfully',
    data: result,
  });
};

export const getMemberDetails = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const member = await adminService.getMemberDetails(id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Member details retrieved successfully',
    data: { member },
  });
};

export const updateMemberStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  const user = await adminService.updateMemberStatus(id, status);

  sendSuccess(res, {
    statusCode: 200,
    message: `Member status updated to ${status}`,
    data: { user },
  });
};
