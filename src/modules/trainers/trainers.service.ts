import { Role, UserStatus, User, TrainerProfile } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { hashPassword, sanitizeUser, SafeUser } from '../auth/auth.utils';
import { CreateTrainerInput, UpdateTrainerProfileInput } from './trainers.validation';

export type TrainerWithProfile = SafeUser & {
  trainerProfile: TrainerProfile | null;
};

export const getAllTrainers = async (includePrivate = false): Promise<TrainerWithProfile[]> => {
  const users = await prisma.user.findMany({
    where: {
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
      ...(includePrivate
        ? {}
        : {
            trainerProfile: {
              isPublic: true,
            },
          }),
    },
    include: {
      trainerProfile: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return users.map((user: User & { trainerProfile: TrainerProfile | null }) => ({
    ...sanitizeUser(user),
    trainerProfile: user.trainerProfile,
  }));
};

export const getTrainerById = async (id: string): Promise<TrainerWithProfile> => {
  const user = await prisma.user.findFirst({
    where: {
      id,
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
    },
    include: {
      trainerProfile: true,
    },
  });

  if (!user) {
    throw new NotFoundError(`Trainer with ID '${id}' not found`);
  }

  return {
    ...sanitizeUser(user),
    trainerProfile: user.trainerProfile,
  };
};

export const createTrainer = async (data: CreateTrainerInput): Promise<TrainerWithProfile> => {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: data.phone }],
    },
  });

  if (existing) {
    throw new ConflictError('A user with this email or phone number already exists');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
      photoUrl: data.photoUrl || null,
      trainerProfile: {
        create: {
          bio: data.bio || null,
          specialties: data.specialties || [],
          certifications: data.certifications || [],
          photoUrl: data.photoUrl || null,
          isPublic: data.isPublic ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      },
    },
    include: {
      trainerProfile: true,
    },
  });

  return {
    ...sanitizeUser(user),
    trainerProfile: user.trainerProfile,
  };
};

export const updateTrainerProfile = async (
  userId: string,
  data: UpdateTrainerProfileInput
): Promise<TrainerProfile> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { trainerProfile: true },
  });

  if (!user || user.role !== Role.TRAINER) {
    throw new NotFoundError(`Trainer account '${userId}' not found`);
  }

  if (user.trainerProfile) {
    return prisma.trainerProfile.update({
      where: { userId },
      data,
    });
  }

  // If no profile exists yet, create one
  return prisma.trainerProfile.create({
    data: {
      userId,
      bio: data.bio || null,
      specialties: data.specialties || [],
      certifications: data.certifications || [],
      photoUrl: data.photoUrl || null,
      isPublic: data.isPublic ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });
};
