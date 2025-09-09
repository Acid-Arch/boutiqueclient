import winston from 'winston';
import pino from 'pino';

var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2["ERROR"] = "error";
  LogLevel2["WARN"] = "warn";
  LogLevel2["INFO"] = "info";
  LogLevel2["DEBUG"] = "debug";
  return LogLevel2;
})(LogLevel || {});
const pinoLogger = pino({
  level: "info",
  transport: void 0,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      const cleaned = Object.fromEntries(
        Object.entries(object).filter(([_, value]) => value !== void 0)
      );
      return cleaned;
    }
  },
  serializers: {
    error: (error) => ({
      name: error.name,
      message: error.message,
      stack: void 0,
      code: error.code
    })
  },
  redact: {
    paths: [
      "password",
      "token",
      "secret",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
      "*.secret"
    ],
    censor: "[REDACTED]"
  }
});
const winstonLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
      const sanitized = JSON.stringify(info, (key, value) => {
        if (typeof key === "string" && (key.toLowerCase().includes("password") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token"))) {
          return "[REDACTED]";
        }
        return value;
      });
      return sanitized;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10 * 1024 * 1024,
      // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 10 * 1024 * 1024,
      // 10MB
      maxFiles: 10,
      tailable: true
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
class ApplicationLogger {
  requestCounter = 0;
  /**
   * Generate unique request ID
   */
  generateRequestId() {
    this.requestCounter = (this.requestCounter + 1) % 1e4;
    return `req_${Date.now()}_${this.requestCounter}`;
  }
  /**
   * Log authentication events
   */
  logAuth(level, message, context) {
    this.log(level, message, {
      ...context,
      context: "auth",
      tags: ["auth", context.action, context.success ? "success" : "failure"]
    });
  }
  /**
   * Log API requests and responses
   */
  logAPI(level, message, context) {
    this.log(level, message, {
      ...context,
      context: "api",
      tags: ["api", context.method.toLowerCase(), `status_${context.statusCode}`]
    });
  }
  /**
   * Log database operations
   */
  logDatabase(level, message, context) {
    this.log(level, message, {
      ...context,
      context: "database",
      tags: ["database", context.operation, context.table].filter(Boolean)
    });
  }
  /**
   * Log security events
   */
  logSecurity(level, message, context) {
    this.log(level, message, {
      ...context,
      context: "security",
      tags: ["security", context.eventType, `severity_${context.severity}`]
    });
  }
  /**
   * Log business events
   */
  logBusiness(level, message, context) {
    this.log(level, message, {
      ...context,
      context: "business",
      tags: ["business", context.event]
    });
  }
  /**
   * Log performance metrics
   */
  logPerformance(level, message, context) {
    const isSlowPerformance = context.threshold && context.value > context.threshold;
    this.log(level, message, {
      ...context,
      context: "performance",
      tags: [
        "performance",
        context.metric,
        context.component,
        ...isSlowPerformance ? ["slow"] : []
      ]
    });
  }
  /**
   * Log system events
   */
  logSystem(level, message, context) {
    this.log(level, message, {
      ...context,
      context: "system",
      tags: ["system", context.component, context.event]
    });
  }
  /**
   * Core logging method
   */
  log(level, message, context = {}) {
    const logEntry = {
      level,
      message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      service: "boutique-client-portal",
      ...context
    };
    pinoLogger[level](logEntry);
    {
      winstonLogger[level](logEntry);
    }
    if (context.context === "security" && context.severity === "critical") {
      console.error("🚨 CRITICAL SECURITY EVENT:", logEntry);
    }
  }
  /**
   * Create child logger with context
   */
  child(context) {
    const childPino = pinoLogger.child(context);
    return {
      error: (message, extra) => childPino.error({ ...extra }, message),
      warn: (message, extra) => childPino.warn({ ...extra }, message),
      info: (message, extra) => childPino.info({ ...extra }, message),
      debug: (message, extra) => childPino.debug({ ...extra }, message)
    };
  }
  /**
   * Get current log stats (for monitoring)
   */
  getStats() {
    return {
      logsToday: 0,
      // TODO: Implement actual counting
      errorsToday: 0,
      warningsToday: 0,
      criticalEvents: 0,
      avgResponseTime: 0
      // TODO: Track this
    };
  }
}
const logger = new ApplicationLogger();
logger.logAuth.bind(logger);
logger.logAPI.bind(logger);
logger.logDatabase.bind(logger);
logger.logSecurity.bind(logger);
logger.logBusiness.bind(logger);
logger.logPerformance.bind(logger);
logger.logSystem.bind(logger);

export { LogLevel as L, logger as l };
//# sourceMappingURL=logger-RU41djIi.js.map
