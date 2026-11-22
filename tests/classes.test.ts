import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, Difficulty, SessionStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Classes & Scheduling Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = generateAccessToken({
    userId: 'admin_user_id_1',
    email: 'admin@gym.com',
    role: Role.ADMIN,
  });

  const memberToken = generateAccessToken({
    userId: 'member_user_id_1',
    email: 'member@gym.com',
    role: Role.MEMBER,
  });

  const mockClassType = {
    id: '674000000000000000000030',
    name: 'HIIT Cardio Blast',
    slug: 'hiit-cardio-blast',
    description: 'High-intensity interval training.',
    imageUrl: 'https://images.unsplash.com/photo-hiit.jpg',
    difficulty: Difficulty.INTERMEDIATE,
    durationMinutes: 45,
    isActive: true,
  };

  const mockSession = {
    id: '674000000000000000000040',
    classTypeId: mockClassType.id,
    trainerId: 'trainer_user_id_1',
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
    capacity: 20,
    bookedCount: 5,
    room: 'Studio A',
    status: SessionStatus.SCHEDULED,
    classType: mockClassType,
    trainer: {
      id: 'trainer_user_id_1',
      name: 'Tanvir Ahmed',
      photoUrl: null,
      trainerProfile: null,
    },
  };

  describe('GET /api/v1/classes/types', () => {
    it('should return a list of active class types', async () => {
      vi.spyOn(prisma.classType, 'findMany').mockResolvedValueOnce([mockClassType]);

      const res = await request(app).get('/api/v1/classes/types');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.classTypes)).toBe(true);
      expect(res.body.data.classTypes[0].name).toBe('HIIT Cardio Blast');
    });
  });

  describe('POST /api/v1/classes/types', () => {
    it('should allow ADMIN to create a class type', async () => {
      vi.spyOn(prisma.classType, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(prisma.classType, 'create').mockResolvedValueOnce(mockClassType);

      const res = await request(app)
        .post('/api/v1/classes/types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'HIIT Cardio Blast',
          durationMinutes: 45,
          difficulty: Difficulty.INTERMEDIATE,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.classType.slug).toBe('hiit-cardio-blast');
    });

    it('should block non-admin from creating a class type with 403', async () => {
      const res = await request(app)
        .post('/api/v1/classes/types')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'HIIT Cardio Blast',
          durationMinutes: 45,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/classes/sessions', () => {
    it('should return scheduled sessions with trainer and class details', async () => {
      vi.spyOn(prisma.classSession, 'findMany').mockResolvedValueOnce([mockSession as any]);

      const res = await request(app).get('/api/v1/classes/sessions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
      expect(res.body.data.sessions[0].capacity).toBe(20);
    });
  });

  describe('POST /api/v1/classes/sessions/recurring', () => {
    it('should allow ADMIN to generate weekly recurring session rows', async () => {
      vi.spyOn(prisma.classType, 'findUnique').mockResolvedValueOnce(mockClassType);
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        id: 'trainer_user_id_1',
        role: Role.TRAINER,
        status: 'ACTIVE',
      } as any);

      vi.spyOn(prisma.classSession, 'create')
        .mockResolvedValueOnce({ ...mockSession, id: 'session_1' } as any)
        .mockResolvedValueOnce({ ...mockSession, id: 'session_2' } as any)
        .mockResolvedValueOnce({ ...mockSession, id: 'session_3' } as any)
        .mockResolvedValueOnce({ ...mockSession, id: 'session_4' } as any);

      const res = await request(app)
        .post('/api/v1/classes/sessions/recurring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classTypeId: mockClassType.id,
          trainerId: 'trainer_user_id_1',
          firstStartsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          weeks: 4,
          capacity: 15,
          room: 'Main Studio',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessions.length).toBe(4);
    });
  });
});
