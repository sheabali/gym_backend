/**
 * Date utility functions for Gym Management System.
 * All dates stored in DB are UTC.
 * Subscriptions expire at 23:59:59.999 Asia/Dhaka time (UTC+6).
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * Calculates the expiration date for a subscription in UTC such that it ends at
 * 23:59:59.999 in the Asia/Dhaka timezone (UTC+6) after durationDays.
 *
 * Example:
 * If baseDate is 2026-11-22T06:00:00.000Z and durationDays is 30,
 * baseDate in Dhaka is 2026-11-22 12:00:00.
 * Adding 30 days yields 2026-12-22.
 * End of day in Dhaka is 2026-12-22 23:59:59.999.
 * Converted to UTC, that is 2026-12-22T17:59:59.999Z.
 */
export const getDhakaEndOfDay = (baseDate: Date, durationDays: number): Date => {
  // Convert baseDate to local Dhaka time
  const dhakaTime = new Date(baseDate.getTime() + DHAKA_OFFSET_MS);

  // Add duration in days
  dhakaTime.setUTCDate(dhakaTime.getUTCDate() + durationDays);

  // Set to end of day in Dhaka local time
  dhakaTime.setUTCHours(23, 59, 59, 999);

  // Convert back to UTC representation
  return new Date(dhakaTime.getTime() - DHAKA_OFFSET_MS);
};

/**
 * Returns current timestamp in UTC.
 */
export const nowInUtc = (): Date => {
  return new Date();
};
