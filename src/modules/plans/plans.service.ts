import { MembershipPlan } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { slugify } from '../../utils/slugify';
import { CreatePlanInput, UpdatePlanInput } from './plans.validation';

export const getAllPlans = async (includeInactive = false): Promise<MembershipPlan[]> => {
  return prisma.membershipPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
};

export const getPlanBySlugOrId = async (identifier: string): Promise<MembershipPlan> => {
  // Check if identifier is MongoDB ObjectId (24 hex characters) or slug
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

  const plan = await prisma.membershipPlan.findFirst({
    where: isObjectId
      ? { OR: [{ id: identifier }, { slug: identifier }] }
      : { slug: identifier },
  });

  if (!plan) {
    throw new NotFoundError(`Membership plan '${identifier}' not found`);
  }

  return plan;
};

export const createPlan = async (data: CreatePlanInput): Promise<MembershipPlan> => {
  const planSlug = data.slug || slugify(data.name);

  const existing = await prisma.membershipPlan.findUnique({
    where: { slug: planSlug },
  });

  if (existing) {
    throw new ConflictError(`A membership plan with slug '${planSlug}' already exists`);
  }

  return prisma.membershipPlan.create({
    data: {
      name: data.name,
      slug: planSlug,
      description: data.description,
      price: data.price,
      durationDays: data.durationDays,
      features: data.features,
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
      sortOrder: data.sortOrder ?? 0,
    },
  });
};

export const updatePlan = async (id: string, data: UpdatePlanInput): Promise<MembershipPlan> => {
  const existing = await prisma.membershipPlan.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Membership plan with ID '${id}' not found`);
  }

  let newSlug = data.slug;
  if (!newSlug && data.name && data.name !== existing.name) {
    newSlug = slugify(data.name);
  }

  if (newSlug && newSlug !== existing.slug) {
    const conflict = await prisma.membershipPlan.findUnique({
      where: { slug: newSlug },
    });
    if (conflict && conflict.id !== id) {
      throw new ConflictError(`A membership plan with slug '${newSlug}' already exists`);
    }
  }

  return prisma.membershipPlan.update({
    where: { id },
    data: {
      ...data,
      ...(newSlug && { slug: newSlug }),
    },
  });
};

export const deactivatePlan = async (id: string): Promise<MembershipPlan> => {
  const existing = await prisma.membershipPlan.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Membership plan with ID '${id}' not found`);
  }

  // Deactivate rather than delete to preserve historical payment and subscription records
  return prisma.membershipPlan.update({
    where: { id },
    data: { isActive: false },
  });
};
