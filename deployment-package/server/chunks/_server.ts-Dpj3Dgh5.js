import { j as json } from './index-Djsj11qr.js';
import { e as enhancedErrorRecovery } from './enhanced-error-recovery-SHA-Fz5J.js';
import './error-recovery-DvvqzRuU.js';

const GET = async ({ url }) => {
  try {
    const timeframe = url.searchParams.get("timeframe") || "30d";
    const validTimeframes = ["7d", "30d", "90d"];
    if (!validTimeframes.includes(timeframe)) {
      return json(
        {
          error: "Invalid timeframe",
          message: "Timeframe must be one of: 7d, 30d, 90d"
        },
        { status: 400 }
      );
    }
    const systemAnalytics = enhancedErrorRecovery.getSystemAnalytics();
    const recentErrors = await getRecentErrors(timeframe);
    const patternEvolution = await getPatternEvolution(timeframe);
    return json({
      success: true,
      timeframe,
      ...systemAnalytics,
      recentErrors,
      patternEvolution,
      metadata: {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        requestId: crypto.randomUUID(),
        version: "1.0"
      }
    });
  } catch (error) {
    console.error("Enhanced error recovery analytics API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        timeframe: url.searchParams.get("timeframe") || "30d"
      },
      { status: 500 }
    );
  }
};
async function getRecentErrors(timeframe) {
  const now = Date.now();
  const timeframeMs = timeframe === "7d" ? 7 * 24 * 60 * 60 * 1e3 : timeframe === "30d" ? 30 * 24 * 60 * 60 * 1e3 : 90 * 24 * 60 * 60 * 1e3;
  const mockErrors = [];
  const errorTypes = ["RATE_LIMIT", "API_ERROR", "NETWORK_ERROR", "AUTHENTICATION_ERROR", "TIMEOUT_ERROR"];
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now - Math.random() * timeframeMs);
    mockErrors.push({
      id: crypto.randomUUID(),
      type: errorTypes[Math.floor(Math.random() * errorTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      message: "Sample error message for analysis",
      timestamp,
      sessionId: `session-${Math.floor(Math.random() * 20)}`,
      accountId: Math.random() > 0.3 ? `acc-${Math.floor(Math.random() * 50)}` : void 0,
      retryable: Math.random() > 0.3
    });
  }
  return mockErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
async function getPatternEvolution(timeframe) {
  return [
    {
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString(),
      patternCount: 12,
      newPatterns: 2,
      resolvedPatterns: 1,
      avgConfidence: 0.75
    },
    {
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3).toISOString(),
      patternCount: 11,
      newPatterns: 1,
      resolvedPatterns: 0,
      avgConfidence: 0.72
    },
    {
      date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1e3).toISOString(),
      patternCount: 10,
      newPatterns: 3,
      resolvedPatterns: 2,
      avgConfidence: 0.68
    },
    {
      date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1e3).toISOString(),
      patternCount: 9,
      newPatterns: 1,
      resolvedPatterns: 1,
      avgConfidence: 0.71
    }
  ];
}

export { GET };
//# sourceMappingURL=_server.ts-Dpj3Dgh5.js.map
