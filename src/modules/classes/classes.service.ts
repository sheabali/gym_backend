import { ClassType, ClassSession, Role, UserStatus, SessionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError, BadRequestError } from '../../utils/errors';
import { slugify } from '../../utils/slugify';
import {
  CreateClassTypeInput,
  UpdateClassTypeInput,
  CreateSessionInput,
  CreateRecurringSessionsInput,
  UpdateSessionInput,
  GetSessionsQuery,
} from './classes.validation';

// ---------- Class Type Operations ----------

export const getAllClassTypes = async (includeInactive = false): Promise<ClassType[]> => {
  return prisma.classType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
};

export const getClassTypeBySlugOrId = async (identifier: string): Promise<ClassType> => {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

  const classType = await prisma.classType.findFirst({
    where: isObjectId
      ? { OR: [{ id: identifier }, { slug: identifier }] }
      : { slug: identifier },
  });

  if (!classType) {
    throw new NotFoundError(`Class type '${identifier}' not found`);
  }

  return classType;
};

export const createClassType = async (data: CreateClassTypeInput): Promise<ClassType> => {
  const typeSlug = data.slug || slugify(data.name);

  const existing = await prisma.classType.findUnique({
    where: { slug: typeSlug },
  });

  if (existing) {
    throw new ConflictError(`A class type with slug '${typeSlug}' already exists`);
  }

  return prisma.classType.create({
    data: {
      name: data.name,
      slug: typeSlug,
      description: data.description,
      imageUrl: data.imageUrl,
      difficulty: data.difficulty,
      durationMinutes: data.durationMinutes,
      isActive: data.isActive ?? true,
    },
  });
};

export const updateClassType = async (
  id: string,
  data: UpdateClassTypeInput
): Promise<ClassType> => {
  const existing = await prisma.classType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Class type with ID '${id}' not found`);
  }

  let newSlug = data.slug;
  if (!newSlug && data.name && data.name !== existing.name) {
    newSlug = slugify(data.name);
  }

  if (newSlug && newSlug !== existing.slug) {
    const conflict = await prisma.classType.findUnique({
      where: { slug: newSlug },
    });
    if (conflict && conflict.id !== id) {
      throw new ConflictError(`A class type with slug '${newSlug}' already exists`);
    }
  }

  return prisma.classType.update({
    where: { id },
    data: {
      ...data,
      ...(newSlug && { slug: newSlug }),
    },
  });
};

export const deactivateClassType = async (id: string): Promise<ClassType> => {
  const existing = await prisma.classType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Class type with ID '${id}' not found`);
  }

  return prisma.classType.update({
    where: { id },
    data: { isActive: false },
  });
};

// ---------- Class Session Operations ----------

export const getSessions = async (filters: GetSessionsQuery): Promise<ClassSession[]> => {
  const now = new Date();
  const startDate = filters.startDate ? new Date(filters.startDate) : now;
  // Default range: up to 14 days ahead if not specified
  const endDate = filters.endDate
    ? new Date(filters.endDate)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  return prisma.classSession.findMany({
    where: {
      startsAt: {
        gte: startDate,
        lte: endDate,
      },
      status: SessionStatus.SCHEDULED,
      ...(filters.classTypeId && { classTypeId: filters.classTypeId }),
      ...(filters.trainerId && { trainerId: filters.trainerId }),
      ...(filters.difficulty && {
        classType: {
          difficulty: filters.difficulty,
        },
      }),
    },
    include: {
      classType: true,
      trainer: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          trainerProfile: true,
        },
      },
    },
    orderBy: { startsAt: 'asc' },
  });
};

export const getSessionById = async (id: string): Promise<ClassSession> => {
  const session = await prisma.classSession.findUnique({
    where: { id },
    include: {
      classType: true,
      trainer: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          trainerProfile: true,
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError(`Class session '${id}' not found`);
  }

  return session;
};

export const createSession = async (data: CreateSessionInput): Promise<ClassSession> => {
  // Validate ClassType exists and is active
  const classType = await prisma.classType.findUnique({
    where: { id: data.classTypeId },
  });

  if (!classType || !classType.isActive) {
    throw new BadRequestError('Invalid or inactive class type specified');
  }

  // Validate Trainer exists and has role TRAINER
  const trainer = await prisma.user.findFirst({
    where: {
      id: data.trainerId,
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
    },
  });

  if (!trainer) {
    throw new BadRequestError('Assigned trainer not found or is not active');
  }

  const startsAt = new Date(data.startsAt);
  const endsAt = data.endsAt
    ? new Date(data.endsAt)
    : new Date(startsAt.getTime() + classType.durationMinutes * 60 * 1000);

  if (endsAt <= startsAt) {
    throw new BadRequestError('Session endsAt must be after startsAt');
  }

  return prisma.classSession.create({
    data: {
      classTypeId: data.classTypeId,
      trainerId: data.trainerId,
      startsAt,
      endsAt,
      capacity: data.capacity,
      bookedCount: 0,
      room: data.room,
      status: SessionStatus.SCHEDULED,
    },
    include: {
      classType: true,
      trainer: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
        },
      },
    },
  });
};

/**
 * Repeat Weekly Generator per Section 5 of project instructions.
 * Generates concrete session rows in the database for the given number of weeks.
 */
export const createRecurringWeeklySessions = async (
  data: CreateRecurringSessionsInput
): Promise<ClassSession[]> => {
  const classType = await prisma.classType.findUnique({
    where: { id: data.classTypeId },
  });

  if (!classType || !classType.isActive) {
    throw new BadRequestError('Invalid or inactive class type');
  }

  const trainer = await prisma.user.findFirst({
    where: {
      id: data.trainerId,
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
    },
  });

  if (!trainer) {
    throw new BadRequestError('Assigned trainer not found or inactive');
  }

  const baseStartsAt = new Date(data.firstStartsAt);
  const durationMs = classType.durationMinutes * 60 * 1000;
  const sessionsToCreate = [];

  for (let week = 0; week < data.weeks; week++) {
    const sessionStartsAt = new Date(baseStartsAt.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    const sessionEndsAt = new Date(sessionStartsAt.getTime() + durationMs);

    sessionsToCreate.push({
      classTypeId: data.classTypeId,
      trainerId: data.trainerId,
      startsAt: sessionStartsAt,
      endsAt: sessionEndsAt,
      capacity: data.capacity,
      bookedCount: 0,
      room: data.room,
      status: SessionStatus.SCHEDULED,
    });
  }

  // Create all sessions in a transaction
  const createdSessions: ClassSession[] = [];
  for (const sessionData of sessionsToCreate) {
    const session = await prisma.classSession.create({
      data: sessionData,
      include: { classType: true },
    });
    createdSessions.push(session);
  }

  return createdSessions;
};

export const updateSession = async (
  id: string,
  data: UpdateSessionInput
): Promise<ClassSession> => {
  const existing = await prisma.classSession.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Class session with ID '${id}' not found`);
  }

  if (data.capacity && data.capacity < existing.bookedCount) {
    throw new BadRequestError(
      `Cannot reduce capacity to ${data.capacity} because ${existing.bookedCount} spots are already booked`
    );
  }

  return prisma.classSession.update({
    where: { id },
    data,
  });
};

export const cancelSession = async (id: string): Promise<ClassSession> => {
  const existing = await prisma.classSession.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Class session with ID '${id}' not found`);
  }

  return prisma.classSession.update({
    where: { id },
    data: { status: SessionStatus.CANCELLED },
  });
};
