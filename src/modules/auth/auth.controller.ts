import { Request, Response, CookieOptions } from 'express';
import { env } from '../../config';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { UnauthorizedError } from '../../utils/errors';
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  revokeSession,
  getCurrentUser,
} from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);

  res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    statusCode: 201,
    message: 'User registered successfully',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginUser(req.body);

  res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    statusCode: 200,
    message: 'Login successful',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token required');
  }

  const result = await rotateRefreshToken(rawRefreshToken);

  res.cookie(REFRESH_COOKIE_NAME, result.newRawRefreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    statusCode: 200,
    message: 'Token refreshed successfully',
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  await revokeSession(rawRefreshToken);

  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  });

  sendSuccess(res, {
    statusCode: 200,
    message: 'Logged out successfully',
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await getCurrentUser(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Current profile retrieved',
    data: { user },
  });
});
