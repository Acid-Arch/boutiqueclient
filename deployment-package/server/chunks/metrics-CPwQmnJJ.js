import { l as logger, L as LogLevel } from './logger-RU41djIi.js';

class MetricsCollector {
  static instance;
  metrics = /* @__PURE__ */ new Map();
  timers = /* @__PURE__ */ new Map();
  counters = /* @__PURE__ */ new Map();
  gauges = /* @__PURE__ */ new Map();
  static getInstance() {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }
  // Record a timer metric (for response times, etc.)
  startTimer(name) {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timers.set(timerId, Date.now());
    return timerId;
  }
  endTimer(timerId, labels = {}) {
    const startTime = this.timers.get(timerId);
    if (!startTime) return null;
    const duration = Date.now() - startTime;
    this.timers.delete(timerId);
    const metricName = timerId.split("_")[0];
    this.recordMetric(metricName, duration, "timer", labels);
    return duration;
  }
  // Record a simple timer (start and end in one call)
  recordTimer(name, duration, labels = {}) {
    this.recordMetric(name, duration, "timer", labels);
  }
  // Increment a counter
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.getMetricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    this.recordMetric(name, this.counters.get(key), "counter", labels);
  }
  // Set a gauge value
  setGauge(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    this.recordMetric(name, value, "gauge", labels);
  }
  // Record histogram metric
  recordHistogram(name, value, labels = {}) {
    this.recordMetric(name, value, "histogram", labels);
  }
  recordMetric(name, value, type, labels = {}) {
    const metric = {
      name,
      value,
      type,
      timestamp: Date.now(),
      labels
    };
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metricsList = this.metrics.get(name);
    metricsList.push(metric);
    if (metricsList.length > 1e3) {
      metricsList.splice(0, metricsList.length - 1e3);
    }
    if (this.shouldLogMetric(name, value, type)) {
      logger.logPerformance(LogLevel.DEBUG, `Metric recorded: ${name}`, {
        metric: name,
        value,
        unit: this.getMetricUnit(type),
        threshold: this.getThreshold(name, type),
        component: "metrics-collector",
        userId: labels.userId
      });
    }
  }
  getMetricKey(name, labels) {
    const labelStr = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  shouldLogMetric(name, value, type) {
    if (name.includes("response_time") && value > 1e3) return true;
    if (name.includes("error") && type === "counter") return true;
    if (name.includes("memory") && type === "gauge") return true;
    return false;
  }
  getMetricUnit(type) {
    switch (type) {
      case "timer":
        return "ms";
      case "counter":
        return "count";
      case "gauge":
        return "value";
      case "histogram":
        return "distribution";
      default:
        return "unknown";
    }
  }
  getThreshold(name, type) {
    if (type === "timer" && name.includes("response_time")) return 500;
    if (name.includes("memory")) return 1024;
    return void 0;
  }
  // Get current metrics summary
  getMetrics(since) {
    const sinceTime = since || Date.now() - 3e5;
    const summary = {
      timestamp: Date.now(),
      period: { start: sinceTime, end: Date.now() },
      metrics: {}
    };
    for (const [name, values] of this.metrics.entries()) {
      const relevantMetrics = values.filter((m) => m.timestamp >= sinceTime);
      if (relevantMetrics.length === 0) continue;
      const metricType = relevantMetrics[0].type;
      summary.metrics[name] = {
        type: metricType,
        count: relevantMetrics.length,
        ...this.calculateStats(relevantMetrics, metricType)
      };
    }
    return summary;
  }
  calculateStats(metrics2, type) {
    const values = metrics2.map((m) => m.value);
    switch (type) {
      case "timer":
      case "histogram":
        return {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          p50: this.percentile(values, 0.5),
          p95: this.percentile(values, 0.95),
          p99: this.percentile(values, 0.99)
        };
      case "counter":
        return {
          total: values[values.length - 1],
          // Latest value
          rate: values.length / ((metrics2[metrics2.length - 1].timestamp - metrics2[0].timestamp) / 1e3)
        };
      case "gauge":
        return {
          current: values[values.length - 1],
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        };
      default:
        return {};
    }
  }
  percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
  // Clear old metrics to prevent memory leaks
  clearOldMetrics(olderThan = 36e5) {
    const cutoff = Date.now() - olderThan;
    for (const [name, values] of this.metrics.entries()) {
      const filteredValues = values.filter((m) => m.timestamp >= cutoff);
      this.metrics.set(name, filteredValues);
    }
    this.timers.clear();
  }
  // Get system metrics
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    return {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoop: {
        // Would need additional libraries for event loop lag
        // For now, just timestamp
        lag: 0
        // Placeholder
      }
    };
  }
  // Export metrics for external monitoring systems (Prometheus format)
  exportPrometheusMetrics() {
    const metrics2 = this.getMetrics();
    let output = "";
    for (const [name, data] of Object.entries(metrics2.metrics)) {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, "_");
      switch (data.type) {
        case "counter":
          output += `# TYPE ${sanitizedName} counter
`;
          output += `${sanitizedName} ${data.total || 0}
`;
          break;
        case "gauge":
          output += `# TYPE ${sanitizedName} gauge
`;
          output += `${sanitizedName} ${data.current || 0}
`;
          break;
        case "timer":
        case "histogram":
          output += `# TYPE ${sanitizedName} histogram
`;
          output += `${sanitizedName}_sum ${(data.avg || 0) * data.count}
`;
          output += `${sanitizedName}_count ${data.count}
`;
          if (data.p50) output += `${sanitizedName}{quantile="0.5"} ${data.p50}
`;
          if (data.p95) output += `${sanitizedName}{quantile="0.95"} ${data.p95}
`;
          if (data.p99) output += `${sanitizedName}{quantile="0.99"} ${data.p99}
`;
          break;
      }
      output += "\n";
    }
    return output;
  }
}
const metrics = MetricsCollector.getInstance();
const recordResponseTime = (endpoint, method, statusCode, duration, userId) => {
  metrics.recordTimer("http_request_duration_ms", duration, {
    endpoint,
    method,
    status: statusCode.toString(),
    ...userId && { userId }
  });
};
const incrementErrorCount = (type, endpoint, userId) => {
  metrics.incrementCounter("errors_total", 1, {
    error_type: type,
    ...endpoint && { endpoint },
    ...userId && { userId }
  });
};
const setMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  metrics.setGauge("memory_heap_used_bytes", memUsage.heapUsed);
  metrics.setGauge("memory_heap_total_bytes", memUsage.heapTotal);
  metrics.setGauge("memory_rss_bytes", memUsage.rss);
};
{
  setInterval(() => {
    setMemoryUsage();
    metrics.clearOldMetrics();
  }, 3e4);
}

export { incrementErrorCount as i, metrics as m, recordResponseTime as r };
//# sourceMappingURL=metrics-CPwQmnJJ.js.map
