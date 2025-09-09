import { j as json } from './index-Djsj11qr.js';
import { p as prisma } from './prisma-4aKdruO4.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import '@prisma/client';
import 'winston';
import 'pino';

const GET = async () => {
  try {
    const checks = await Promise.allSettled([
      // Database connectivity
      prisma.$queryRaw`SELECT 1 as readiness_check`,
      // Check if essential environment variables are set
      checkEnvironmentVariables(),
      // Check if auth system is initialized
      checkAuthSystem()
    ]);
    const results = checks.map((result, index) => ({
      check: ["database", "environment", "auth"][index],
      status: result.status === "fulfilled" ? "ready" : "not_ready",
      reason: result.status === "rejected" ? result.reason?.message || "Unknown error" : void 0
    }));
    const allReady = results.every((result) => result.status === "ready");
    if (allReady) {
      return json({
        status: "ready",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        checks: results
      }, {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Content-Type": "application/json"
        }
      });
    } else {
      logger.logSystem(LogLevel.WARN, "Readiness check failed", {
        component: "readiness-check",
        event: "readiness_failed",
        details: {
          failedChecks: results.filter((r) => r.status === "not_ready")
        }
      });
      return json({
        status: "not_ready",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        checks: results
      }, {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Readiness check endpoint failed", {
      component: "readiness-check",
      event: "readiness_check_error",
      error: error instanceof Error ? error : void 0
    });
    return json({
      status: "not_ready",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Type": "application/json"
      }
    });
  }
};
async function checkEnvironmentVariables() {
  const required = [
    "DATABASE_URL",
    "AUTH_SECRET"
  ];
  const missing = required.filter((env) => !process.env[env]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
async function checkAuthSystem() {
  if (!process.env.AUTH_SECRET) {
    throw new Error("Auth system not properly configured");
  }
}

export { GET };
//# sourceMappingURL=_server.ts-CdPDqlcl.js.map
