import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Authentication & Authorization Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockHashedPassword = bcrypt.hashSync('Password123!', 10);

  const mockUser = {
    id: '674000000000000000000001',
    name: 'Rahim Ahmed',
    email: 'rahim@gym.com',
    phone: '+8801712345678',
    passwordHash: mockHashedPassword,
    role: Role.MEMBER,
    status: UserStatus.ACTIVE,
    photoUrl: null,
    emailVerifiedAt: null,
    emergencyContact: null,
    trialUsed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new member with role forced to MEMBER and set refresh cookie', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValueOnce({
        ...mockUser,
        role: Role.MEMBER,
      });
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValueOnce({
        id: 'token_1',
        userId: mockUser.id,
        family: 'fam_1',
        tokenHash: 'hash_1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Rahim Ahmed',
          email: 'rahim@gym.com',
          phone: '+8801712345678',
          password: 'Password123!',
          role: 'ADMIN', // Security check: attacker attempting to register as ADMIN
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('rahim@gym.com');
      // Role MUST be MEMBER, never ADMIN
      expect(res.body.data.user.role).toBe(Role.MEMBER);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();

      // Check for httpOnly refreshToken cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should reject registration if email or phone already exists with 409 Conflict', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Rahim Ahmed',
          email: 'rahim@gym.com',
          phone: '+8801712345678',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject registration with invalid email or short password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'R',
          email: 'not-an-email',
          phone: '123',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should log in successfully with valid credentials', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser);
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValueOnce({
        id: 'token_1',
        userId: mockUser.id,
        family: 'fam_1',
        tokenHash: 'hash_1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'rahim@gym.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('rahim@gym.com');
      expect(res.body.data.accessToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should return generic 401 error for non-existent email', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@gym.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return generic 401 error for incorrect password', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'rahim@gym.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should block suspended or deactivated users with 403', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'rahim@gym.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.message).toContain('suspended');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should rotate refresh token and issue new access token', async () => {
      const activeTokenRecord = {
        id: 'token_old',
        userId: mockUser.id,
        family: 'fam_1',
        tokenHash: 'hash_old',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        user: mockUser,
      };

      vi.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValueOnce(activeTokenRecord as unknown as Awaited<ReturnType<typeof prisma.refreshToken.findUnique>>);
      vi.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof prisma.refreshToken.update>>);
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof prisma.refreshToken.create>>);
      vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([{}, {}]);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refreshToken=valid-sample-refresh-token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('refreshToken=');
    });

    it('should detect reuse of a revoked token as theft and revoke all user sessions', async () => {
      const revokedTokenRecord = {
        id: 'token_compromised',
        userId: mockUser.id,
        family: 'fam_1',
        tokenHash: 'hash_compromised',
        isRevoked: true, // Already revoked/used!
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        user: mockUser,
      };

      vi.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValueOnce(
        revokedTokenRecord as unknown as Awaited<ReturnType<typeof prisma.refreshToken.findUnique>>
      );
      const updateManySpy = vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValueOnce({ count: 5 });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refreshToken=reused-stolen-token']);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Compromised session detected');
      // Verifies all user sessions were revoked
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { isRevoked: true },
      });
    });

    it('should return 401 if refresh token cookie is missing', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Refresh token required');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear refresh token cookie and revoke token in database', async () => {
      const updateManySpy = vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValueOnce({ count: 1 });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', ['refreshToken=active-token']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
      expect(updateManySpy).toHaveBeenCalled();

      // Check cookie was cleared (maxAge=0 or expires in past)
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/refreshToken=;/);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return authenticated user profile with valid Bearer token', async () => {
      const token = generateAccessToken({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(mockUser.email);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when Bearer token is invalid or expired', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Role-based Access Control (requireRole)', () => {
    it('should block MEMBER from accessing ADMIN-only route with 403 Forbidden', async () => {
      const memberToken = generateAccessToken({
        userId: mockUser.id,
        email: mockUser.email,
        role: Role.MEMBER,
      });

      // Import the router and mount a temporary protected admin route
      const express = (await import('express')).default;
      const { authenticate, requireRole } = await import('../src/middleware/auth');
      const { sendSuccess } = await import('../src/utils/response');
      const { errorHandler } = await import('../src/middleware/errorHandler');

      const testApp = express();
      testApp.use(express.json());

      testApp.get(
        '/admin-only',
        authenticate,
        requireRole(Role.ADMIN),
        (_req, res) => {
          sendSuccess(res, { message: 'Admin access granted' });
        }
      );
      testApp.use(errorHandler);

      const res = await request(testApp)
        .get('/admin-only')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN to access ADMIN-only route', async () => {
      const adminToken = generateAccessToken({
        userId: 'admin_id_1',
        email: 'admin@gym.com',
        role: Role.ADMIN,
      });

      const express = (await import('express')).default;
      const { authenticate, requireRole } = await import('../src/middleware/auth');
      const { sendSuccess } = await import('../src/utils/response');
      const { errorHandler } = await import('../src/middleware/errorHandler');

      const testApp = express();
      testApp.use(express.json());

      testApp.get(
        '/admin-only',
        authenticate,
        requireRole(Role.ADMIN),
        (_req, res) => {
          sendSuccess(res, { message: 'Admin access granted' });
        }
      );
      testApp.use(errorHandler);

      const res = await request(testApp)
        .get('/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Admin access granted');
    });
  });
});
