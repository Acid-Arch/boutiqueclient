import { query } from './db-loader-D8HPWY1t.js';

async function getSessions(filter = {}) {
  try {
    const {
      status = "all",
      limit = 20,
      page = 1
    } = filter;
    let sessionQuery = `
			SELECT 
				id,
				session_type,
				status,
				total_accounts,
				completed_accounts,
				failed_accounts,
				skipped_accounts,
				progress,
				start_time,
				end_time,
				estimated_completion,
				total_request_units,
				estimated_cost,
				error_count,
				last_error,
				triggered_by,
				trigger_source,
				created_at,
				updated_at
			FROM scraping_sessions
		`;
    const queryParams = [];
    let paramCount = 0;
    if (status === "active") {
      sessionQuery += ` WHERE status IN ('INITIALIZING', 'RUNNING', 'PAUSED')`;
    } else if (status !== "all") {
      const statusList = status.split(",").map((s) => s.trim().toUpperCase());
      const placeholders = statusList.map((_, index) => `$${index + 1}`).join(", ");
      sessionQuery += ` WHERE status IN (${placeholders})`;
      queryParams.push(...statusList);
      paramCount = statusList.length;
    }
    sessionQuery += ` ORDER BY created_at DESC`;
    const offset = (page - 1) * limit;
    sessionQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);
    const result = await query(sessionQuery, queryParams);
    const sessions = (result?.rows || []).map(transformSessionData);
    let countQuery = `SELECT COUNT(*) as count FROM scraping_sessions`;
    let countParams = [];
    if (status === "active") {
      countQuery += ` WHERE status IN ('INITIALIZING', 'RUNNING', 'PAUSED')`;
    } else if (status !== "all") {
      const statusList = status.split(",").map((s) => s.trim().toUpperCase());
      const placeholders = statusList.map((_, index) => `$${index + 1}`).join(", ");
      countQuery += ` WHERE status IN (${placeholders})`;
      countParams = statusList;
    }
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult?.rows?.[0]?.count || "0");
    return {
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Error fetching sessions:", error);
    throw new Error(`Failed to fetch sessions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function getSessionById(sessionId) {
  try {
    const sessionQuery = `
			SELECT 
				id,
				session_type,
				status,
				total_accounts,
				completed_accounts,
				failed_accounts,
				skipped_accounts,
				progress,
				start_time,
				end_time,
				estimated_completion,
				total_request_units,
				estimated_cost,
				error_count,
				last_error,
				triggered_by,
				trigger_source,
				created_at,
				updated_at
			FROM scraping_sessions
			WHERE id = $1
		`;
    const result = await query(sessionQuery, [sessionId]);
    if (result?.rows && result.rows.length > 0) {
      return transformSessionData(result.rows[0]);
    }
    return null;
  } catch (error) {
    console.error("Error fetching session by ID:", error);
    throw new Error(`Failed to fetch session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
function transformSessionData(row) {
  return {
    id: row.id,
    sessionType: row.session_type || "UNKNOWN",
    status: row.status || "PENDING",
    totalAccounts: row.total_accounts || 0,
    completedAccounts: row.completed_accounts || 0,
    failedAccounts: row.failed_accounts || 0,
    skippedAccounts: row.skipped_accounts || 0,
    progress: row.progress || 0,
    startTime: row.start_time ? new Date(row.start_time) : null,
    endTime: row.end_time ? new Date(row.end_time) : null,
    estimatedCompletion: row.estimated_completion ? new Date(row.estimated_completion) : null,
    totalRequestUnits: row.total_request_units || 0,
    estimatedCost: parseFloat(row.estimated_cost || "0"),
    errorCount: row.error_count || 0,
    lastError: row.last_error,
    triggeredBy: row.triggered_by,
    triggerSource: row.trigger_source || "MANUAL",
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}
async function updateSessionStatus(sessionId, status, additionalData = {}) {
  try {
    const updates = ["status = $2"];
    const params = [sessionId, status];
    let paramCount = 2;
    for (const [key, value] of Object.entries(additionalData)) {
      updates.push(`${key} = $${++paramCount}`);
      params.push(value);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    const updateQuery = `
			UPDATE scraping_sessions 
			SET ${updates.join(", ")}
			WHERE id = $1
		`;
    await query(updateQuery, params);
  } catch (error) {
    console.error("Error updating session status:", error);
    throw new Error(`Failed to update session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function getSessionStats() {
  try {
    const statsQuery = `
			SELECT 
				COUNT(*) as total_sessions,
				COUNT(CASE WHEN status IN ('INITIALIZING', 'RUNNING', 'PAUSED') THEN 1 END) as active_sessions,
				COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_sessions,
				COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_sessions
			FROM scraping_sessions
		`;
    const result = await query(statsQuery);
    const stats = result?.rows?.[0];
    return {
      totalSessions: parseInt(stats?.total_sessions || "0"),
      activeSessions: parseInt(stats?.active_sessions || "0"),
      completedSessions: parseInt(stats?.completed_sessions || "0"),
      failedSessions: parseInt(stats?.failed_sessions || "0")
    };
  } catch (error) {
    console.error("Error fetching session stats:", error);
    return {
      totalSessions: 0,
      activeSessions: 0,
      completedSessions: 0,
      failedSessions: 0
    };
  }
}
async function createBulkSession(sessionType, targetAccounts, options = {}) {
  try {
    const sessionId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    const {
      priority = "NORMAL",
      batchSize = 5,
      costLimit = 1,
      scheduledFor = null,
      triggeredBy = "SYSTEM",
      triggerSource = "MANUAL"
    } = options;
    const unitsPerAccount = sessionType === "DETAILED_ANALYSIS" ? 5 : 2;
    const estimatedUnits = targetAccounts.length * unitsPerAccount;
    const estimatedCost = estimatedUnits * 1e-3;
    if (estimatedCost > costLimit) {
      throw new Error(`Estimated cost ($${estimatedCost}) exceeds limit ($${costLimit})`);
    }
    const createQuery = `
			INSERT INTO scraping_sessions (
				id, session_type, status, total_accounts, completed_accounts,
				failed_accounts, skipped_accounts, progress, start_time,
				estimated_completion, total_request_units, estimated_cost,
				error_count, triggered_by, trigger_source, target_usernames, scraping_config
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
			)
		`;
    const params = [
      sessionId,
      sessionType,
      scheduledFor ? "SCHEDULED" : "INITIALIZING",
      targetAccounts.length,
      0,
      // completed_accounts
      0,
      // failed_accounts
      0,
      // skipped_accounts
      0,
      // progress
      scheduledFor || /* @__PURE__ */ new Date(),
      null,
      // estimated_completion (calculated when started)
      estimatedUnits,
      estimatedCost,
      0,
      // error_count
      triggeredBy,
      triggerSource,
      JSON.stringify(targetAccounts),
      // target_usernames
      JSON.stringify({
        // scraping_config
        batchSize,
        priority,
        costLimit,
        unitsPerAccount
      })
    ];
    await query(createQuery, params);
    return sessionId;
  } catch (error) {
    console.error("Error creating bulk session:", error);
    throw new Error(`Failed to create bulk session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function startSession(sessionId) {
  try {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (!["INITIALIZING", "SCHEDULED", "PAUSED"].includes(session.status)) {
      throw new Error(`Cannot start session in status: ${session.status}`);
    }
    const rateLimit = parseInt(process.env.HIKER_RATE_LIMIT_PER_SECOND || "11");
    const estimatedDuration = Math.ceil(session.totalAccounts / rateLimit) * 1e3;
    const estimatedCompletion = new Date(Date.now() + estimatedDuration);
    await updateSessionStatus(sessionId, "RUNNING", {
      start_time: /* @__PURE__ */ new Date(),
      estimated_completion: estimatedCompletion
    });
  } catch (error) {
    console.error("Error starting session:", error);
    throw new Error(`Failed to start session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function pauseSession(sessionId) {
  try {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status !== "RUNNING") {
      throw new Error(`Cannot pause session in status: ${session.status}`);
    }
    await updateSessionStatus(sessionId, "PAUSED");
  } catch (error) {
    console.error("Error pausing session:", error);
    throw new Error(`Failed to pause session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function cancelSession(sessionId, reason) {
  try {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status === "COMPLETED") {
      throw new Error("Cannot cancel a completed session");
    }
    const updateData = {
      end_time: /* @__PURE__ */ new Date()
    };
    if (reason) {
      updateData.last_error = reason;
    }
    await updateSessionStatus(sessionId, "CANCELLED", updateData);
  } catch (error) {
    console.error("Error cancelling session:", error);
    throw new Error(`Failed to cancel session: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function updateSessionProgress(sessionId, progress) {
  try {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const updatedData = {};
    if (progress.completedAccounts !== void 0) {
      updatedData.completed_accounts = progress.completedAccounts;
    }
    if (progress.failedAccounts !== void 0) {
      updatedData.failed_accounts = progress.failedAccounts;
    }
    if (progress.skippedAccounts !== void 0) {
      updatedData.skipped_accounts = progress.skippedAccounts;
    }
    if (progress.requestUnits !== void 0) {
      updatedData.total_request_units = progress.requestUnits;
    }
    if (progress.actualCost !== void 0) {
      updatedData.estimated_cost = progress.actualCost;
    }
    const totalProcessed = (progress.completedAccounts || session.completedAccounts) + (progress.failedAccounts || session.failedAccounts) + (progress.skippedAccounts || session.skippedAccounts);
    const progressPercentage = Math.round(totalProcessed / session.totalAccounts * 100);
    updatedData.progress = Math.min(progressPercentage, 100);
    if (totalProcessed >= session.totalAccounts) {
      updatedData.status = "COMPLETED";
      updatedData.end_time = /* @__PURE__ */ new Date();
    }
    await query(
      `UPDATE scraping_sessions 
			 SET ${Object.keys(updatedData).map((key, index) => `${key} = $${index + 2}`).join(", ")}, 
			     updated_at = CURRENT_TIMESTAMP 
			 WHERE id = $1`,
      [sessionId, ...Object.values(updatedData)]
    );
  } catch (error) {
    console.error("Error updating session progress:", error);
    throw new Error(`Failed to update session progress: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function getActiveProcessingSessions(limit = 10) {
  try {
    const sessionsQuery = `
			SELECT 
				id, session_type, status, total_accounts, completed_accounts,
				failed_accounts, skipped_accounts, progress, start_time,
				end_time, estimated_completion, total_request_units,
				estimated_cost, error_count, last_error, triggered_by,
				trigger_source, created_at, updated_at
			FROM scraping_sessions
			WHERE status IN ('RUNNING', 'INITIALIZING')
			ORDER BY 
				CASE WHEN status = 'RUNNING' THEN 1 ELSE 2 END,
				created_at ASC
			LIMIT $1
		`;
    const result = await query(sessionsQuery, [limit]);
    return (result?.rows || []).map(transformSessionData);
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    throw new Error(`Failed to fetch active sessions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export { createBulkSession as a, getActiveProcessingSessions as b, cancelSession as c, getSessionStats as d, getSessions as e, getSessionById as g, pauseSession as p, startSession as s, updateSessionProgress as u };
//# sourceMappingURL=session-manager-6fwnccII.js.map
