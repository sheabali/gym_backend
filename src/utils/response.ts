import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
  stack?: string;
}

export const sendSuccess = <T>(
  res: Response,
  {
    statusCode = 200,
    message = 'Success',
    data,
  }: {
    statusCode?: number;
    message?: string;
    data?: T;
  }
): Response => {
  const payload: ApiResponse<T> = {
    success: true,
    statusCode,
    message,
    ...(data !== undefined && { data }),
  };
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  {
    statusCode = 500,
    message = 'Internal server error',
    code = 'INTERNAL_SERVER_ERROR',
    details,
    stack,
  }: {
    statusCode?: number;
    message?: string;
    code?: string;
    details?: unknown;
    stack?: string;
  }
): Response => {
  const payload: ApiResponse = {
    success: false,
    statusCode,
    message,
    error: {
      code,
      ...(details !== undefined && { details }),
    },
    ...(stack !== undefined && { stack }),
  };
  return res.status(statusCode).json(payload);
};
