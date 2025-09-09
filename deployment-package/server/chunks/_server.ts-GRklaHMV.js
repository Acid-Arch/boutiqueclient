import { j as json } from './index-Djsj11qr.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import { m as metrics } from './metrics-CPwQmnJJ.js';
import { r as rateLimitAdmin } from './rate-limiter-comprehensive-DZzPnbd1.js';
import 'winston';
import 'pino';
import 'rate-limiter-flexible';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

var AlertSeverity = /* @__PURE__ */ ((AlertSeverity2) => {
  AlertSeverity2["LOW"] = "low";
  AlertSeverity2["MEDIUM"] = "medium";
  AlertSeverity2["HIGH"] = "high";
  AlertSeverity2["CRITICAL"] = "critical";
  return AlertSeverity2;
})(AlertSeverity || {});
var AlertType = /* @__PURE__ */ ((AlertType2) => {
  AlertType2["SYSTEM"] = "system";
  AlertType2["PERFORMANCE"] = "performance";
  AlertType2["SECURITY"] = "security";
  AlertType2["BUSINESS"] = "business";
  AlertType2["DATABASE"] = "database";
  AlertType2["EXTERNAL"] = "external";
  return AlertType2;
})(AlertType || {});
class AlertManager {
  static instance;
  activeAlerts = /* @__PURE__ */ new Map();
  alertRules = /* @__PURE__ */ new Map();
  alertHistory = [];
  lastEvaluationTimes = /* @__PURE__ */ new Map();
  static getInstance() {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
      AlertManager.instance.setupDefaultRules();
    }
    return AlertManager.instance;
  }
  setupDefaultRules() {
    this.addRule({
      id: "high_response_time",
      name: "High Response Time",
      type: "performance",
      severity: "medium",
      condition: {
        metric: "http_request_duration_ms",
        operator: "gt",
        threshold: 2e3,
        // 2 seconds
        duration: 5,
        // 5 minutes
        evaluationWindow: 10
        // 10 minutes
      },
      enabled: true,
      cooldown: 15,
      actions: [
        { type: "log", config: {} }
        // { type: 'email', config: { to: 'ops@company.com' } }
      ]
    });
    this.addRule({
      id: "high_error_rate",
      name: "High Error Rate",
      type: "system",
      severity: "high",
      condition: {
        metric: "errors_total",
        operator: "gt",
        threshold: 10,
        // 10 errors
        duration: 5,
        // 5 minutes
        evaluationWindow: 10
        // 10 minutes
      },
      enabled: true,
      cooldown: 10,
      actions: [
        { type: "log", config: {} }
      ]
    });
    this.addRule({
      id: "high_memory_usage",
      name: "High Memory Usage",
      type: "system",
      severity: "medium",
      condition: {
        metric: "memory_heap_used_bytes",
        operator: "gt",
        threshold: 1024 * 1024 * 1024,
        // 1GB
        duration: 10,
        // 10 minutes
        evaluationWindow: 15
        // 15 minutes
      },
      enabled: true,
      cooldown: 30,
      actions: [
        { type: "log", config: {} }
      ]
    });
    this.addRule({
      id: "database_connection_issues",
      name: "Database Connection Issues",
      type: "database",
      severity: "critical",
      condition: {
        metric: "db_connection_errors",
        operator: "gt",
        threshold: 3,
        // 3 connection errors
        duration: 2,
        // 2 minutes
        evaluationWindow: 5
        // 5 minutes
      },
      enabled: true,
      cooldown: 5,
      actions: [
        { type: "log", config: {} }
      ]
    });
  }
  addRule(rule) {
    this.alertRules.set(rule.id, rule);
    logger.logSystem(LogLevel.INFO, `Alert rule added: ${rule.name}`, {
      component: "alert-manager",
      event: "rule_added",
      details: {
        ruleId: rule.id,
        type: rule.type,
        severity: rule.severity
      }
    });
  }
  removeRule(ruleId) {
    if (this.alertRules.delete(ruleId)) {
      logger.logSystem(LogLevel.INFO, `Alert rule removed: ${ruleId}`, {
        component: "alert-manager",
        event: "rule_removed",
        details: { ruleId }
      });
    }
  }
  // Evaluate all rules and trigger alerts if necessary
  evaluateRules() {
    const now = Date.now();
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;
      const lastEvaluation = this.lastEvaluationTimes.get(ruleId) || 0;
      if (now - lastEvaluation < rule.cooldown * 60 * 1e3) {
        continue;
      }
      try {
        if (this.evaluateRule(rule)) {
          this.triggerAlert(rule);
          this.lastEvaluationTimes.set(ruleId, now);
        }
      } catch (error) {
        logger.logSystem(LogLevel.ERROR, `Failed to evaluate alert rule: ${rule.name}`, {
          component: "alert-manager",
          event: "rule_evaluation_failed",
          error: error instanceof Error ? error : void 0,
          details: { ruleId, ruleName: rule.name }
        });
      }
    }
  }
  evaluateRule(rule) {
    const metricsData = metrics.getMetrics(Date.now() - rule.condition.evaluationWindow * 60 * 1e3);
    const metricData = metricsData.metrics[rule.condition.metric];
    if (!metricData) return false;
    let value;
    switch (metricData.type) {
      case "counter":
        value = metricData.total || 0;
        break;
      case "gauge":
        value = metricData.current || 0;
        break;
      case "timer":
      case "histogram":
        value = metricData.avg || 0;
        break;
      default:
        return false;
    }
    return this.compareValues(value, rule.condition.operator, rule.condition.threshold);
  }
  compareValues(value, operator, threshold) {
    switch (operator) {
      case "gt":
        return value > threshold;
      case "gte":
        return value >= threshold;
      case "lt":
        return value < threshold;
      case "lte":
        return value <= threshold;
      case "eq":
        return value === threshold;
      case "neq":
        return value !== threshold;
      default:
        return false;
    }
  }
  triggerAlert(rule) {
    const alertId = `${rule.id}_${Date.now()}`;
    const alert = {
      id: alertId,
      type: rule.type,
      severity: rule.severity,
      title: rule.name,
      message: `Alert triggered: ${rule.name}`,
      timestamp: Date.now(),
      resolved: false,
      metadata: {
        ruleId: rule.id,
        condition: rule.condition
      },
      notificationsSent: []
    };
    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 1e3) {
      this.alertHistory.splice(0, this.alertHistory.length - 1e3);
    }
    for (const action of rule.actions) {
      this.executeAction(alert, action);
    }
    logger.logSystem(LogLevel.WARN, `Alert triggered: ${rule.name}`, {
      component: "alert-manager",
      event: "alert_triggered",
      details: {
        alertId,
        type: alert.type,
        severity: alert.severity,
        rule: rule.name
      }
    });
  }
  executeAction(alert, action) {
    try {
      switch (action.type) {
        case "log":
          logger.logSystem(LogLevel.ERROR, `ALERT: ${alert.title}`, {
            component: "alert-manager",
            event: "alert_notification",
            details: {
              alertId: alert.id,
              type: alert.type,
              severity: alert.severity,
              message: alert.message,
              metadata: alert.metadata
            }
          });
          break;
        case "email":
          console.log(`EMAIL ALERT: ${alert.title} - ${alert.message}`);
          break;
        case "webhook":
          console.log(`WEBHOOK ALERT: ${alert.title} - ${alert.message}`);
          break;
        case "slack":
          console.log(`SLACK ALERT: ${alert.title} - ${alert.message}`);
          break;
      }
      alert.notificationsSent.push(action.type);
    } catch (error) {
      logger.logSystem(LogLevel.ERROR, `Failed to execute alert action: ${action.type}`, {
        component: "alert-manager",
        event: "action_execution_failed",
        error: error instanceof Error ? error : void 0,
        details: {
          alertId: alert.id,
          actionType: action.type
        }
      });
    }
  }
  // Resolve an alert
  resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.activeAlerts.delete(alertId);
      logger.logSystem(LogLevel.INFO, `Alert resolved: ${alert.title}`, {
        component: "alert-manager",
        event: "alert_resolved",
        details: {
          alertId,
          duration: (alert.resolvedAt - alert.timestamp) / 1e3 / 60
          // minutes
        }
      });
      return true;
    }
    return false;
  }
  // Get current active alerts
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }
  // Get alert history
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }
  // Get alert statistics
  getAlertStats() {
    const stats = {
      active: this.activeAlerts.size,
      total: this.alertHistory.length,
      byType: {},
      bySeverity: {}
    };
    for (const type of Object.values(AlertType)) {
      stats.byType[type] = 0;
    }
    for (const severity of Object.values(AlertSeverity)) {
      stats.bySeverity[severity] = 0;
    }
    for (const alert of this.alertHistory) {
      stats.byType[alert.type]++;
      stats.bySeverity[alert.severity]++;
    }
    return stats;
  }
}
const alertManager = AlertManager.getInstance();
{
  setInterval(() => {
    alertManager.evaluateRules();
  }, 2 * 60 * 1e3);
}
const GET = async (event) => {
  const { url, locals } = event;
  const rateLimitResponse = await rateLimitAdmin(event);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  if (!locals.user || locals.user.role !== "ADMIN") {
    return json({
      error: "Forbidden: Admin access required",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, { status: 403 });
  }
  try {
    const action = url.searchParams.get("action") || "active";
    const limit = parseInt(url.searchParams.get("limit") || "100");
    let response;
    switch (action) {
      case "active":
        response = {
          alerts: alertManager.getActiveAlerts(),
          count: alertManager.getActiveAlerts().length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        break;
      case "history":
        response = {
          alerts: alertManager.getAlertHistory(limit),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        break;
      case "stats":
        response = {
          stats: alertManager.getAlertStats(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        break;
      default:
        return json({
          error: "Invalid action. Use: active, history, or stats",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }, { status: 400 });
    }
    logger.logSystem(LogLevel.DEBUG, `Alerts API accessed: ${action}`, {
      component: "alerts-api",
      event: "alerts_accessed",
      details: {
        userId: locals.user.id,
        action,
        resultCount: Array.isArray(response.alerts) ? response.alerts.length : 0
      }
    });
    return json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Alerts API error", {
      component: "alerts-api",
      event: "api_error",
      error: error instanceof Error ? error : void 0,
      details: {
        userId: locals.user?.id
      }
    });
    return json({
      error: "Failed to retrieve alerts",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
const POST = async (event) => {
  const { request, locals } = event;
  const rateLimitResponse = await rateLimitAdmin(event);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  if (!locals.user || locals.user.role !== "ADMIN") {
    return json({
      error: "Forbidden: Admin access required",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { action, alertId } = body;
    if (action === "resolve" && alertId) {
      const resolved = alertManager.resolveAlert(alertId);
      if (resolved) {
        logger.logSystem(LogLevel.INFO, `Alert resolved via API: ${alertId}`, {
          component: "alerts-api",
          event: "alert_resolved",
          details: {
            userId: locals.user.id,
            alertId
          }
        });
        return json({
          success: true,
          message: "Alert resolved successfully",
          alertId,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        return json({
          error: "Alert not found or already resolved",
          alertId,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }, { status: 404 });
      }
    }
    return json({
      error: "Invalid action or missing parameters",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, { status: 400 });
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Alerts API POST error", {
      component: "alerts-api",
      event: "api_post_error",
      error: error instanceof Error ? error : void 0,
      details: {
        userId: locals.user?.id
      }
    });
    return json({
      error: "Failed to process alert action",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-GRklaHMV.js.map
