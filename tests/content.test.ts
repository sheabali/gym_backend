import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { ContactStatus, Role } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/modules/auth/auth.utils';

describe('Content & Contact Module', () => {
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

  const mockContactMessage = {
    id: '674000000000000000000080',
    name: 'Rahim Khan',
    email: 'rahim@example.com',
    phone: '01811111111',
    message: 'What are the ladies-only hour timings?',
    status: ContactStatus.NEW,
    createdAt: new Date(),
  };

  const mockFaq = {
    id: '674000000000000000000090',
    question: 'What are the gym operating hours?',
    answer: 'We are open 6:00 AM to 11:00 PM every day.',
    sortOrder: 1,
    isPublished: true,
  };

  const mockAnnouncement = {
    id: '674000000000000000000095',
    title: 'Holiday Schedule Notice',
    body: 'The gym will operate on holiday schedule next Friday.',
    isActive: true,
    publishedAt: new Date(),
    expiresAt: null,
  };

  const mockGallery = {
    id: '674000000000000000000098',
    url: 'https://images.unsplash.com/photo-gym-weights.jpg',
    caption: 'Strength training floor',
    category: 'Equipment',
    sortOrder: 1,
  };

  // ---------- Contact Message Tests ----------

  describe('POST /api/v1/contact (Public Inquiry)', () => {
    it('should submit a contact message with valid name and email/phone', async () => {
      vi.spyOn(prisma.contactMessage, 'create').mockResolvedValueOnce(mockContactMessage as any);

      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Rahim Khan',
          email: 'rahim@example.com',
          phone: '01811111111',
          message: 'What are the ladies-only hour timings?',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.id).toBe(mockContactMessage.id);
    });

    it('should reject contact message if neither email nor phone is provided with 400', async () => {
      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Anonymous',
          message: 'Need help with membership',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET and PATCH /api/v1/contact (Admin Inbox)', () => {
    it('should return contact messages for ADMIN', async () => {
      vi.spyOn(prisma.contactMessage, 'findMany').mockResolvedValueOnce([mockContactMessage as any]);
      vi.spyOn(prisma.contactMessage, 'count').mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/contact?status=NEW')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages.length).toBe(1);
    });

    it('should block non-admins from viewing contact messages with 403', async () => {
      const res = await request(app)
        .get('/api/v1/contact')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow ADMIN to update contact message status', async () => {
      vi.spyOn(prisma.contactMessage, 'findUnique').mockResolvedValueOnce(mockContactMessage as any);
      vi.spyOn(prisma.contactMessage, 'update').mockResolvedValueOnce({
        ...mockContactMessage,
        status: ContactStatus.REPLIED,
      } as any);

      const res = await request(app)
        .patch(`/api/v1/contact/${mockContactMessage.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'REPLIED' });

      expect(res.status).toBe(200);
      expect(res.body.data.message.status).toBe('REPLIED');
    });
  });

  // ---------- FAQ Tests ----------

  describe('FAQ Endpoints', () => {
    it('should return published FAQs publicly', async () => {
      vi.spyOn(prisma.faqItem, 'findMany').mockResolvedValueOnce([mockFaq as any]);

      const res = await request(app).get('/api/v1/content/faq');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.faqs.length).toBe(1);
    });

    it('should allow ADMIN to create an FAQ item', async () => {
      vi.spyOn(prisma.faqItem, 'create').mockResolvedValueOnce(mockFaq as any);

      const res = await request(app)
        .post('/api/v1/content/faq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          question: 'What are the gym operating hours?',
          answer: 'We are open 6:00 AM to 11:00 PM every day.',
          sortOrder: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.faq.question).toBe(mockFaq.question);
    });

    it('should block non-admin from creating FAQ with 403', async () => {
      const res = await request(app)
        .post('/api/v1/content/faq')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          question: 'Test question',
          answer: 'Test answer',
        });

      expect(res.status).toBe(403);
    });
  });

  // ---------- Announcements Tests ----------

  describe('Announcements Endpoints', () => {
    it('should return active announcements publicly', async () => {
      vi.spyOn(prisma.announcement, 'findMany').mockResolvedValueOnce([mockAnnouncement as any]);

      const res = await request(app).get('/api/v1/content/announcements');

      expect(res.status).toBe(200);
      expect(res.body.data.announcements.length).toBe(1);
    });

    it('should allow ADMIN to create an announcement', async () => {
      vi.spyOn(prisma.announcement, 'create').mockResolvedValueOnce(mockAnnouncement as any);

      const res = await request(app)
        .post('/api/v1/content/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Holiday Schedule Notice',
          body: 'The gym will operate on holiday schedule next Friday.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.announcement.title).toBe(mockAnnouncement.title);
    });
  });

  // ---------- Gallery Tests ----------

  describe('Gallery Endpoints', () => {
    it('should return gallery images publicly', async () => {
      vi.spyOn(prisma.galleryImage, 'findMany').mockResolvedValueOnce([mockGallery as any]);

      const res = await request(app).get('/api/v1/content/gallery');

      expect(res.status).toBe(200);
      expect(res.body.data.images.length).toBe(1);
    });

    it('should allow ADMIN to add a gallery image', async () => {
      vi.spyOn(prisma.galleryImage, 'create').mockResolvedValueOnce(mockGallery as any);

      const res = await request(app)
        .post('/api/v1/content/gallery')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          url: 'https://images.unsplash.com/photo-gym-weights.jpg',
          caption: 'Strength training floor',
          category: 'Equipment',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.image.url).toBe(mockGallery.url);
    });
  });
});
