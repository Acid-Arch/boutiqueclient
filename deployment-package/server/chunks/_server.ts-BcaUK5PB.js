import { j as json } from './index-Djsj11qr.js';

const GET = async ({ url }) => {
  try {
    const { getAccountStats } = await import('./db-loader-D8HPWY1t.js');
    const stats = await getAccountStats();
    const generateTrendData = (current) => {
      const variance = 0.05 + Math.random() * 0.1;
      const direction = Math.random() > 0.6 ? 1 : -1;
      return Math.max(0, Math.round(current * (1 + direction * variance)));
    };
    const availableCount = stats.byStatus["Unused"] || 0;
    const issueCount = (stats.byStatus["Login Error"] || 0) + (stats.byStatus["Password Error"] || 0) + (stats.byStatus["Critical Error"] || 0);
    const inProgressCount = stats.byStatus["Login In Progress"] || 0;
    const trendData = {
      total: {
        current: stats.total,
        previous: generateTrendData(stats.total)
      },
      available: {
        current: availableCount,
        previous: generateTrendData(availableCount)
      },
      issues: {
        current: issueCount,
        previous: generateTrendData(issueCount)
      },
      inProgress: {
        current: inProgressCount,
        previous: generateTrendData(inProgressCount)
      }
    };
    const responseData = {
      stats,
      trendData,
      metadata: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        version: "1.0.0",
        cached: false
        // Could be used for caching optimization later
      }
    };
    const headers = new Headers({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    return json({
      success: true,
      data: responseData
    }, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return json({
      success: false,
      error: "Failed to retrieve dashboard data",
      details: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 500,
      headers: {
        "Cache-Control": "no-cache"
      }
    });
  }
};

export { GET };
//# sourceMappingURL=_server.ts-BcaUK5PB.js.map
