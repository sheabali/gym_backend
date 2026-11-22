import { ContactStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';

// ---------- Contact Messages ----------

export const createContactMessage = async (data: {
  name: string;
  email?: string;
  phone?: string;
  message: string;
}) => {
  return await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
      status: ContactStatus.NEW,
    },
  });
};

export const listContactMessages = async (query: {
  status?: ContactStatus;
  page?: number;
  limit?: number;
}) => {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: { status?: ContactStatus } = {};
  if (query.status) {
    where.status = query.status;
  }

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return {
    messages,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const updateContactStatus = async (id: string, status: ContactStatus) => {
  const existing = await prisma.contactMessage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Contact message '${id}' not found`);
  }

  return await prisma.contactMessage.update({
    where: { id },
    data: { status },
  });
};

// ---------- FAQs ----------

export const listFaqs = async (includeUnpublished = false) => {
  const where = includeUnpublished ? {} : { isPublished: true };

  return await prisma.faqItem.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });
};

export const createFaq = async (data: {
  question: string;
  answer: string;
  sortOrder?: number;
  isPublished?: boolean;
}) => {
  return await prisma.faqItem.create({
    data: {
      question: data.question,
      answer: data.answer,
      sortOrder: data.sortOrder ?? 0,
      isPublished: data.isPublished ?? true,
    },
  });
};

export const updateFaq = async (
  id: string,
  data: {
    question?: string;
    answer?: string;
    sortOrder?: number;
    isPublished?: boolean;
  }
) => {
  const existing = await prisma.faqItem.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`FAQ item '${id}' not found`);
  }

  return await prisma.faqItem.update({
    where: { id },
    data,
  });
};

export const deleteFaq = async (id: string) => {
  const existing = await prisma.faqItem.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`FAQ item '${id}' not found`);
  }

  return await prisma.faqItem.delete({
    where: { id },
  });
};

// ---------- Announcements ----------

export const listAnnouncements = async (includeInactive = false) => {
  const now = new Date();
  const where = includeInactive
    ? {}
    : {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      };

  return await prisma.announcement.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
  });
};

export const createAnnouncement = async (data: {
  title: string;
  body: string;
  isActive?: boolean;
  expiresAt?: string | null;
}) => {
  return await prisma.announcement.create({
    data: {
      title: data.title,
      body: data.body,
      isActive: data.isActive ?? true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
};

export const updateAnnouncement = async (
  id: string,
  data: {
    title?: string;
    body?: string;
    isActive?: boolean;
    expiresAt?: string | null;
  }
) => {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Announcement '${id}' not found`);
  }

  return await prisma.announcement.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.body && { body: data.body }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.expiresAt !== undefined && {
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      }),
    },
  });
};

export const deleteAnnouncement = async (id: string) => {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Announcement '${id}' not found`);
  }

  return await prisma.announcement.delete({ where: { id } });
};

// ---------- Gallery Images ----------

export const listGalleryImages = async (category?: string) => {
  const where = category ? { category } : {};

  return await prisma.galleryImage.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });
};

export const createGalleryImage = async (data: {
  url: string;
  caption?: string;
  category?: string;
  sortOrder?: number;
}) => {
  return await prisma.galleryImage.create({
    data: {
      url: data.url,
      caption: data.caption,
      category: data.category,
      sortOrder: data.sortOrder ?? 0,
    },
  });
};

export const deleteGalleryImage = async (id: string) => {
  const existing = await prisma.galleryImage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Gallery image '${id}' not found`);
  }

  return await prisma.galleryImage.delete({ where: { id } });
};
