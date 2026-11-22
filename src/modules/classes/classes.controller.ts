import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import * as classesService from './classes.service';

// ---------- Class Types Controllers ----------

export const getClassTypes = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = req.user?.role === Role.ADMIN;
  const includeInactive = isAdmin && req.query.includeInactive === 'true';

  const classTypes = await classesService.getAllClassTypes(includeInactive);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class types retrieved successfully',
    data: { classTypes },
  });
});

export const getClassType = asyncHandler(async (req: Request, res: Response) => {
  const classType = await classesService.getClassTypeBySlugOrId(req.params.slug);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class type details retrieved',
    data: { classType },
  });
});

export const createClassType = asyncHandler(async (req: Request, res: Response) => {
  const classType = await classesService.createClassType(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Class type created successfully',
    data: { classType },
  });
});

export const updateClassType = asyncHandler(async (req: Request, res: Response) => {
  const classType = await classesService.updateClassType(req.params.id, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class type updated successfully',
    data: { classType },
  });
});

export const deleteClassType = asyncHandler(async (req: Request, res: Response) => {
  const classType = await classesService.deactivateClassType(req.params.id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class type deactivated successfully',
    data: { classType },
  });
});

// ---------- Class Sessions Controllers ----------

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await classesService.getSessions(req.query);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class schedule sessions retrieved',
    data: { sessions },
  });
});

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await classesService.getSessionById(req.params.id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class session details retrieved',
    data: {
      session,
      spotsRemaining: Math.max(0, session.capacity - session.bookedCount),
    },
  });
});

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await classesService.createSession(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Class session scheduled successfully',
    data: { session },
  });
});

export const createRecurringSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await classesService.createRecurringWeeklySessions(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: `${sessions.length} recurring class sessions generated successfully`,
    data: { sessions },
  });
});

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await classesService.updateSession(req.params.id, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class session updated successfully',
    data: { session },
  });
});

export const cancelSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await classesService.cancelSession(req.params.id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Class session cancelled successfully',
    data: { session },
  });
});
