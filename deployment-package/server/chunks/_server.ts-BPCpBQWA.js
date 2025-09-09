import { j as json } from './index-Djsj11qr.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import { D as DatabaseSecurityLogger } from './db-security-logger-C-Isx1J6.js';
import { a as validateAPIRequestComprehensive } from './middleware-CRj8HrLf.js';
import { query } from './db-loader-D8HPWY1t.js';
import 'winston';
import 'pino';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import 'zod';
import './status-BUw8K8Dp.js';

const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 5e3,
  // 5 seconds
  DB_QUERY_TIME: 3e3,
  // 3 seconds
  WEBSOCKET_CONNECTION_TIME: 1e3,
  // 1 second
  MEMORY_USAGE_MB: 1024,
  // 1GB
  CPU_USAGE_PERCENT: 80
};
class MetricsCollector {
  metrics = /* @__PURE__ */ new Map();
  maxDataPoints = 1e3;
  // Keep last 1000 data points per metric
  /**
   * Record a metric value
   */
  record(metric) {
    const key = metric.name;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    const dataPoints = this.metrics.get(key);
    dataPoints.push(metric);
    if (dataPoints.length > this.maxDataPoints) {
      dataPoints.splice(0, dataPoints.length - this.maxDataPoints);
    }
    this.checkThresholds(metric);
  }
  /**
   * Get metric statistics
   */
  getStats(metricName, timeWindowMs = 6e4) {
    const dataPoints = this.metrics.get(metricName);
    if (!dataPoints) return null;
    const cutoff = Date.now() - timeWindowMs;
    const recentPoints = dataPoints.filter((point) => point.timestamp > cutoff);
    if (recentPoints.length === 0) return null;
    const values = recentPoints.map((point) => point.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: values[Math.floor(values.length * 0.95)] || values[values.length - 1],
      p99: values[Math.floor(values.length * 0.99)] || values[values.length - 1]
    };
  }
  /**
   * Get all metrics for monitoring dashboard
   */
  getAllMetrics() {
    const result = {};
    for (const [name, dataPoints] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        result[name] = {
          ...stats,
          lastValue: dataPoints[dataPoints.length - 1]?.value,
          lastTimestamp: dataPoints[dataPoints.length - 1]?.timestamp
        };
      }
    }
    return result;
  }
  /**
   * Record API request metrics
   */
  recordAPIRequest(method, path, duration, status) {
    this.record({
      name: "api_request_duration",
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
      tags: { method, path, status: status.toString() }
    });
    this.record({
      name: "api_request_count",
      value: 1,
      unit: "count",
      timestamp: Date.now(),
      tags: { method, path, status: status.toString() }
    });
  }
  /**
   * Record authentication events
   */
  recordAuthEvent(event, userId) {
    this.record({
      name: "auth_events",
      value: 1,
      unit: "count",
      timestamp: Date.now(),
      tags: { event, userId: userId || "unknown" }
    });
  }
  /**
   * Record rate limiting events
   */
  recordRateLimit(endpoint, ip) {
    this.record({
      name: "rate_limit_violations",
      value: 1,
      unit: "count",
      timestamp: Date.now(),
      tags: { endpoint, ip }
    });
  }
  /**
   * Record error events
   */
  recordError(type, message, stack) {
    this.record({
      name: "application_errors",
      value: 1,
      unit: "count",
      timestamp: Date.now(),
      tags: { type, message: message.substring(0, 100) }
    });
  }
  /**
   * Check metric against performance thresholds
   */
  checkThresholds(metric) {
    let threshold;
    let thresholdType = "performance";
    switch (metric.name) {
      case "api_response_time":
        threshold = PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME;
        break;
      case "db_query_time":
        threshold = PERFORMANCE_THRESHOLDS.DB_QUERY_TIME;
        break;
      case "websocket_connection_time":
        threshold = PERFORMANCE_THRESHOLDS.WEBSOCKET_CONNECTION_TIME;
        break;
      case "memory_usage_mb":
        threshold = PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB;
        thresholdType = "resource";
        break;
      case "cpu_usage_percent":
        threshold = PERFORMANCE_THRESHOLDS.CPU_USAGE_PERCENT;
        thresholdType = "resource";
        break;
    }
    if (threshold && metric.value > threshold) {
      logger.logPerformance(LogLevel.WARN, `Performance threshold exceeded: ${metric.name}`, {
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        threshold,
        component: thresholdType
      });
    }
  }
  /**
   * Clear old metrics data
   */
  cleanup(olderThanMs = 24 * 60 * 60 * 1e3) {
    const cutoff = Date.now() - olderThanMs;
    for (const [name, dataPoints] of this.metrics) {
      const filteredPoints = dataPoints.filter((point) => point.timestamp > cutoff);
      this.metrics.set(name, filteredPoints);
    }
  }
}
const metrics = new MetricsCollector();
function recordMemoryUsage() {
  const memUsage = process.memoryUsage();
  metrics.record({
    name: "memory_usage_mb",
    value: Math.round(memUsage.rss / 1024 / 1024),
    unit: "MB",
    timestamp: Date.now(),
    tags: { type: "rss" }
  });
  metrics.record({
    name: "memory_heap_mb",
    value: Math.round(memUsage.heapUsed / 1024 / 1024),
    unit: "MB",
    timestamp: Date.now(),
    tags: { type: "heap" }
  });
}
setInterval(recordMemoryUsage, 6e4);
setInterval(() => {
  metrics.cleanup();
}, 60 * 60 * 1e3);
const GET = async (event) => {
  const validation = await validateAPIRequestComprehensive(event, {
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
  const isAdmin = event.locals.user?.role === "ADMIN";
  try {
    const startTime = Date.now();
    const dbCheck = await checkDatabase();
    const loggingCheck = checkLogging();
    const securityCheck = checkSecurity();
    const memoryCheck = checkMemory();
    const diskCheck = checkDisk();
    const checks = { database: dbCheck, logging: loggingCheck, security: securityCheck, memory: memoryCheck, disk: diskCheck };
    const overallStatus = calculateOverallStatus(checks);
    const healthStatus = {
      status: overallStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      checks,
      metrics: {
        requests: {
          total: metrics.getStats("api_request_count")?.count || 0,
          errors: metrics.getStats("application_errors")?.count || 0,
          avgResponseTime: metrics.getStats("api_request_duration")?.avg || 0
        },
        security: {
          threats: DatabaseSecurityLogger.getSecurityStats().suspiciousQueries,
          suspiciousActivities: DatabaseSecurityLogger.getSuspiciousActivities(10).length
        },
        performance: {
          slowQueries: DatabaseSecurityLogger.getSecurityStats().slowQueries,
          avgQueryTime: metrics.getStats("db_query_time")?.avg || 0
        }
      }
    };
    logger.logSystem(LogLevel.INFO, "Health check accessed", {
      component: "health",
      event: "check_accessed",
      details: {
        userId: event.locals.user?.id,
        isAdmin,
        status: overallStatus,
        responseTime: Date.now() - startTime
      }
    });
    if (!isAdmin) {
      return json({
        status: overallStatus,
        timestamp: healthStatus.timestamp,
        uptime: healthStatus.uptime,
        message: overallStatus === "healthy" ? "System operational" : "System issues detected"
      });
    }
    return json(healthStatus);
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Health check failed", {
      component: "health",
      event: "check_failed",
      error
    });
    return json(
      {
        status: "unhealthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: "Health check failed"
      },
      { status: 500 }
    );
  }
};
async function checkDatabase() {
  const startTime = Date.now();
  try {
    await query("SELECT 1 as health_check");
    const responseTime = Date.now() - startTime;
    if (responseTime > 5e3) {
      return {
        status: "warning",
        message: "Database responding slowly",
        responseTime,
        details: { threshold: 5e3 }
      };
    }
    return {
      status: "ok",
      message: "Database connection healthy",
      responseTime
    };
  } catch (error) {
    return {
      status: "error",
      message: "Database connection failed",
      responseTime: Date.now() - startTime,
      details: { error: error.message }
    };
  }
}
function checkLogging() {
  try {
    logger.logSystem(LogLevel.DEBUG, "Health check logging test", {
      component: "health",
      event: "logging_test"
    });
    return {
      status: "ok",
      message: "Logging system operational"
    };
  } catch (error) {
    return {
      status: "error",
      message: "Logging system failed",
      details: { error: error.message }
    };
  }
}
function checkSecurity() {
  const stats = DatabaseSecurityLogger.getSecurityStats();
  if (stats.suspiciousQueries > 10) {
    return {
      status: "warning",
      message: "High number of suspicious activities detected",
      details: { suspiciousQueries: stats.suspiciousQueries }
    };
  }
  if (stats.errorQueries > 50) {
    return {
      status: "warning",
      message: "High number of database errors",
      details: { errorQueries: stats.errorQueries }
    };
  }
  return {
    status: "ok",
    message: "Security monitoring active",
    details: stats
  };
}
function checkMemory() {
  const memUsage = process.memoryUsage();
  const totalMB = Math.round(memUsage.rss / 1024 / 1024);
  const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  if (totalMB > 1024) {
    return {
      status: "warning",
      message: "High memory usage detected",
      details: { totalMB, heapMB, threshold: 1024 }
    };
  }
  return {
    status: "ok",
    message: "Memory usage normal",
    details: { totalMB, heapMB }
  };
}
function checkDisk() {
  return {
    status: "ok",
    message: "Disk space check not implemented",
    details: { note: "Requires fs-extra or similar for disk space monitoring" }
  };
}
function calculateOverallStatus(checks) {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.some((status) => status === "error")) {
    return "unhealthy";
  }
  if (statuses.some((status) => status === "warning")) {
    return "degraded";
  }
  return "healthy";
}

export { GET };
//# sourceMappingURL=_server.ts-BPCpBQWA.js.map
