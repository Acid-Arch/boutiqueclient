import { logger, LogLevel } from './logging/logger.js';
import { metrics } from './metrics.js';
import { dev } from '$app/environment';

// Alert types and severity levels
export enum AlertSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum AlertType {
	SYSTEM = 'system',
	PERFORMANCE = 'performance',
	SECURITY = 'security',
	BUSINESS = 'business',
	DATABASE = 'database',
	EXTERNAL = 'external'
}

export interface Alert {
	id: string;
	type: AlertType;
	severity: AlertSeverity;
	title: string;
	message: string;
	timestamp: number;
	resolved: boolean;
	resolvedAt?: number;
	metadata: Record<string, any>;
	notificationsSent: string[];
}

export interface AlertRule {
	id: string;
	name: string;
	type: AlertType;
	severity: AlertSeverity;
	condition: AlertCondition;
	enabled: boolean;
	cooldown: number; // Minutes between alerts
	actions: AlertAction[];
}

export interface AlertCondition {
	metric: string;
	operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
	threshold: number;
	duration: number; // Minutes the condition must be true
	evaluationWindow: number; // Minutes to look back
}

export interface AlertAction {
	type: 'log' | 'email' | 'webhook' | 'slack';
	config: Record<string, any>;
}

class AlertManager {
	private static instance: AlertManager;
	private activeAlerts = new Map<string, Alert>();
	private alertRules = new Map<string, AlertRule>();
	private alertHistory: Alert[] = [];
	private lastEvaluationTimes = new Map<string, number>();

	static getInstance(): AlertManager {
		if (!AlertManager.instance) {
			AlertManager.instance = new AlertManager();
			AlertManager.instance.setupDefaultRules();
		}
		return AlertManager.instance;
	}

	private setupDefaultRules(): void {
		// High response time alert
		this.addRule({
			id: 'high_response_time',
			name: 'High Response Time',
			type: AlertType.PERFORMANCE,
			severity: AlertSeverity.MEDIUM,
			condition: {
				metric: 'http_request_duration_ms',
				operator: 'gt',
				threshold: 2000, // 2 seconds
				duration: 5, // 5 minutes
				evaluationWindow: 10 // 10 minutes
			},
			enabled: true,
			cooldown: 15,
			actions: [
				{ type: 'log', config: {} },
				// { type: 'email', config: { to: 'ops@company.com' } }
			]
		});

		// High error rate alert
		this.addRule({
			id: 'high_error_rate',
			name: 'High Error Rate',
			type: AlertType.SYSTEM,
			severity: AlertSeverity.HIGH,
			condition: {
				metric: 'errors_total',
				operator: 'gt',
				threshold: 10, // 10 errors
				duration: 5, // 5 minutes
				evaluationWindow: 10 // 10 minutes
			},
			enabled: true,
			cooldown: 10,
			actions: [
				{ type: 'log', config: {} }
			]
		});

		// High memory usage alert
		this.addRule({
			id: 'high_memory_usage',
			name: 'High Memory Usage',
			type: AlertType.SYSTEM,
			severity: AlertSeverity.MEDIUM,
			condition: {
				metric: 'memory_heap_used_bytes',
				operator: 'gt',
				threshold: 1024 * 1024 * 1024, // 1GB
				duration: 10, // 10 minutes
				evaluationWindow: 15 // 15 minutes
			},
			enabled: true,
			cooldown: 30,
			actions: [
				{ type: 'log', config: {} }
			]
		});

		// Database connection issues
		this.addRule({
			id: 'database_connection_issues',
			name: 'Database Connection Issues',
			type: AlertType.DATABASE,
			severity: AlertSeverity.CRITICAL,
			condition: {
				metric: 'db_connection_errors',
				operator: 'gt',
				threshold: 3, // 3 connection errors
				duration: 2, // 2 minutes
				evaluationWindow: 5 // 5 minutes
			},
			enabled: true,
			cooldown: 5,
			actions: [
				{ type: 'log', config: {} }
			]
		});
	}

	addRule(rule: AlertRule): void {
		this.alertRules.set(rule.id, rule);
		
		logger.logSystem(LogLevel.INFO, `Alert rule added: ${rule.name}`, {
			component: 'alert-manager',
			event: 'rule_added',
			details: {
				ruleId: rule.id,
				type: rule.type,
				severity: rule.severity
			}
		});
	}

	removeRule(ruleId: string): void {
		if (this.alertRules.delete(ruleId)) {
			logger.logSystem(LogLevel.INFO, `Alert rule removed: ${ruleId}`, {
				component: 'alert-manager',
				event: 'rule_removed',
				details: { ruleId }
			});
		}
	}

	// Evaluate all rules and trigger alerts if necessary
	evaluateRules(): void {
		const now = Date.now();
		
		for (const [ruleId, rule] of this.alertRules.entries()) {
			if (!rule.enabled) continue;
			
			// Check cooldown
			const lastEvaluation = this.lastEvaluationTimes.get(ruleId) || 0;
			if (now - lastEvaluation < rule.cooldown * 60 * 1000) {
				continue;
			}
			
			try {
				if (this.evaluateRule(rule)) {
					this.triggerAlert(rule);
					this.lastEvaluationTimes.set(ruleId, now);
				}
			} catch (error) {
				logger.logSystem(LogLevel.ERROR, `Failed to evaluate alert rule: ${rule.name}`, {
					component: 'alert-manager',
					event: 'rule_evaluation_failed',
					error: error instanceof Error ? error : undefined,
					details: { ruleId, ruleName: rule.name }
				});
			}
		}
	}

