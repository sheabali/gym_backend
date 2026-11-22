import { z } from 'zod';
import { BookingStatus } from '@prisma/client';

export const createBookingSchema = {
  body: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
};

export const cancelBookingSchema = {
  params: z.object({
    id: z.string().min(1, 'Booking ID is required'),
  }),
};

export const updateAttendanceSchema = {
  params: z.object({
    id: z.string().min(1, 'Booking ID is required'),
  }),
  body: z.object({
    status: z.enum([BookingStatus.ATTENDED, BookingStatus.NO_SHOW], {
      errorMap: () => ({ message: 'Attendance status must be ATTENDED or NO_SHOW' }),
    }),
  }),
};

export const getSessionBookingsSchema = {
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
};

export type CreateBookingInput = z.infer<typeof createBookingSchema.body>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema.body>;
