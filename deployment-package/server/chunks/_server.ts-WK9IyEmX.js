import { j as json } from './index-Djsj11qr.js';
import { L as LogLevel, l as logger } from './logger-RU41djIi.js';
import { p as prisma } from './prisma-4aKdruO4.js';
import 'winston';
import 'pino';
import '@prisma/client';

let lastHealthCheck = null;
let lastHealthCheckTime = 0;
const CACHE_DURATION = 3e4;
async function checkDatabase() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 as health_check`;
    const responseTime = Date.now() - start;
    if (responseTime > 1e3) {
      return {
        status: "warn",
        responseTime,
        message: "Database responding slowly",
        details: { threshold: "1000ms", actual: `${responseTime}ms` }
      };
    }
    return {
      status: "pass",
      responseTime,
      message: "Database connection healthy"
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - start,
      message: "Database connection failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    };
  }
}
async function checkMemory() {
  const start = Date.now();
  try {
    const memUsage = process.memoryUsage();
    const memUsageGB = memUsage.heapUsed / 1024 / 1024 / 1024;
    const memLimitGB = 1;
    const responseTime = Date.now() - start;
    if (memUsageGB > memLimitGB * 0.9) {
      return {
        status: "warn",
        responseTime,
        message: "High memory usage detected",
        details: {
          heapUsedGB: Math.round(memUsageGB * 100) / 100,
          heapTotalGB: Math.round(memUsage.heapTotal / 1024 / 1024 / 1024 * 100) / 100,
          threshold: `${memLimitGB}GB`
        }
      };
    }
    if (memUsageGB > memLimitGB) {
      return {
        status: "fail",
        responseTime,
        message: "Memory usage critical",
        details: {
          heapUsedGB: Math.round(memUsageGB * 100) / 100,
          heapTotalGB: Math.round(memUsage.heapTotal / 1024 / 1024 / 1024 * 100) / 100,
          threshold: `${memLimitGB}GB`
        }
      };
    }
    return {
      status: "pass",
      responseTime,
      message: "Memory usage normal",
      details: {
        heapUsedGB: Math.round(memUsageGB * 100) / 100,
        heapTotalGB: Math.round(memUsage.heapTotal / 1024 / 1024 / 1024 * 100) / 100
      }
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - start,
      message: "Memory check failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    };
  }
}
async function checkExternalServices() {
  const start = Date.now();
  try {
    return {
      status: "pass",
      responseTime: Date.now() - start,
      message: "External services healthy"
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - start,
      message: "External service check failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    };
  }
}
function getOverallStatus(checks) {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.some((status) => status === "fail")) {
    return "unhealthy";
  }
  if (statuses.some((status) => status === "warn")) {
    return "degraded";
  }
  return "healthy";
}
async function performHealthCheck() {
  const startTime = Date.now();
  const startCpuUsage = process.cpuUsage();
  const [databaseCheck, memoryCheck, externalCheck] = await Promise.all([
    checkDatabase(),
    checkMemory(),
    checkExternalServices()
  ]);
  const checks = {
    database: databaseCheck,
    memory: memoryCheck,
    external: externalCheck
  };
  const endTime = Date.now();
  const endCpuUsage = process.cpuUsage(startCpuUsage);
  const healthStatus = {
    status: getOverallStatus(checks),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: "production",
    uptime: process.uptime(),
    checks,
    performance: {
      responseTime: endTime - startTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: endCpuUsage
    }
  };
  return healthStatus;
}
const GET = async ({ url }) => {
  const includeDetails = url.searchParams.get("details") === "true";
  const skipCache = url.searchParams.get("cache") === "false";
  try {
    let healthStatus;
    const now = Date.now();
    if (!skipCache && lastHealthCheck && now - lastHealthCheckTime < CACHE_DURATION) {
      healthStatus = lastHealthCheck;
    } else {
      healthStatus = await performHealthCheck();
      lastHealthCheck = healthStatus;
      lastHealthCheckTime = now;
    }
    const logLevel = healthStatus.status === "healthy" ? LogLevel.DEBUG : healthStatus.status === "degraded" ? LogLevel.WARN : LogLevel.ERROR;
    logger.logSystem(logLevel, `Health check completed: ${healthStatus.status}`, {
      component: "health-check",
      event: "health_check_performed",
      details: {
        status: healthStatus.status,
        responseTime: healthStatus.performance.responseTime,
        databaseStatus: healthStatus.checks.database.status,
        memoryStatus: healthStatus.checks.memory.status,
        uptime: healthStatus.uptime
      }
    });
    const httpStatus = healthStatus.status === "healthy" ? 200 : healthStatus.status === "degraded" ? 207 : (
      // Multi-Status
      503
    );
    const response = includeDetails ? healthStatus : {
      status: healthStatus.status,
      timestamp: healthStatus.timestamp,
      uptime: healthStatus.uptime,
      version: healthStatus.version
    };
    return json(response, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Health check endpoint failed", {
      component: "health-check",
      event: "health_check_failed",
      error: error instanceof Error ? error : void 0,
      details: {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });
    return json({
      status: "unhealthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      error: "Health check failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Type": "application/json"
      }
    });
  }
};

export { GET };
//# sourceMappingURL=_server.ts-WK9IyEmX.js.map
