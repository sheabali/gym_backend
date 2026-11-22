import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendError } from '../../utils/response';
import { checkHealth } from './health.service';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const result = await checkHealth();
  if (result.status === 'UP') {
    sendSuccess(res, {
      statusCode: 200,
      message: 'Server is healthy',
      data: result,
    });
  } else {
    sendError(res, {
      statusCode: 503,
      message: 'Service unavailable - database connection issue',
      code: 'SERVICE_UNAVAILABLE',
      details: result,
    });
  }
});
