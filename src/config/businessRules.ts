/**
 * Centralized business rules configuration for Gym Management System (v1).
 * Per Section 6 of project instructions: Keep every business rule in a single
 * configuration module so changing a rule never requires hunting through code.
 */
export const BUSINESS_RULES = {
  /**
   * Maximum days in advance a member can book a class session.
   */
  BOOKING_WINDOW_DAYS: 7,

  /**
   * Free cancellation deadline in hours prior to class session start time.
   * Cancellations within this window are considered late and count as used.
   */
  CANCELLATION_CUTOFF_HOURS: 2,

  /**
   * Whether new members receive one complimentary trial class.
   */
  FREE_TRIAL_ENABLED: true,

  /**
   * Waitlist feature toggle (disabled in v1 per instructions).
   */
  ALLOW_WAITLIST: false,

  /**
   * Primary display and calendar timezone for the gym.
   */
  TIMEZONE: 'Asia/Dhaka',

  /**
   * Time after which an unsettled PENDING payment can be auto-reconciled or expired.
   */
  PENDING_PAYMENT_EXPIRY_MINUTES: 30,
} as const;

export type BusinessRules = typeof BUSINESS_RULES;
