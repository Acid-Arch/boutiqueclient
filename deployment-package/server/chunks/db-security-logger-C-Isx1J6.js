import { d as dev } from './index-Dn7PghUK.js';

const SENSITIVE_QUERIES = [
  "users",
  "login_attempts",
  "sessions",
  "oauth_accounts",
  "audit_logs",
  "password",
  "secret",
  "token"
];
const SUSPICIOUS_PATTERNS = [
  /UNION.*SELECT/i,
  /OR.*1.*=.*1/i,
  /WHERE.*1.*=.*1/i,
  /DROP.*TABLE/i,
  /DELETE.*FROM.*users/i,
  /UPDATE.*users.*SET.*password/i,
  /INSERT.*INTO.*users/i,
  /'.*OR.*/i,
  /;.*--/i,
  /\/\*.*\*\//i
];
class DatabaseSecurityLogger {
  static logs = [];
  static MAX_LOGS = 1e3;
  /**
   * Log a database query for security monitoring
   */
  static logQuery(query, params = [], duration, context) {
    const queryType = this.getQueryType(query);
    const isSensitive = this.isSensitiveQuery(query);
    const isSuspicious = this.isSuspiciousQuery(query, params);
    if (isSensitive || isSuspicious || context?.error || dev) {
      const logEntry = {
        query: this.sanitizeQuery(query),
        params: this.sanitizeParams(params),
        duration,
        timestamp: /* @__PURE__ */ new Date(),
        userId: context?.userId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        error: context?.error,
        queryType
      };
      this.addLog(logEntry);
      if (isSuspicious) {
        console.warn("🚨 SUSPICIOUS DATABASE QUERY DETECTED:", {
          query: logEntry.query,
          params: logEntry.params,
          context
        });
      }
      if (duration > 5e3) {
        console.warn("🐌 SLOW DATABASE QUERY:", {
          query: logEntry.query,
          duration: `${duration}ms`,
          context
        });
      }
    }
  }
  /**
   * Get query type from SQL string
   */
  static getQueryType(query) {
    const normalizedQuery = query.trim().toUpperCase();
    if (normalizedQuery.startsWith("SELECT")) return "SELECT";
    if (normalizedQuery.startsWith("INSERT")) return "INSERT";
    if (normalizedQuery.startsWith("UPDATE")) return "UPDATE";
    if (normalizedQuery.startsWith("DELETE")) return "DELETE";
    return "OTHER";
  }
  /**
   * Check if query involves sensitive data
   */
  static isSensitiveQuery(query) {
    const lowerQuery = query.toLowerCase();
    return SENSITIVE_QUERIES.some((table) => lowerQuery.includes(table));
  }
  /**
   * Check if query contains suspicious patterns
   */
  static isSuspiciousQuery(query, params = []) {
    if (SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(query))) {
      return true;
    }
    const allParams = params.map((p) => String(p)).join(" ");
    if (SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(allParams))) {
      return true;
    }
    return false;
  }
  /**
   * Sanitize query for logging (remove sensitive data)
   */
  static sanitizeQuery(query) {
    return query.replace(
      /(password|secret|token|key)\s*=\s*[$]?\d+/gi,
      "$1 = [REDACTED]"
    );
  }
  /**
   * Sanitize parameters for logging
   */
  static sanitizeParams(params) {
    return params.map((param, index) => {
      if (typeof param === "string" && param.length > 50) {
        return `${param.substring(0, 50)}... [TRUNCATED]`;
      }
      if (typeof param === "string" && /password|secret|token/i.test(param)) {
        return "[REDACTED]";
      }
      return param;
    });
  }
  /**
   * Add log entry with rotation
   */
  static addLog(logEntry) {
    this.logs.push(logEntry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.splice(0, this.logs.length - this.MAX_LOGS);
    }
  }
  /**
   * Get recent suspicious activities
   */
  static getSuspiciousActivities(limit = 50) {
    const now = /* @__PURE__ */ new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
    return this.logs.filter(
      (log) => log.timestamp > oneHourAgo && (this.isSuspiciousQuery(log.query, log.params) || log.error)
    ).slice(-limit);
  }
  /**
   * Get security statistics
   */
  static getSecurityStats() {
    const now = /* @__PURE__ */ new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
    const recentLogs = this.logs.filter((log) => log.timestamp > oneHourAgo);
    return {
      totalQueries: recentLogs.length,
      suspiciousQueries: recentLogs.filter(
        (log) => this.isSuspiciousQuery(log.query, log.params)
      ).length,
      errorQueries: recentLogs.filter((log) => log.error).length,
      slowQueries: recentLogs.filter((log) => log.duration > 5e3).length,
      lastActivity: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
    };
  }
  /**
   * Clear logs (for testing or privacy)
   */
  static clearLogs() {
    this.logs.length = 0;
  }
}
async function monitoredQuery(queryFn, query, params = [], context) {
  const startTime = Date.now();
  let error;
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    DatabaseSecurityLogger.logQuery(query, params, duration, context);
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    error = err instanceof Error ? err.message : String(err);
    DatabaseSecurityLogger.logQuery(query, params, duration, {
      ...context,
      error
    });
    throw err;
  }
}

export { DatabaseSecurityLogger as D, monitoredQuery as m };
//# sourceMappingURL=db-security-logger-C-Isx1J6.js.map
