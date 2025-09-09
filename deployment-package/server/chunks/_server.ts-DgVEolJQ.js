import { e as error, j as json } from './index-Djsj11qr.js';
import { g as getSessionById } from './session-manager-6fwnccII.js';
import './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ params, locals }) => {
  try {
    const sessionId = params.sessionId;
    if (!sessionId) {
      throw error(400, "Session ID is required");
    }
    const sessionData = await getSessionById(sessionId);
    if (!sessionData) {
      throw error(404, "Session not found");
    }
    return json({
      success: true,
      data: sessionData
    });
  } catch (err) {
    console.error("Session API error:", err);
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    return json(
      {
        success: false,
        error: "Failed to load session",
        details: errorMessage,
        data: null
      },
      { status: 500 }
    );
  }
};

export { GET };
//# sourceMappingURL=_server.ts-DgVEolJQ.js.map
