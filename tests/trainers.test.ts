import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Trainer Profiles Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = generateAccessToken({
    userId: 'admin_user_id_1',
    email: 'admin@gym.com',
    role: Role.ADMIN,
  });

  const trainerUser = {
    id: '674000000000000000000020',
    name: 'Tanvir Ahmed',
    email: 'trainer@gym.com',
    phone: '+8801700000001',
    passwordHash: 'hashed_pass',
    role: Role.TRAINER,
    status: UserStatus.ACTIVE,
    photoUrl: 'https://images.unsplash.com/photo-trainer.jpg',
    emailVerifiedAt: null,
    emergencyContact: null,
    trialUsed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const trainerToken = generateAccessToken({
    userId: trainerUser.id,
    email: trainerUser.email,
    role: Role.TRAINER,
  });

  const memberToken = generateAccessToken({
    userId: 'member_user_id_1',
    email: 'member@gym.com',
    role: Role.MEMBER,
  });

  const mockProfile = {
    id: '674000000000000000000021',
    userId: trainerUser.id,
    bio: 'Strength & conditioning coach with 8+ years experience.',
    specialties: ['Strength Training', 'HIIT'],
    certifications: ['NSCA-CSCS'],
    photoUrl: 'https://images.unsplash.com/photo-trainer.jpg',
    isPublic: true,
    sortOrder: 1,
  };

  describe('GET /api/v1/trainers', () => {
    it('should return a list of public trainers', async () => {
      vi.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([
        {
          ...trainerUser,
          trainerProfile: mockProfile,
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);

      const res = await request(app).get('/api/v1/trainers');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.trainers)).toBe(true);
      expect(res.body.data.trainers[0].name).toBe('Tanvir Ahmed');
      expect(res.body.data.trainers[0].trainerProfile.specialties).toContain('Strength Training');
      expect(res.body.data.trainers[0].passwordHash).toBeUndefined();
    });
  });

  describe('GET /api/v1/trainers/:id', () => {
    it('should return a single trainer profile by ID', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        ...trainerUser,
        trainerProfile: mockProfile,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const res = await request(app).get(`/api/v1/trainers/${trainerUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trainer.name).toBe('Tanvir Ahmed');
      expect(res.body.data.trainer.trainerProfile.bio).toContain('8+ years experience');
    });

    it('should return 404 if trainer is not found', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/v1/trainers/non-existent-trainer');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/trainers', () => {
    it('should allow ADMIN to create a trainer account and profile', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValueOnce({
        ...trainerUser,
        trainerProfile: mockProfile,
      } as unknown as Awaited<ReturnType<typeof prisma.user.create>>);

      const res = await request(app)
        .post('/api/v1/trainers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Tanvir Ahmed',
          email: 'trainer@gym.com',
          phone: '+8801700000001',
          password: 'TrainerPass123!',
          bio: 'Strength & conditioning coach.',
          specialties: ['Strength Training'],
          certifications: ['NSCA-CSCS'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trainer.role).toBe(Role.TRAINER);
      expect(res.body.data.trainer.passwordHash).toBeUndefined();
    });

    it('should block non-admin from creating a trainer with 403', async () => {
      const res = await request(app)
        .post('/api/v1/trainers')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Hacked Trainer',
          email: 'hacked@gym.com',
          phone: '+8801799999999',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/trainers/me (Ownership Check)', () => {
    it('should allow a trainer to update their own profile', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...trainerUser,
        trainerProfile: mockProfile,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
      vi.spyOn(prisma.trainerProfile, 'update').mockResolvedValueOnce({
        ...mockProfile,
        bio: 'Updated bio with new achievements.',
      });

      const res = await request(app)
        .patch('/api/v1/trainers/me')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          bio: 'Updated bio with new achievements.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.bio).toBe('Updated bio with new achievements.');
    });

    it('should block non-trainer (MEMBER) from updating /trainers/me with 403', async () => {
      const res = await request(app)
        .patch('/api/v1/trainers/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          bio: 'Trying to update as member',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/trainers/:id', () => {
    it('should allow ADMIN to update any trainer profile', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...trainerUser,
        trainerProfile: mockProfile,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);
      vi.spyOn(prisma.trainerProfile, 'update').mockResolvedValueOnce({
        ...mockProfile,
        sortOrder: 5,
        isPublic: false,
      });

      const res = await request(app)
        .patch(`/api/v1/trainers/${trainerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sortOrder: 5,
          isPublic: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.profile.sortOrder).toBe(5);
    });

    it('should block non-admin from updating arbitrary trainer profile with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/trainers/${trainerUser.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sortOrder: 5 });

      expect(res.status).toBe(403);
    });
  });
});
