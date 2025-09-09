import { j as json } from './index-Djsj11qr.js';
import { e as enhancedErrorRecovery } from './enhanced-error-recovery-SHA-Fz5J.js';
import './error-recovery-DvvqzRuU.js';

const GET = async ({ url }) => {
  try {
    const includeErrors = url.searchParams.get("errors") !== "false";
    const includePatterns = url.searchParams.get("patterns") !== "false";
    const includeHealth = url.searchParams.get("health") !== "false";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    if (limit < 1 || limit > 1e3) {
      return json(
        {
          error: "Invalid limit",
          message: "Limit must be between 1 and 1000"
        },
        { status: 400 }
      );
    }
    const realtimeData = {
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId: crypto.randomUUID()
    };
    if (includeErrors) {
      realtimeData.recentErrors = await getRecentErrors(limit);
      realtimeData.errorSummary = await getErrorSummary();
    }
    if (includePatterns) {
      realtimeData.patternUpdates = await getPatternUpdates(limit);
      realtimeData.systemAnalytics = enhancedErrorRecovery.getSystemAnalytics();
    }
    if (includeHealth) {
      realtimeData.healthUpdates = await getHealthUpdates(limit);
      realtimeData.criticalAccounts = await getCriticalAccounts();
    }
    realtimeData.systemStatus = await getSystemStatus();
    return json(realtimeData);
  } catch (error) {
    console.error("Enhanced error recovery realtime API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
};
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, data } = body;
    if (action === "push-error-update") {
      const { error, context } = data;
      if (!error || !context) {
        return json(
          {
            success: false,
            error: "Missing required data",
            message: "error and context are required"
          },
          { status: 400 }
        );
      }
      const result = await enhancedErrorRecovery.handleError(
        error,
        context,
        // Mock session manager for demonstration
        {
          pauseSession: async (sessionId) => {
            console.log(`Session ${sessionId} paused`);
          },
          cancelSession: async (sessionId, reason) => {
            console.log(`Session ${sessionId} cancelled: ${reason}`);
          },
          updateSessionProgress: async (sessionId, progress) => {
            console.log(`Session ${sessionId} progress updated:`, progress);
          }
        }
      );
      const broadcastData = {
        type: "ERROR_RECOVERY_UPDATE",
        error: result.scrapingError,
        recovery: result.recovery,
        patterns: result.patterns,
        healthUpdate: result.healthUpdate,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      return json({
        success: true,
        message: "Error update pushed successfully",
        result,
        broadcast: broadcastData
      });
    }
    if (action === "push-health-update") {
      const { accountId, healthData } = data;
      if (!accountId || !healthData) {
        return json(
          {
            success: false,
            error: "Missing required data",
            message: "accountId and healthData are required"
          },
          { status: 400 }
        );
      }
      const healthUpdate = {
        accountId,
        healthScore: healthData.healthScore || 50,
        riskFactors: healthData.riskFactors || {},
        predictions: healthData.predictions || {},
        lastAnalyzed: /* @__PURE__ */ new Date(),
        updatedBy: "enhanced-recovery-system"
      };
      const broadcastData = {
        type: "HEALTH_UPDATE",
        accountId,
        healthUpdate,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      return json({
        success: true,
        message: "Health update pushed successfully",
        healthUpdate,
        broadcast: broadcastData
      });
    }
    if (action === "push-pattern-update") {
      const { pattern } = data;
      if (!pattern) {
        return json(
          {
            success: false,
            error: "Missing pattern data",
            message: "pattern is required"
          },
          { status: 400 }
        );
      }
      const patternUpdate = {
        patternId: pattern.patternId || crypto.randomUUID(),
        errorTypes: pattern.errorTypes || ["UNKNOWN"],
        frequency: pattern.frequency || 1,
        confidence: pattern.confidence || 0.5,
        predictedImpact: pattern.predictedImpact || "MEDIUM",
        detectedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const broadcastData = {
        type: "PATTERN_UPDATE",
        pattern: patternUpdate,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      return json({
        success: true,
        message: "Pattern update pushed successfully",
        pattern: patternUpdate,
        broadcast: broadcastData
      });
    }
    return json(
      {
        success: false,
        error: "Invalid action",
        message: "Supported actions: push-error-update, push-health-update, push-pattern-update"
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Enhanced error recovery realtime POST error:", error);
    return json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
};
async function getRecentErrors(limit) {
  const now = Date.now();
  const recentErrors = [];
  const errorTypes = ["RATE_LIMIT", "API_ERROR", "NETWORK_ERROR", "TIMEOUT_ERROR"];
  const severities = ["LOW", "MEDIUM", "HIGH"];
  for (let i = 0; i < Math.min(limit, 20); i++) {
    const timestamp = new Date(now - Math.random() * 10 * 60 * 1e3);
    recentErrors.push({
      id: crypto.randomUUID(),
      type: errorTypes[Math.floor(Math.random() * errorTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      message: "Recent error detected by monitoring system",
      timestamp,
      sessionId: `session-${Math.floor(Math.random() * 10)}`,
      accountId: Math.random() > 0.3 ? `acc-${Math.floor(Math.random() * 20)}` : void 0,
      recovered: Math.random() > 0.2,
      recoveryTime: Math.random() * 30
      // seconds
    });
  }
  return recentErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
async function getErrorSummary() {
  return {
    last15Minutes: {
      totalErrors: Math.floor(Math.random() * 10) + 2,
      recoveredErrors: Math.floor(Math.random() * 8) + 1,
      activeErrors: Math.floor(Math.random() * 3)
    },
    last60Minutes: {
      totalErrors: Math.floor(Math.random() * 30) + 5,
      recoveredErrors: Math.floor(Math.random() * 25) + 4,
      activeErrors: Math.floor(Math.random() * 5) + 1
    },
    trendDirection: Math.random() > 0.5 ? "increasing" : "decreasing",
    severityDistribution: {
      "LOW": Math.floor(Math.random() * 5) + 1,
      "MEDIUM": Math.floor(Math.random() * 8) + 2,
      "HIGH": Math.floor(Math.random() * 3) + 1,
      "CRITICAL": Math.floor(Math.random() * 2)
    }
  };
}
async function getPatternUpdates(limit) {
  const updates = [];
  const patternTypes = ["frequency", "account-specific", "sequential", "time-based"];
  for (let i = 0; i < Math.min(limit, 5); i++) {
    updates.push({
      id: crypto.randomUUID(),
      type: patternTypes[Math.floor(Math.random() * patternTypes.length)],
      errorTypes: ["RATE_LIMIT", "API_ERROR"].slice(0, Math.floor(Math.random() * 2) + 1),
      confidence: 0.6 + Math.random() * 0.35,
      frequency: Math.floor(Math.random() * 10) + 3,
      impact: ["LOW", "MEDIUM", "HIGH"][Math.floor(Math.random() * 3)],
      detectedAt: new Date(Date.now() - Math.random() * 60 * 60 * 1e3),
      // Last hour
      status: "active"
    });
  }
  return updates;
}
async function getHealthUpdates(limit) {
  const updates = [];
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const changeType = ["improved", "degraded", "stable"][Math.floor(Math.random() * 3)];
    const healthScore = 30 + Math.random() * 60;
    updates.push({
      accountId: `acc-${Math.floor(Math.random() * 50).toString().padStart(3, "0")}`,
      changeType,
      previousScore: healthScore + (changeType === "improved" ? -10 : changeType === "degraded" ? 10 : 0),
      currentScore: healthScore,
      changeReason: changeType === "improved" ? "Successful sessions" : changeType === "degraded" ? "Multiple errors detected" : "Regular monitoring",
      updatedAt: new Date(Date.now() - Math.random() * 30 * 60 * 1e3)
      // Last 30 minutes
    });
  }
  return updates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
async function getCriticalAccounts() {
  const criticalAccounts = [];
  for (let i = 0; i < 3; i++) {
    criticalAccounts.push({
      accountId: `acc-critical-${i + 1}`,
      healthScore: Math.random() * 30,
      // Below 30 is critical
      issues: [
        "High error rate",
        "Consecutive authentication failures",
        "Rate limit violations"
      ].slice(0, Math.floor(Math.random() * 3) + 1),
      recommendedAction: "QUARANTINE",
      urgency: "HIGH",
      lastActivity: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1e3)
      // Last 2 hours
    });
  }
  return criticalAccounts;
}
async function getSystemStatus() {
  return {
    mlEngine: {
      status: "operational",
      patternRecognition: "active",
      confidenceLevel: 0.87,
      lastUpdate: (/* @__PURE__ */ new Date()).toISOString()
    },
    errorRecovery: {
      status: "operational",
      activeRecoveries: Math.floor(Math.random() * 5),
      successRate: 94.2,
      avgResponseTime: 0.8
      // seconds
    },
    healthMonitoring: {
      status: "operational",
      monitoredAccounts: 50,
      criticalAlerts: Math.floor(Math.random() * 3),
      lastHealthCheck: new Date(Date.now() - 5 * 60 * 1e3).toISOString()
      // 5 minutes ago
    },
    systemLoad: {
      cpu: Math.random() * 20 + 10,
      // 10-30%
      memory: Math.random() * 30 + 40,
      // 40-70%
      networkLatency: Math.random() * 20 + 30
      // 30-50ms
    }
  };
}

export { GET, POST };
//# sourceMappingURL=_server.ts-Pkn70OyZ.js.map