	private evaluateRule(rule: AlertRule): boolean {
		const metricsData = metrics.getMetrics(Date.now() - rule.condition.evaluationWindow * 60 * 1000);
		const metricData = metricsData.metrics[rule.condition.metric];
		
		if (!metricData) return false;
		
		// Get the value to compare
		let value: number;
		switch (metricData.type) {
			case 'counter':
				value = (metricData as any).total || 0;
				break;
			case 'gauge':
				value = (metricData as any).current || 0;
				break;
			case 'timer':
			case 'histogram':
				value = (metricData as any).avg || 0; // Use average for timers
				break;
			default:
				return false;
		}
		
		// Evaluate condition
		return this.compareValues(value, rule.condition.operator, rule.condition.threshold);
	}

	private compareValues(value: number, operator: AlertCondition['operator'], threshold: number): boolean {
		switch (operator) {
			case 'gt': return value > threshold;
			case 'gte': return value >= threshold;
			case 'lt': return value < threshold;
			case 'lte': return value <= threshold;
			case 'eq': return value === threshold;
			case 'neq': return value !== threshold;
			default: return false;
		}
	}

	private triggerAlert(rule: AlertRule): void {
		const alertId = `${rule.id}_${Date.now()}`;
		const alert: Alert = {
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

		// Keep only last 1000 alerts in history
		if (this.alertHistory.length > 1000) {
			this.alertHistory.splice(0, this.alertHistory.length - 1000);
		}

		// Execute actions
		for (const action of rule.actions) {
			this.executeAction(alert, action);
		}

		// Log the alert
		logger.logSystem(LogLevel.WARN, `Alert triggered: ${rule.name}`, {
			component: 'alert-manager',
			event: 'alert_triggered',
			details: {
				alertId,
				type: alert.type,
				severity: alert.severity,
				rule: rule.name
			}
		});
	}

	private executeAction(alert: Alert, action: AlertAction): void {
		try {
			switch (action.type) {
				case 'log':
					logger.logSystem(LogLevel.ERROR, `ALERT: ${alert.title}`, {
						component: 'alert-manager',
						event: 'alert_notification',
						details: {
							alertId: alert.id,
							type: alert.type,
							severity: alert.severity,
							message: alert.message,
							metadata: alert.metadata
						}
					});
					break;
				
				case 'email':
					// TODO: Implement email notifications
					console.log(`EMAIL ALERT: ${alert.title} - ${alert.message}`);
					break;
				
				case 'webhook':
					// TODO: Implement webhook notifications
					console.log(`WEBHOOK ALERT: ${alert.title} - ${alert.message}`);
					break;
				
				case 'slack':
					// TODO: Implement Slack notifications
					console.log(`SLACK ALERT: ${alert.title} - ${alert.message}`);
					break;
			}
			
			alert.notificationsSent.push(action.type);
			
		} catch (error) {
			logger.logSystem(LogLevel.ERROR, `Failed to execute alert action: ${action.type}`, {
				component: 'alert-manager',
				event: 'action_execution_failed',
				error: error instanceof Error ? error : undefined,
				details: {
					alertId: alert.id,
					actionType: action.type
				}
			});
		}
	}

	// Resolve an alert
	resolveAlert(alertId: string): boolean {
		const alert = this.activeAlerts.get(alertId);
		if (alert && !alert.resolved) {
			alert.resolved = true;
			alert.resolvedAt = Date.now();
			this.activeAlerts.delete(alertId);
			
			logger.logSystem(LogLevel.INFO, `Alert resolved: ${alert.title}`, {
				component: 'alert-manager',
				event: 'alert_resolved',
				details: {
					alertId,
					duration: (alert.resolvedAt - alert.timestamp) / 1000 / 60 // minutes
				}
			});
			
			return true;
		}
		return false;
	}

	// Get current active alerts
	getActiveAlerts(): Alert[] {
		return Array.from(this.activeAlerts.values());
	}

	// Get alert history
	getAlertHistory(limit: number = 100): Alert[] {
		return this.alertHistory.slice(-limit);
	}

	// Get alert statistics
	getAlertStats(): {
		active: number;
		total: number;
		byType: Record<AlertType, number>;
		bySeverity: Record<AlertSeverity, number>;
	} {
		const stats = {
			active: this.activeAlerts.size,
			total: this.alertHistory.length,
			byType: {} as Record<AlertType, number>,
			bySeverity: {} as Record<AlertSeverity, number>
		};

		// Initialize counters
		for (const type of Object.values(AlertType)) {
			stats.byType[type] = 0;
		}
		for (const severity of Object.values(AlertSeverity)) {
			stats.bySeverity[severity] = 0;
		}

		// Count alerts
		for (const alert of this.alertHistory) {
			stats.byType[alert.type]++;
			stats.bySeverity[alert.severity]++;
		}

		return stats;
	}
}

// Export singleton instance
export const alertManager = AlertManager.getInstance();

// Start periodic rule evaluation (every 2 minutes in production)
if (!dev) {
	setInterval(() => {
		alertManager.evaluateRules();
	}, 2 * 60 * 1000); // 2 minutes
}

// Export convenience functions
export const triggerCustomAlert = (
	type: AlertType,
	severity: AlertSeverity,
	title: string,
	message: string,
	metadata: Record<string, any> = {}
) => {
	const alertId = `custom_${Date.now()}`;
	const alert: Alert = {
		id: alertId,
		type,
		severity,
		title,
		message,
		timestamp: Date.now(),
		resolved: false,
		metadata,
		notificationsSent: []
	};

	alertManager['activeAlerts'].set(alertId, alert);
	alertManager['alertHistory'].push(alert);

	logger.logSystem(LogLevel.WARN, `Custom alert triggered: ${title}`, {
		component: 'alert-manager',
		event: 'custom_alert_triggered',
		details: {
			alertId,
			type,
			severity,
			message,
			metadata
		}
	});
};