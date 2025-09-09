import { j as json } from './index-Djsj11qr.js';
import { D as DatabaseSecurityLogger } from './db-security-logger-C-Isx1J6.js';
import { v as validateAPIRequest } from './middleware-CRj8HrLf.js';
import { P as PaginationSchema } from './schemas-CDG_pjll.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import 'zod';

const GET = async (event) => {
  const validation = await validateAPIRequest(event, {
    paramsSchema: PaginationSchema,
    requireAuth: true,
    rateLimit: {
      requests: 10,
      windowMs: 60 * 1e3
      // 10 requests per minute
    }
  });
  if (!validation.success) {
    return validation.response;
  }
  if (event.locals.user?.role !== "ADMIN") {
    return json(
      {
        success: false,
        error: "Admin access required",
        code: "INSUFFICIENT_PERMISSIONS"
      },
      { status: 403 }
    );
  }
  try {
    const { limit } = validation.params;
    const suspiciousActivities = DatabaseSecurityLogger.getSuspiciousActivities(limit);
    const securityStats = DatabaseSecurityLogger.getSecurityStats();
    return json({
      success: true,
      data: {
        suspiciousActivities,
        stats: securityStats,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (error) {
    console.error("Security logs API error:", error);
    return json(
      {
        success: false,
        error: "Failed to fetch security logs"
      },
      { status: 500 }
    );
  }
};
const DELETE = async (event) => {
  const validation = await validateAPIRequest(event, {
    requireAuth: true,
    rateLimit: {
      requests: 1,
      windowMs: 60 * 1e3
      // 1 request per minute
    },
    logRequest: true
  });
  if (!validation.success) {
    return validation.response;
  }
  if (event.locals.user?.role !== "ADMIN") {
    return json(
      {
        success: false,
        error: "Admin access required",
        code: "INSUFFICIENT_PERMISSIONS"
      },
      { status: 403 }
    );
  }
  try {
    DatabaseSecurityLogger.clearLogs();
    return json({
      success: true,
      message: "Security logs cleared successfully"
    });
  } catch (error) {
    console.error("Clear security logs error:", error);
    return json(
      {
        success: false,
        error: "Failed to clear security logs"
      },
      { status: 500 }
    );
  }
};

export { DELETE, GET };
//# sourceMappingURL=_server.ts-CSdzJjmV.js.map
