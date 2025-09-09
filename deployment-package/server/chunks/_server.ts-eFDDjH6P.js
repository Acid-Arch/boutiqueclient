import { e as error, j as json } from './index-Djsj11qr.js';
import { query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const POST = async ({ params, request, locals }) => {
  try {
    const sessionId = params.sessionId;
    if (!sessionId) {
      throw error(400, "Session ID is required");
    }
    const { action } = await request.json();
    if (!action) {
      throw error(400, "Action is required");
    }
    const validActions = ["START", "PAUSE", "RESUME", "STOP", "RETRY"];
    if (!validActions.includes(action)) {
      throw error(400, "Invalid action");
    }
    const currentSession = await getSessionById(sessionId);
    if (!currentSession) {
      throw error(404, "Session not found");
    }
    const canPerformAction = validateActionForStatus(currentSession.status, action);
    if (!canPerformAction) {
      throw error(400, `Cannot ${action} session in ${currentSession.status} status`);
    }
    const updatedSession = await performSessionAction(sessionId, action, currentSession);
    return json({
      success: true,
      sessionId,
      action,
      previousStatus: currentSession.status,
      newStatus: updatedSession.status,
      message: `Session ${action.toLowerCase()}ed successfully`
    });
  } catch (err) {
    console.error("Session control error:", err);
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    return json(
      { error: "Failed to control session" },
      { status: 500 }
    );
  }
};
async function getSessionById(sessionId) {
  try {
    const sessionQuery = `
			SELECT 
				id, status, session_type, total_accounts,
				completed_accounts, failed_accounts
			FROM scraping_sessions
			WHERE id = $1
		`;
    const result = await query(sessionQuery, [sessionId]);
    if (result?.rows && result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error2) {
    console.error("Error fetching session:", error2);
    return null;
  }
}
function validateActionForStatus(currentStatus, action) {
  const validTransitions = {
    "PENDING": ["START"],
    "IDLE": ["START"],
    "INITIALIZING": ["STOP"],
    "RUNNING": ["PAUSE", "STOP"],
    "PAUSED": ["RESUME", "STOP"],
    "COMPLETED": [],
    "FAILED": ["RETRY", "START"],
    "CANCELLED": ["RETRY", "START"],
    "RATE_LIMITED": ["RETRY", "START"]
  };
  return validTransitions[currentStatus]?.includes(action) || false;
}
async function performSessionAction(sessionId, action, currentSession) {
  const now = /* @__PURE__ */ new Date();
  let newStatus;
  let updateFields = {
    updated_at: now
  };
  switch (action) {
    case "START":
      newStatus = "INITIALIZING";
      updateFields.status = newStatus;
      updateFields.start_time = now;
      updateFields.progress = 0;
      break;
    case "PAUSE":
      newStatus = "PAUSED";
      updateFields.status = newStatus;
      break;
    case "RESUME":
      newStatus = "RUNNING";
      updateFields.status = newStatus;
      break;
    case "STOP":
      newStatus = "CANCELLED";
      updateFields.status = newStatus;
      updateFields.end_time = now;
      break;
    case "RETRY":
      newStatus = "PENDING";
      updateFields.status = newStatus;
      updateFields.start_time = null;
      updateFields.end_time = null;
      updateFields.error_count = 0;
      updateFields.last_error = null;
      updateFields.progress = 0;
      break;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
  const setClause = Object.keys(updateFields).map((field, index) => `${field} = $${index + 2}`).join(", ");
  const updateQuery = `
		UPDATE scraping_sessions 
		SET ${setClause}
		WHERE id = $1
		RETURNING status, updated_at
	`;
  const queryParams = [sessionId, ...Object.values(updateFields)];
  try {
    const result = await query(updateQuery, queryParams);
    if (result?.rows && result.rows.length > 0) {
      await logSessionControl(sessionId, action, currentSession.status, newStatus);
      return {
        status: result.rows[0].status,
        updatedAt: result.rows[0].updated_at
      };
    }
    throw new Error("Failed to update session");
  } catch (error2) {
    console.error("Error updating session:", error2);
    throw error2;
  }
}
async function logSessionControl(sessionId, action, fromStatus, toStatus) {
  try {
    const logQuery = `
			INSERT INTO scraping_logs (
				id, session_id, timestamp, level, message, source, details, created_at
			) VALUES (
				gen_random_uuid(), $1, $2, $3, $4, $5, $6, $2
			)
		`;
    const message = `Session control: ${action} (${fromStatus} → ${toStatus})`;
    const details = JSON.stringify({
      action,
      fromStatus,
      toStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    await query(logQuery, [
      sessionId,
      /* @__PURE__ */ new Date(),
      "INFO",
      message,
      "SESSION_MANAGER",
      details
    ]);
  } catch (error2) {
    console.error("Error logging session control:", error2);
  }
}

export { POST };
//# sourceMappingURL=_server.ts-eFDDjH6P.js.map
