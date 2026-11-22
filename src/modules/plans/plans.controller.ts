import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import * as plansService from './plans.service';

export const getPlans = asyncHandler(async (req: Request, res: Response) => {
  // Only admins can view inactive plans
  const isAdmin = req.user?.role === Role.ADMIN;
  const includeInactive = isAdmin && req.query.includeInactive === 'true';

  const plans = await plansService.getAllPlans(includeInactive);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Membership plans retrieved successfully',
    data: { plans },
  });
});

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await plansService.getPlanBySlugOrId(req.params.slug);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Membership plan details retrieved',
    data: { plan },
  });
});

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await plansService.createPlan(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Membership plan created successfully',
    data: { plan },
  });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await plansService.updatePlan(req.params.id, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Membership plan updated successfully',
    data: { plan },
  });
});

export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await plansService.deactivatePlan(req.params.id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Membership plan deactivated successfully',
    data: { plan },
  });
});
