import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import * as trainersService from './trainers.service';

export const getTrainers = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = req.user?.role === Role.ADMIN;
  const includePrivate = isAdmin && req.query.includePrivate === 'true';

  const trainers = await trainersService.getAllTrainers(includePrivate);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Trainers retrieved successfully',
    data: { trainers },
  });
});

export const getTrainer = asyncHandler(async (req: Request, res: Response) => {
  const trainer = await trainersService.getTrainerById(req.params.id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Trainer profile retrieved',
    data: { trainer },
  });
});

export const createTrainer = asyncHandler(async (req: Request, res: Response) => {
  const trainer = await trainersService.createTrainer(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Trainer account and profile created successfully',
    data: { trainer },
  });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  // Enforces ownership check: trainer can only update their own profile
  const userId = req.user!.userId;
  const profile = await trainersService.updateTrainerProfile(userId, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Your trainer profile has been updated',
    data: { profile },
  });
});

export const updateTrainerProfile = asyncHandler(async (req: Request, res: Response) => {
  // Admin updating a specific trainer's profile
  const profile = await trainersService.updateTrainerProfile(req.params.id, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Trainer profile updated successfully',
    data: { profile },
  });
});
