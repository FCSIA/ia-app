import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
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
  failedLoginByUsername: {
    kind: "token bucket",
    rate: MAX_FAILED_LOGINS_PER_ACCOUNT,
    period: ACCOUNT_LOCKOUT_PERIOD,
    capacity: MAX_FAILED_LOGINS_PER_ACCOUNT,
  },
  loginAttemptsByIp: {
    kind: "fixed window",
    rate: MAX_LOGIN_ATTEMPTS_PER_IP,
    period: LOGIN_ATTEMPTS_IP_WINDOW,
  },
});

export const friendLinkRateLimiter = new RateLimiter(components.rateLimiter, {
  redemptionsByUser: {
    kind: "fixed window",
    rate: 12,
    period: MINUTE,
  },
});
