import { Request, Response } from 'express';
import { sendError } from '../utils/response';

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, {
    statusCode: 404,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
};
