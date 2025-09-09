import { j as json } from './index-Djsj11qr.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import 'winston';
import 'pino';

class MemoryRateLimitStore {
  store = /* @__PURE__ */ new Map();
  cleanupInterval;
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1e3);
  }
  get(key) {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return void 0;
    }
    return entry;
  }
  set(key, entry) {
    this.store.set(key, entry);
  }
  increment(key, windowMs) {
    const now = Date.now();
    const existing = this.get(key);
    if (!existing || now > existing.resetTime) {
      const newEntry = {
        requests: 1,
        resetTime: now + windowMs
      };
      this.set(key, newEntry);
      return newEntry;
    }
    existing.requests++;
    this.set(key, existing);
    return existing;
  }
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}
const defaultStore = new MemoryRateLimitStore();
function defaultKeyGenerator(event) {
  const forwarded = event.request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0] || event.request.headers.get("x-real-ip") || event.getClientAddress();
  return `ip:${ip}`;
}
function createRateLimit(config) {
  const {
    windowMs,
    requests: maxRequests,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    onLimitReached
  } = config;
  return async (event) => {
    const key = keyGenerator(event);
    const entry = defaultStore.increment(key, windowMs);
    const resetTimeSeconds = Math.ceil(entry.resetTime / 1e3);
    const remainingRequests = Math.max(0, maxRequests - entry.requests);
    if (entry.requests > maxRequests) {
      logger.logSecurity(LogLevel.WARN, "Rate limit exceeded", {
        component: "rate_limiter",
        event: "limit_exceeded",
        details: {
          key,
          requests: entry.requests,
          maxRequests,
          windowMs,
          ip: event.getClientAddress(),
          userAgent: event.request.headers.get("user-agent"),
          path: event.url.pathname,
          method: event.request.method
        }
      });
      if (onLimitReached) {
        onLimitReached(event, entry.resetTime);
      }
      return json(
        {
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1e3)
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetTimeSeconds.toString(),
            "Retry-After": Math.ceil((entry.resetTime - Date.now()) / 1e3).toString()
          }
        }
      );
    }
    event.setHeaders({
      "X-RateLimit-Limit": maxRequests.toString(),
      "X-RateLimit-Remaining": remainingRequests.toString(),
      "X-RateLimit-Reset": resetTimeSeconds.toString()
    });
    return null;
  };
}
({
  // General API endpoints
  api: createRateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    requests: 100
    // 100 requests per 15 minutes
  }),
  // Authentication endpoints (stricter)
  auth: createRateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    requests: 10,
    // 10 attempts per 15 minutes
    onLimitReached: (event, resetTime) => {
      logger.logSecurity(LogLevel.ERROR, "Authentication rate limit exceeded", {
        component: "auth_rate_limiter",
        event: "auth_limit_exceeded",
        details: {
          ip: event.getClientAddress(),
          userAgent: event.request.headers.get("user-agent"),
          path: event.url.pathname,
          resetTime: new Date(resetTime).toISOString()
        }
      });
    }
  }),
  // File upload endpoints
  upload: createRateLimit({
    windowMs: 10 * 60 * 1e3,
    // 10 minutes
    requests: 5
    // 5 uploads per 10 minutes
  }),
  // Admin endpoints (more lenient for authenticated users)
  admin: createRateLimit({
    windowMs: 5 * 60 * 1e3,
    // 5 minutes
    requests: 50
    // 50 requests per 5 minutes
  }),
  // Health check endpoint (very lenient)
  health: createRateLimit({
    windowMs: 60 * 1e3,
    // 1 minute
    requests: 60
    // 60 requests per minute
  }),
  // WebSocket connections
  websocket: createRateLimit({
    windowMs: 60 * 1e3,
    // 1 minute
    requests: 10
    // 10 connection attempts per minute
  })
});

export { createRateLimit };
//# sourceMappingURL=rate-limiter-qh6NXSmt.js.map
