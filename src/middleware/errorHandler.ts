import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { env } from '../config';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = env.NODE_ENV === 'production';
  const reqId = req.headers['x-request-id'] || 'no-req-id';

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, reqId }, `AppError [${err.statusCode}]: ${err.message}`);
    } else {
      logger.warn({ err, reqId }, `Client Error [${err.statusCode}]: ${err.message}`);
    }

    sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      details: err.details,
      stack: isProduction ? undefined : err.stack,
    });
    return;
  }

  // Generic 500 for unknown errors
  logger.error({ err, reqId }, `Unhandled Error: ${err.message}`);

  sendError(res, {
    statusCode: 500,
    message: 'An unexpected internal server error occurred.',
    code: 'INTERNAL_SERVER_ERROR',
    stack: isProduction ? undefined : err.stack,
  });
};
