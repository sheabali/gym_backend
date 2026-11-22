import { Request, Response } from 'express';
import { ContactStatus, Role } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import * as contentService from './content.service';

// ---------- Contact Messages ----------

export const submitContactMessage = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, message } = req.body;
  const result = await contentService.createContactMessage({
    name,
    email,
    phone,
    message,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Message sent successfully. We will contact you soon.',
    data: { message: result },
  });
};

export const listContactMessages = async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as ContactStatus | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const result = await contentService.listContactMessages({ status, page, limit });

  sendSuccess(res, {
    statusCode: 200,
    message: 'Contact messages retrieved successfully',
    data: result,
  });
};

export const updateContactStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  const updated = await contentService.updateContactStatus(id, status);

  sendSuccess(res, {
    statusCode: 200,
    message: `Contact status updated to ${status}`,
    data: { message: updated },
  });
};

// ---------- FAQs ----------

export const getFaqs = async (req: Request, res: Response): Promise<void> => {
  const isAdmin = req.user?.role === Role.ADMIN;
  const includeUnpublished = isAdmin && req.query.includeUnpublished === 'true';

  const faqs = await contentService.listFaqs(includeUnpublished);

  sendSuccess(res, {
    statusCode: 200,
    message: 'FAQs retrieved successfully',
    data: { faqs },
  });
};

export const createFaq = async (req: Request, res: Response): Promise<void> => {
  const { question, answer, sortOrder, isPublished } = req.body;
  const faq = await contentService.createFaq({
    question,
    answer,
    sortOrder,
    isPublished,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'FAQ item created successfully',
    data: { faq },
  });
};

export const updateFaq = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const faq = await contentService.updateFaq(id, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'FAQ item updated successfully',
    data: { faq },
  });
};

export const deleteFaq = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await contentService.deleteFaq(id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'FAQ item deleted successfully',
    data: null,
  });
};

// ---------- Announcements ----------

export const getAnnouncements = async (req: Request, res: Response): Promise<void> => {
  const isAdmin = req.user?.role === Role.ADMIN;
  const includeInactive = isAdmin && req.query.includeInactive === 'true';

  const announcements = await contentService.listAnnouncements(includeInactive);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Announcements retrieved successfully',
    data: { announcements },
  });
};

export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
  const { title, body, isActive, expiresAt } = req.body;
  const announcement = await contentService.createAnnouncement({
    title,
    body,
    isActive,
    expiresAt,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Announcement created successfully',
    data: { announcement },
  });
};

export const updateAnnouncement = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const announcement = await contentService.updateAnnouncement(id, req.body);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Announcement updated successfully',
    data: { announcement },
  });
};

export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await contentService.deleteAnnouncement(id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Announcement deleted successfully',
    data: null,
  });
};

// ---------- Gallery ----------

export const getGallery = async (req: Request, res: Response): Promise<void> => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const images = await contentService.listGalleryImages(category);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Gallery images retrieved successfully',
    data: { images },
  });
};

export const createGalleryImage = async (req: Request, res: Response): Promise<void> => {
  const { url, caption, category, sortOrder } = req.body;
  const image = await contentService.createGalleryImage({
    url,
    caption,
    category,
    sortOrder,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Gallery image added successfully',
    data: { image },
  });
};

export const deleteGalleryImage = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await contentService.deleteGalleryImage(id);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Gallery image deleted successfully',
    data: null,
  });
};
