import crypto from 'crypto';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config';
import { ConflictError, UnauthorizedError, ForbiddenError } from '../../utils/errors';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  sanitizeUser,
  SafeUser,
} from './auth.utils';
import { RegisterInput, LoginInput } from './auth.validation';

export interface AuthSessionResult {
  user: SafeUser;
  accessToken: string;
  rawRefreshToken: string;
}

export const registerUser = async (data: RegisterInput): Promise<AuthSessionResult> => {
  // Check for duplicate email or phone
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: data.phone }],
    },
  });

  if (existingUser) {
    throw new ConflictError('Email or phone number is already registered');
  }

  const passwordHash = await hashPassword(data.password);

  // Registration never accepts role: always forced to MEMBER
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: Role.MEMBER,
      status: UserStatus.ACTIVE,
    },
  });

  // Create refresh token session with family tracking
  const family = crypto.randomUUID();
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      family,
      tokenHash,
      expiresAt,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    rawRefreshToken,
  };
};

export const loginUser = async (data: LoginInput): Promise<AuthSessionResult> => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  // Generic message prevents username harvesting
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await comparePassword(data.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError('Your account has been suspended or deactivated');
  }

  // Issue new session
  const family = crypto.randomUUID();
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      family,
      tokenHash,
      expiresAt,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    rawRefreshToken,
  };
};

export const rotateRefreshToken = async (
  rawRefreshToken: string
): Promise<{ accessToken: string; newRawRefreshToken: string; user: SafeUser }> => {
  const tokenHash = hashToken(rawRefreshToken);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // REUSE DETECTION: If an already-revoked token is used, compromise is suspected
  if (tokenRecord.isRevoked) {
    // Revoke all sessions for this user to mitigate session theft
    await prisma.refreshToken.updateMany({
      where: { userId: tokenRecord.userId },
      data: { isRevoked: true },
    });
    throw new UnauthorizedError('Compromised session detected. All sessions revoked. Please log in again.');
  }

  if (tokenRecord.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });
    throw new UnauthorizedError('Refresh token expired');
  }

  if (tokenRecord.user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError('Account is not active');
  }

  const newRawRefreshToken = generateRefreshToken();
  const newHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  // Rotate in a single transaction: invalidate current token, create replacement in the same family
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    }),
    prisma.refreshToken.create({
      data: {
        userId: tokenRecord.userId,
        family: tokenRecord.family,
        tokenHash: newHash,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  const accessToken = generateAccessToken({
    userId: tokenRecord.user.id,
    email: tokenRecord.user.email,
    role: tokenRecord.user.role,
  });

  return {
    accessToken,
    newRawRefreshToken,
    user: sanitizeUser(tokenRecord.user),
  };
};

export const revokeSession = async (rawRefreshToken?: string): Promise<void> => {
  if (!rawRefreshToken) return;

  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { isRevoked: true },
  });
};

export const getCurrentUser = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { trainerProfile: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError('User not found or inactive');
  }

  return sanitizeUser(user);
};
