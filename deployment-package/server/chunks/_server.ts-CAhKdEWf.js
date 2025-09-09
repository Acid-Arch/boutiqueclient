import { j as json } from './index-Djsj11qr.js';
import { m as metrics } from './metrics-CPwQmnJJ.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import { r as rateLimitAdmin } from './rate-limiter-comprehensive-DZzPnbd1.js';
import 'winston';
import 'pino';
import 'rate-limiter-flexible';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

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
    const format = url.searchParams.get("format") || "json";
    const since = url.searchParams.get("since");
    const sinceTimestamp = since ? parseInt(since) : void 0;
    switch (format) {
      case "prometheus":
        const prometheusMetrics = metrics.exportPrometheusMetrics();
        logger.logSystem(LogLevel.DEBUG, "Prometheus metrics exported", {
          component: "metrics-endpoint",
          event: "prometheus_export",
          details: {
            userId: locals.user.id,
            metricsSize: prometheusMetrics.length
          }
        });
        return new Response(prometheusMetrics, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate"
          }
        });
      case "json":
      default:
        const metricsData = metrics.getMetrics(sinceTimestamp);
        const systemMetrics = metrics.getSystemMetrics();
        logger.logSystem(LogLevel.DEBUG, "JSON metrics exported", {
          component: "metrics-endpoint",
          event: "json_export",
          details: {
            userId: locals.user.id,
            metricsCount: Object.keys(metricsData.metrics).length,
            period: metricsData.period
          }
        });
        return json({
          application: metricsData,
          system: systemMetrics,
          meta: {
            format: "json",
            version: "1.0",
            exported_at: (/* @__PURE__ */ new Date()).toISOString(),
            exported_by: locals.user.email
          }
        }, {
          status: 200,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate"
          }
        });
    }
  } catch (error) {
    logger.logSystem(LogLevel.ERROR, "Metrics endpoint error", {
      component: "metrics-endpoint",
      event: "export_error",
      error: error instanceof Error ? error : void 0,
      details: {
        userId: locals.user?.id,
        userAgent: event.request.headers.get("user-agent")
      }
    });
    return json({
      error: "Failed to export metrics",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

export { GET };
//# sourceMappingURL=_server.ts-CAhKdEWf.js.map
