import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import * as bookingsService from './bookings.service';

export const bookSession = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const booking = await bookingsService.bookSession(userId, req.body.sessionId);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Class session booked successfully',
    data: { booking },
  });
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const bookings = await bookingsService.getMyBookings(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Your class bookings retrieved',
    data: { bookings },
  });
});

export const getSessionRoster = asyncHandler(async (req: Request, res: Response) => {
  const roster = await bookingsService.getSessionRoster(req.params.sessionId, req.user!);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Session roster retrieved',
    data: { roster },
  });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const result = await bookingsService.cancelBooking(req.params.id, req.user!);

  sendSuccess(res, {
    statusCode: 200,
    message: result.isLateCancellation
      ? 'Booking cancelled. Note: Cancellation occurred within 2 hours of class start and counts as used.'
      : 'Booking cancelled successfully',
    data: {
      booking: result.booking,
      isLateCancellation: result.isLateCancellation,
    },
  });
});

export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingsService.markAttendance(
    req.params.id,
    req.body.status,
    req.user!
  );

  sendSuccess(res, {
    statusCode: 200,
    message: `Attendance marked as ${booking.status}`,
    data: { booking },
  });
});
