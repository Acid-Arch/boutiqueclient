import { j as json } from './index-Djsj11qr.js';
import { z } from 'zod';
import { D as DatabaseSecurityLogger } from './db-security-logger-C-Isx1J6.js';

function getClientIP(request) {
  const headers = request.headers;
  return headers.get("cf-connecting-ip") || // Cloudflare
  headers.get("x-forwarded-for")?.split(",")[0] || // Load balancer/proxy
  headers.get("x-real-ip") || // Nginx
  headers.get("x-client-ip") || // Apache
  "unknown";
}
function getUserAgent(request) {
  return request.headers.get("user-agent") || "unknown";
}
function formatValidationErrors(error) {
  return (error.errors || []).map((err) => ({
    field: (err.path || []).join("."),
    message: err.message || "Validation error"
  }));
}
async function validateRequestBody(request, schema, options = {}) {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);
    if (options.logValidation) {
      DatabaseSecurityLogger.logQuery(
        `API_VALIDATION_SUCCESS: ${schema.constructor.name}`,
        [JSON.stringify(body)],
        0,
        {
          userId: options.userId,
          ip: getClientIP(request),
          userAgent: getUserAgent(request)
        }
      );
    }
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = {
        success: false,
        error: "Validation failed",
        details: formatValidationErrors(error),
        code: "VALIDATION_ERROR"
      };
      DatabaseSecurityLogger.logQuery(
        `API_VALIDATION_FAILED: ${schema.constructor.name}`,
        [JSON.stringify(error.errors)],
        0,
        {
          userId: options.userId,
          ip: getClientIP(request),
          userAgent: getUserAgent(request),
          error: "Validation failed"
        }
      );
      return {
        success: false,
        response: json(validationError, { status: 400 })
      };
    }
    const parseError = {
      success: false,
      error: "Invalid JSON in request body",
      code: "VALIDATION_ERROR"
    };
    DatabaseSecurityLogger.logQuery(
      "API_JSON_PARSE_ERROR",
      [],
      0,
      {
        userId: options.userId,
        ip: getClientIP(request),
        userAgent: getUserAgent(request),
        error: "JSON parse failed"
      }
    );
    return {
      success: false,
      response: json(parseError, { status: 400 })
    };
  }
}
function validateSearchParams(url, schema) {
  try {
    const params = {};
    for (const [key, value] of url.searchParams.entries()) {
      params[key] = value;
    }
    const validatedData = schema.parse(params);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = {
        success: false,
        error: "Invalid query parameters",
        details: formatValidationErrors(error),
        code: "VALIDATION_ERROR"
      };
      return {
        success: false,
        response: json(validationError, { status: 400 })
      };
    }
    return {
      success: false,
      response: json(
        {
          success: false,
          error: "Parameter validation failed",
          code: "VALIDATION_ERROR"
        },
        { status: 400 }
      )
    };
  }
}
async function validateRateLimit(request, endpoint, limits) {
  const clientIP = getClientIP(request);
  const now = Date.now();
  now - limits.windowMs;
  DatabaseSecurityLogger.logQuery(
    `RATE_LIMIT_CHECK: ${endpoint}`,
    [clientIP, limits.requests.toString(), limits.windowMs.toString()],
    0,
    {
      ip: clientIP,
      userAgent: getUserAgent(request)
    }
  );
  return { allowed: true };
}
async function validateAPIRequest(event, options = {}) {
  const { request, url, locals } = event;
  try {
    if (options.requireAuth && !locals.user) {
      return {
        success: false,
        response: json(
          {
            success: false,
            error: "Authentication required",
            code: "AUTH_REQUIRED"
          },
          { status: 401 }
        )
      };
    }
    if (options.rateLimit) {
      const rateLimitResult = await validateRateLimit(
        request,
        url.pathname,
        options.rateLimit
      );
      if (!rateLimitResult.allowed) {
        return { success: false, response: rateLimitResult.response };
      }
    }
    let bodyData;
    if (options.bodySchema) {
      const bodyValidation = await validateRequestBody(request, options.bodySchema, {
        logValidation: options.logRequest,
        userId: locals.user?.id
      });
      if (!bodyValidation.success) {
        return { success: false, response: bodyValidation.response };
      }
      bodyData = bodyValidation.data;
    }
    let paramsData;
    if (options.paramsSchema) {
      const paramsValidation = validateSearchParams(url, options.paramsSchema);
      if (!paramsValidation.success) {
        return { success: false, response: paramsValidation.response };
      }
      paramsData = paramsValidation.data;
    }
    return {
      success: true,
      body: bodyData,
      params: paramsData,
      userId: locals.user?.id
    };
  } catch (error) {
    DatabaseSecurityLogger.logQuery(
      "API_VALIDATION_UNEXPECTED_ERROR",
      [],
      0,
      {
        userId: locals.user?.id,
        ip: getClientIP(request),
        userAgent: getUserAgent(request),
        error: error instanceof Error ? error.message : "Unknown error"
      }
    );
    return {
      success: false,
      response: json(
        {
          success: false,
          error: "Request validation failed",
          code: "VALIDATION_ERROR"
        },
        { status: 500 }
      )
    };
  }
}
async function validateAPIRequestComprehensive(event, options = {}) {
  const {
    requireAuth = false,
    allowedRoles = [],
    rateLimit,
    bodySchema,
    querySchema,
    logAttempts = false
  } = options;
  if (rateLimit) {
    const { createRateLimit } = await import('./rate-limiter-qh6NXSmt.js');
    const rateLimiter = createRateLimit({
      windowMs: rateLimit.windowMs,
      requests: rateLimit.requests,
      keyGenerator: rateLimit.keyGenerator
    });
    const limitResponse = await rateLimiter(event);
    if (limitResponse) {
      return { success: false, response: limitResponse };
    }
  }
  if (requireAuth) {
    const user = event.locals.user;
    if (!user) {
      if (logAttempts) {
        DatabaseSecurityLogger.logQuery(
          "UNAUTHORIZED_API_ACCESS_ATTEMPT",
          [],
          0,
          {
            ip: event.getClientAddress(),
            userAgent: event.request.headers.get("user-agent"),
            error: "Authentication required"
          }
        );
      }
      return {
        success: false,
        response: json(
          {
            error: "Authentication required",
            code: "AUTH_REQUIRED"
          },
          { status: 401 }
        )
      };
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (logAttempts) {
        DatabaseSecurityLogger.logQuery(
          "INSUFFICIENT_PERMISSIONS",
          [],
          0,
          {
            userId: user.id,
            ip: event.getClientAddress(),
            userAgent: event.request.headers.get("user-agent"),
            error: `Role ${user.role} not in allowed roles: ${allowedRoles.join(", ")}`
          }
        );
      }
      return {
        success: false,
        response: json(
          {
            error: "Insufficient permissions",
            code: "INSUFFICIENT_PERMISSIONS"
          },
          { status: 403 }
        )
      };
    }
  }
  let validatedBody;
  let validatedQuery;
  if (bodySchema && (event.request.method === "POST" || event.request.method === "PUT" || event.request.method === "PATCH")) {
    const bodyResult = await validateRequestBody(event.request, bodySchema, {
      logValidation: logAttempts,
      userId: event.locals.user?.id
    });
    if (!bodyResult.success) {
      return { success: false, response: bodyResult.response };
    }
    validatedBody = bodyResult.data;
  }
  if (querySchema) {
    const queryResult = validateSearchParams(event.url, querySchema);
    if (!queryResult.success) {
      return { success: false, response: queryResult.response };
    }
    validatedQuery = queryResult.data;
  }
  return {
    success: true,
    user: event.locals.user,
    body: validatedBody,
    query: validatedQuery
  };
}

export { validateAPIRequestComprehensive as a, validateAPIRequest as v };
//# sourceMappingURL=middleware-CRj8HrLf.js.map
