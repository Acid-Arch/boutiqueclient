import { RateLimiterMemory } from 'rate-limiter-flexible';
import { j as json } from './index-Djsj11qr.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import { d as dev } from './index-Dn7PghUK.js';

var ErrorType = /* @__PURE__ */ ((ErrorType2) => {
  ErrorType2["AUTHENTICATION"] = "authentication";
  ErrorType2["AUTHORIZATION"] = "authorization";
  ErrorType2["VALIDATION"] = "validation";
  ErrorType2["DATABASE"] = "database";
  ErrorType2["NETWORK"] = "network";
  ErrorType2["BUSINESS_LOGIC"] = "business_logic";
  ErrorType2["EXTERNAL_API"] = "external_api";
  ErrorType2["SYSTEM"] = "system";
  ErrorType2["UNKNOWN"] = "unknown";
  return ErrorType2;
})(ErrorType || {});
var ErrorSeverity = /* @__PURE__ */ ((ErrorSeverity2) => {
  ErrorSeverity2["LOW"] = "low";
  ErrorSeverity2["MEDIUM"] = "medium";
  ErrorSeverity2["HIGH"] = "high";
  ErrorSeverity2["CRITICAL"] = "critical";
  return ErrorSeverity2;
})(ErrorSeverity || {});
const ERROR_PATTERNS = [
  {
    pattern: /authentication|unauthorized|invalid credentials|login failed/i,
    type: "authentication",
    severity: "medium"
    /* MEDIUM */
  },
  {
    pattern: /forbidden|insufficient permissions|access denied/i,
    type: "authorization",
    severity: "medium"
    /* MEDIUM */
  },
  {
    pattern: /validation|invalid input|bad request|missing required/i,
    type: "validation",
    severity: "low"
    /* LOW */
  },
  {
    pattern: /database|prisma|sql|connection|timeout/i,
    type: "database",
    severity: "high"
    /* HIGH */
  },
  {
    pattern: /network|fetch|request failed|timeout|econnrefused/i,
    type: "network",
    severity: "medium"
    /* MEDIUM */
  },
  {
    pattern: /hiker api|external service|api error/i,
    type: "external_api",
    severity: "medium"
    /* MEDIUM */
  },
  {
    pattern: /out of memory|disk full|system|server/i,
    type: "system",
    severity: "critical"
    /* CRITICAL */
  }
];
function classifyError(error, context) {
  const errorMessage = error instanceof Error ? error.message : error;
  const fullContext = `${errorMessage} ${context || ""}`.toLowerCase();
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(fullContext)) {
      return { type: pattern.type, severity: pattern.severity };
    }
  }
  return {
    type: "unknown",
    severity: "medium"
    /* MEDIUM */
  };
}
function generateErrorCode(type) {
  const timestamp = Date.now().toString(36);
  const typeCode = type.toUpperCase().substring(0, 3);
  return `ERR_${typeCode}_${timestamp}`;
}
function sanitizeErrorDetails(error, includeStack = dev) {
  const details = {
    name: error.name,
    message: error.message
  };
  if (includeStack && error.stack) {
    details.stack = error.stack;
  }
  if (error.message) {
    details.sanitizedMessage = error.message.replace(/password[=:]\s*[^\s&]*/gi, "password=[REDACTED]").replace(/token[=:]\s*[^\s&]*/gi, "token=[REDACTED]").replace(/secret[=:]\s*[^\s&]*/gi, "secret=[REDACTED]").replace(/key[=:]\s*[^\s&]*/gi, "key=[REDACTED]");
  }
  return details;
}
function createErrorResponse(error, context) {
  const errorObj = error instanceof Error ? error : new Error(error);
  const { type, severity } = context?.type && context?.severity ? { type: context.type, severity: context.severity } : classifyError(errorObj, JSON.stringify(context));
  const errorCode = context?.code || generateErrorCode(type);
  const errorResponse = {
    success: false,
    error: errorObj.message,
    code: errorCode,
    type,
    severity,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    requestId: context?.requestId,
    details: {
      ...sanitizeErrorDetails(errorObj, dev),
      ...context?.details || {}
    }
  };
  return errorResponse;
}
async function handleApiError(error, event, context) {
  const errorObj = error instanceof Error ? error : new Error(error);
  const requestId = event?.locals.requestId || "unknown";
  const userId = event?.locals.user?.id || context?.userId;
  const { type, severity } = classifyError(errorObj, context?.operation);
  const errorResponse = createErrorResponse(errorObj, {
    type,
    severity,
    requestId,
    details: {
      operation: context?.operation,
      userId,
      url: event?.url.pathname,
      method: event?.request.method,
      userAgent: event?.request.headers.get("user-agent"),
      ...context?.additionalData
    }
  });
  const logLevel = severity === "critical" ? LogLevel.ERROR : severity === "high" ? LogLevel.ERROR : severity === "medium" ? LogLevel.WARN : LogLevel.INFO;
  logger.logAPI(logLevel, `API Error: ${errorObj.message}`, {
    errorCode: errorResponse.code,
    errorType: type,
    severity,
    requestId,
    userId,
    operation: context?.operation,
    url: event?.url.pathname || "unknown",
    method: event?.request.method || "unknown",
    details: errorResponse.details
  });
  if (severity === "critical") {
    await sendErrorNotification(errorResponse, event);
  }
  let statusCode = 500;
  switch (type) {
    case "authentication":
      statusCode = 401;
      break;
    case "authorization":
      statusCode = 403;
      break;
    case "validation":
      statusCode = 400;
      break;
    case "database":
      statusCode = 503;
      break;
    case "network":
    case "external_api":
      statusCode = 502;
      break;
    case "business_logic":
      statusCode = 422;
      break;
    default:
      statusCode = 500;
  }
  return json(errorResponse, { status: statusCode });
}
async function sendErrorNotification(errorResponse, event) {
  try {
    console.error("🚨 CRITICAL ERROR NOTIFICATION:", {
      code: errorResponse.code,
      message: errorResponse.error,
      timestamp: errorResponse.timestamp,
      requestId: errorResponse.requestId,
      url: event?.url.pathname,
      method: event?.request.method
    });
  } catch (notificationError) {
    console.error("Failed to send error notification:", notificationError);
  }
}
function setupGlobalErrorHandlers() {
  if (typeof process !== "undefined") {
    process.on("unhandledRejection", (reason, promise) => {
      logger.logSystem(LogLevel.ERROR, "Unhandled Promise Rejection", {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : void 0,
        component: "global_error_handler"
      });
    });
    process.on("uncaughtException", (error) => {
      logger.logSystem(LogLevel.ERROR, "Uncaught Exception", {
        message: error.message,
        stack: error.stack,
        component: "global_error_handler"
      });
      setTimeout(() => {
        process.exit(1);
      }, 1e3);
    });
  }
}
const createRateLimitError = (message = "Rate limit exceeded") => ({ message, type: "rate_limit", statusCode: 429 });
if (typeof process !== "undefined") {
  setupGlobalErrorHandlers();
}
const RATE_LIMITS = {
  // Authentication endpoints (stricter limits)
  AUTH: {
    points: 5,
    // 5 attempts
    duration: 300,
    // per 5 minutes
    blockDuration: 900
    // block for 15 minutes after limit exceeded
  },
  // Login endpoint (very strict)
  LOGIN: {
    points: 3,
    // 3 attempts
    duration: 300,
    // per 5 minutes
    blockDuration: 1800
    // block for 30 minutes
  },
  // Password reset (strict)
  PASSWORD_RESET: {
    points: 3,
    // 3 attempts
    duration: 3600,
    // per hour
    blockDuration: 3600
    // block for 1 hour
  },
  // Registration (moderate)
  REGISTER: {
    points: 3,
    // 3 attempts
    duration: 3600,
    // per hour
    blockDuration: 1800
    // block for 30 minutes
  },
  // API endpoints (standard)
  API: {
    points: 100,
    // 100 requests
    duration: 300,
    // per 5 minutes
    blockDuration: 300
    // block for 5 minutes
  },
  // Data modification endpoints (stricter)
  API_WRITE: {
    points: 30,
    // 30 requests
    duration: 300,
    // per 5 minutes
    blockDuration: 600
    // block for 10 minutes
  },
  // File upload endpoints (very strict)
  UPLOAD: {
    points: 5,
    // 5 uploads
    duration: 3600,
    // per hour
    blockDuration: 3600
    // block for 1 hour
  },
  // Admin endpoints (moderate but logged)
  ADMIN: {
    points: 200,
    // 200 requests
    duration: 300,
    // per 5 minutes
    blockDuration: 300
    // block for 5 minutes
  },
  // Public/static content (generous)
  PUBLIC: {
    points: 1e3,
    // 1000 requests
    duration: 3600,
    // per hour
    blockDuration: 300
    // block for 5 minutes
  },
  // WebSocket connections (very strict)
  WEBSOCKET: {
    points: 10,
    // 10 connections
    duration: 300,
    // per 5 minutes
    blockDuration: 900
    // block for 15 minutes
  },
  // Error reporting (prevent spam)
  ERROR_REPORT: {
    points: 10,
    // 10 error reports
    duration: 60,
    // per minute
    blockDuration: 300
    // block for 5 minutes
  }
};
const rateLimiters = /* @__PURE__ */ new Map();
function createRateLimiter(key, options) {
  if (rateLimiters.has(key)) {
    return rateLimiters.get(key);
  }
  const limiter = new RateLimiterMemory({
    ...options,
    keyPrefix: `rl_${key}`
  });
  rateLimiters.set(key, limiter);
  return limiter;
}
function getClientKey(event, prefix = "") {
  const ip = getClientIP(event);
  const userId = event.locals.user?.id;
  const identifier = userId ? `user_${userId}` : `ip_${ip}`;
  return prefix ? `${prefix}_${identifier}` : identifier;
}
function getClientIP(event) {
  const headers = event.request.headers;
  let ip = headers.get("cf-connecting-ip");
  if (!ip) {
    const forwarded = headers.get("x-forwarded-for");
    ip = forwarded?.split(",")[0]?.trim();
  }
  if (!ip) {
    ip = headers.get("x-real-ip");
  }
  if (!ip) {
    ip = event.getClientAddress();
  }
  return ip || "unknown";
}
function createRateLimitResponse(rateLimiterRes, limit, operation) {
  const resetTime = new Date(Date.now() + (rateLimiterRes.msBeforeNext || 0));
  const error = createRateLimitError(
    `Rate limit exceeded for ${operation}. Try again in ${Math.ceil((rateLimiterRes.msBeforeNext || 0) / 1e3)} seconds.`
  );
  const response = json({
    error: {
      id: error.id,
      type: error.type,
      message: error.userMessage,
      statusCode: error.statusCode,
      timestamp: error.timestamp?.toISOString()
    },
    success: false
  }, {
    status: 429,
    headers: {
      "X-RateLimit-Limit": limit.points?.toString() || "0",
      "X-RateLimit-Remaining": (rateLimiterRes.remainingPoints || 0).toString(),
      "X-RateLimit-Reset": resetTime.toISOString(),
      "Retry-After": Math.ceil((rateLimiterRes.msBeforeNext || 0) / 1e3).toString()
    }
  });
  return response;
}
async function rateLimit(event, limitConfig, customKey) {
  try {
    const config = RATE_LIMITS[limitConfig];
    const rateLimiterKey = customKey || limitConfig.toLowerCase();
    const clientKey = getClientKey(event, rateLimiterKey);
    const rateLimiter = createRateLimiter(rateLimiterKey, config);
    const rateLimiterRes = await rateLimiter.consume(clientKey);
    return null;
  } catch (rateLimiterRes) {
    const ip = getClientIP(event);
    const userId = event.locals.user?.id;
    const userAgent = event.request.headers.get("user-agent");
    logger.logSecurity(LogLevel.WARN, `Rate limit exceeded: ${limitConfig}`, {
      eventType: "rate_limit_exceeded",
      severity: "medium",
      ip,
      userId,
      userAgent,
      details: {
        limitType: limitConfig,
        url: event.url.pathname,
        method: event.request.method,
        totalHits: rateLimiterRes.totalHits,
        msBeforeNext: rateLimiterRes.msBeforeNext
      }
    });
    const config = RATE_LIMITS[limitConfig];
    return createRateLimitResponse(
      rateLimiterRes,
      config,
      limitConfig.toLowerCase().replace("_", " ")
    );
  }
}
const rateLimitAuth = (event) => rateLimit(event, "AUTH");
const rateLimitLogin = (event) => rateLimit(event, "LOGIN");
const rateLimitRegister = (event) => rateLimit(event, "REGISTER");
const rateLimitPasswordReset = (event) => rateLimit(event, "PASSWORD_RESET");
const rateLimitAPI = (event) => rateLimit(event, "API");
const rateLimitAPIWrite = (event) => rateLimit(event, "API_WRITE");
const rateLimitUpload = (event) => rateLimit(event, "UPLOAD");
const rateLimitAdmin = (event) => rateLimit(event, "ADMIN");
const rateLimitPublic = (event) => rateLimit(event, "PUBLIC");
const rateLimitWebSocket = (event) => rateLimit(event, "WEBSOCKET");
const rateLimitErrorReport = (event) => rateLimit(event, "ERROR_REPORT");
async function rateLimitMiddleware(event) {
  const { url, request } = event;
  const path = url.pathname;
  const method = request.method;
  try {
    if (path.includes("/login")) {
      return await rateLimitLogin(event);
    }
    if (path.includes("/register")) {
      return await rateLimitRegister(event);
    }
    if (path.includes("/forgot-password") || path.includes("/reset-password")) {
      return await rateLimitPasswordReset(event);
    }
    if (path.startsWith("/api/auth/")) {
      return await rateLimitAuth(event);
    }
    if (path === "/api/errors/report") {
      return await rateLimitErrorReport(event);
    }
    if (path.includes("/upload") || method === "POST" && (path.includes("/files") || path.includes("/images"))) {
      return await rateLimitUpload(event);
    }
    if (path.startsWith("/admin") || path.includes("/api/admin/")) {
      return await rateLimitAdmin(event);
    }
    if (path.startsWith("/api/") && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      return await rateLimitAPIWrite(event);
    }
    if (path.startsWith("/api/")) {
      return await rateLimitAPI(event);
    }
    if (path.includes("/ws") || path.includes("/websocket")) {
      return await rateLimitWebSocket(event);
    }
    return await rateLimitPublic(event);
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Rate limiting error", {
      component: "rate-limiter",
      event: "rate_limit_error",
      details: {
        path,
        method,
        error: error instanceof Error ? error.message : String(error)
      },
      error: error instanceof Error ? error : void 0
    });
    return null;
  }
}

export { ErrorSeverity as E, rateLimitErrorReport as a, ErrorType as b, createErrorResponse as c, rateLimitMiddleware as d, handleApiError as h, rateLimitAdmin as r };
//# sourceMappingURL=rate-limiter-comprehensive-DZzPnbd1.js.map
