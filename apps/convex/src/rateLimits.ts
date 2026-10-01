import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/** Failed password attempts allowed per account before lockout. */
export const MAX_FAILED_LOGINS_PER_ACCOUNT = 5;

/** How long account lockout lasts after too many failed password attempts. */
export const ACCOUNT_LOCKOUT_PERIOD = 30 * MINUTE;

/** Login attempts allowed per IP address in a short window. */
export const MAX_LOGIN_ATTEMPTS_PER_IP = 30;

/** Window for per-IP login attempt throttling. */
export const LOGIN_ATTEMPTS_IP_WINDOW = MINUTE;

export const loginRateLimiter = new RateLimiter(components.rateLimiter, {
  loginAttemptsByIp: {
    kind: "fixed window",
    rate: MAX_LOGIN_ATTEMPTS_PER_IP,
    period: LOGIN_ATTEMPTS_IP_WINDOW,
  },
  loginAttemptsGlobal: {
    kind: "fixed window",
    rate: 300,
    period: MINUTE,
  },
});

export const friendLinkRateLimiter = new RateLimiter(components.rateLimiter, {
  redemptionsByUser: {
    kind: "fixed window",
    rate: 12,
    period: MINUTE,
  },
});

export const clubJoinRateLimiter = new RateLimiter(components.rateLimiter, {
  codeRedemptionsByUser: { kind: "fixed window", rate: 8, period: MINUTE },
});

export const uploadRateLimiter = new RateLimiter(components.rateLimiter, {
  urlsByUser: { kind: "fixed window", rate: 20, period: MINUTE },
});

export const scheduleOcrRateLimiter = new RateLimiter(components.rateLimiter, {
  scansByUser: { kind: "fixed window", rate: 8, period: HOUR },
});

export const contentRateLimiter = new RateLimiter(components.rateLimiter, {
  messagesByUser: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  reportsByUser: { kind: "fixed window", rate: 5, period: 10 * MINUTE },
  joinRequestsByUser: { kind: "fixed window", rate: 10, period: 10 * MINUTE },
  commentsByUser: {
    kind: "token bucket",
    rate: 12,
    period: MINUTE,
    capacity: 5,
  },
  // Whiteboard clients flush completed strokes and moves in small batches.
  whiteboardSavesByUser: {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 40,
  },
  whiteboardManagementByUser: {
    kind: "token bucket",
    rate: 30,
    period: 10 * MINUTE,
    capacity: 10,
  },
});
