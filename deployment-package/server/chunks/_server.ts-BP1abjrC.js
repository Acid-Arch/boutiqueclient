import { j as json } from './index-Djsj11qr.js';

const GET = async () => {
  try {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const uptime = process.uptime();
    return json({
      status: "ok",
      timestamp,
      uptime: Math.floor(uptime)
    }, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return json({
      status: "error",
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

export { GET };
//# sourceMappingURL=_server.ts-BP1abjrC.js.map
