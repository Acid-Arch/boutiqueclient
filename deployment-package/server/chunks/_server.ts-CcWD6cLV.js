import { j as json } from './index-Djsj11qr.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import { a as rateLimitErrorReport, c as createErrorResponse, E as ErrorSeverity, b as ErrorType, h as handleApiError } from './rate-limiter-comprehensive-DZzPnbd1.js';
import 'winston';
import 'pino';
import 'rate-limiter-flexible';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

const POST = async (event) => {
  const { request, locals } = event;
  const rateLimitResponse = await rateLimitErrorReport(event);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  try {
    const reportData = await request.json();
    if (!reportData.errorId || !reportData.message || !reportData.url) {
      return json(
        createErrorResponse("Missing required error report fields", {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.LOW,
          requestId: locals.requestId
        }),
        { status: 400 }
      );
    }
    const sanitizedReport = {
      errorId: reportData.errorId.substring(0, 100),
      // Limit length
      message: reportData.message.substring(0, 1e3),
      url: reportData.url.substring(0, 500),
      userAgent: reportData.userAgent?.substring(0, 500) || "Unknown",
      timestamp: reportData.timestamp,
      userId: locals.user?.id || reportData.userId,
      stack: reportData.stack ? reportData.stack.substring(0, 5e3) : void 0,
      context: reportData.context || {}
    };
    logger.logSystem(LogLevel.ERROR, `Client-side error reported: ${sanitizedReport.message}`, {
      component: "client-error-reporter",
      event: "client_error_reported",
      details: {
        errorId: sanitizedReport.errorId,
        url: sanitizedReport.url,
        userAgent: sanitizedReport.userAgent,
        userId: sanitizedReport.userId,
        timestamp: sanitizedReport.timestamp,
        hasStack: !!sanitizedReport.stack,
        context: sanitizedReport.context
      },
      error: sanitizedReport.stack ? {
        name: "ClientError",
        message: sanitizedReport.message,
        stack: sanitizedReport.stack
      } : void 0
    });
    if (sanitizedReport.message.toLowerCase().includes("security") || sanitizedReport.message.toLowerCase().includes("unauthorized") || sanitizedReport.message.toLowerCase().includes("csrf") || sanitizedReport.message.toLowerCase().includes("xss")) {
      logger.logSecurity(LogLevel.WARN, `Potential security-related client error: ${sanitizedReport.message}`, {
        eventType: "client_security_error",
        severity: "medium",
        userId: sanitizedReport.userId,
        ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: sanitizedReport.userAgent,
        details: {
          errorId: sanitizedReport.errorId,
          url: sanitizedReport.url,
          context: sanitizedReport.context
        }
      });
    }
    return json({
      success: true,
      message: "Error report received",
      errorId: sanitizedReport.errorId
    });
  } catch (error) {
    return handleApiError(error instanceof Error ? error : new Error("Failed to process error report"), {
      locals,
      url: { pathname: "/api/errors/report" },
      request
    }, {
      operation: "error_report_processing"
    });
  }
};

export { POST };
//# sourceMappingURL=_server.ts-CcWD6cLV.js.map
