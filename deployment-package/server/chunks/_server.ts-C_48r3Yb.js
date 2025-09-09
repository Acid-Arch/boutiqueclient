import { e as error, j as json } from './index-Djsj11qr.js';
import { query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const POST = async ({ request, locals }) => {
  try {
    console.log("🚀 Starting bulk scraping operation...");
    const requestData = await request.json();
    console.log("📋 Bulk request data:", JSON.stringify(requestData, null, 2));
    if (!requestData.accountIds || !Array.isArray(requestData.accountIds) || requestData.accountIds.length === 0) {
      throw error(400, "Account IDs are required for bulk operation");
    }
    for (const accountId of requestData.accountIds) {
      if (!Number.isInteger(accountId) || accountId <= 0) {
        throw error(400, `Invalid account ID: ${accountId}`);
      }
    }
    console.log(`✅ Bulk operation validated for ${requestData.accountIds.length} accounts`);
    console.log("🔍 Validating accounts exist...");
    const existingAccounts = await validateAccounts(requestData.accountIds);
    console.log(`📊 Found ${existingAccounts.length} existing accounts`);
    if (existingAccounts.length !== requestData.accountIds.length) {
      const missingIds = requestData.accountIds.filter((id) => !existingAccounts.some((acc) => acc.id === id));
      throw error(400, `Accounts not found: ${missingIds.join(", ")}`);
    }
    const batchSize = requestData.batchSize || 50;
    const totalAccounts = requestData.accountIds.length;
    const batches = Math.ceil(totalAccounts / batchSize);
    console.log(`🔧 Creating ${batches} batches with size ${batchSize} for ${totalAccounts} accounts`);
    const parentSessionId = await createBulkParentSession(requestData, existingAccounts);
    console.log(`✅ Parent session created: ${parentSessionId}`);
    const batchSessionIds = [];
    for (let i = 0; i < batches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalAccounts);
      const batchAccountIds = requestData.accountIds.slice(startIdx, endIdx);
      console.log(`🏗️ Creating batch ${i + 1}/${batches} with ${batchAccountIds.length} accounts`);
      const batchSessionId = await createBatchSession(
        requestData,
        batchAccountIds,
        existingAccounts.filter((acc) => batchAccountIds.includes(acc.id)),
        parentSessionId,
        i + 1
      );
      batchSessionIds.push(batchSessionId);
    }
    console.log(`✅ Created ${batchSessionIds.length} batch sessions`);
    await updateParentSessionWithBatches(parentSessionId, batchSessionIds);
    await logBulkOperation(parentSessionId, "INFO", `Bulk operation created for ${totalAccounts} accounts in ${batches} batches`, {
      accountIds: requestData.accountIds,
      batchCount: batches,
      batchSize,
      priority: requestData.priority,
      sessionType: requestData.sessionType
    });
    return json({
      success: true,
      parentSessionId,
      batchSessionIds,
      message: `Bulk operation created successfully with ${batches} batches`,
      totalAccounts,
      batchCount: batches,
      batchSize,
      sessionType: requestData.sessionType || "ACCOUNT_METRICS"
    });
  } catch (err) {
    console.error("Bulk operation error:", err);
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    return json(
      { error: "Failed to create bulk scraping operation" },
      { status: 500 }
    );
  }
};
async function validateAccounts(accountIds) {
  try {
    const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(", ");
    const validateQuery = `
			SELECT id, instagram_username as username, status
			FROM ig_accounts
			WHERE id IN (${placeholders})
		`;
    const result = await query(validateQuery, accountIds);
    return result?.rows || [];
  } catch (error2) {
    console.error("Error validating accounts:", error2);
    throw new Error("Failed to validate accounts");
  }
}
async function createBulkParentSession(requestData, accounts) {
  try {
    const sessionId = crypto.randomUUID();
    const now = /* @__PURE__ */ new Date();
    const sessionType = requestData.sessionType || "BULK_ACCOUNT_METRICS";
    const totalAccounts = accounts.length;
    const priority = requestData.priority || "NORMAL";
    const estimatedUnitsPerAccount = calculateUnitsPerAccount(requestData.config || {});
    const totalEstimatedUnits = estimatedUnitsPerAccount * totalAccounts;
    const estimatedCost = totalEstimatedUnits * 1e-3;
    const batchSize = requestData.batchSize || 50;
    const batches = Math.ceil(totalAccounts / batchSize);
    const estimatedDuration = batches * 5 * 60 * 1e3;
    const estimatedCompletion = new Date(now.getTime() + estimatedDuration);
    const sessionQuery = `
			INSERT INTO scraping_sessions (
				id,
				session_type,
				status,
				account_ids,
				scraping_config,
				total_accounts,
				completed_accounts,
				failed_accounts,
				skipped_accounts,
				progress,
				estimated_completion,
				total_request_units,
				estimated_cost,
				error_count,
				triggered_by,
				trigger_source,
				tags,
				notes
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
			)
		`;
    const sessionParams = [
      sessionId,
      sessionType,
      "PENDING",
      JSON.stringify(requestData.accountIds),
      JSON.stringify({
        ...requestData.config,
        batchSize: requestData.batchSize,
        priority,
        costLimit: requestData.costLimit
      }),
      totalAccounts,
      0,
      // completed_accounts
      0,
      // failed_accounts
      0,
      // skipped_accounts
      0,
      // progress
      estimatedCompletion,
      0,
      // total_request_units (will be updated as batches complete)
      estimatedCost,
      0,
      // error_count
      "bulk_api",
      "BULK_API",
      JSON.stringify(requestData.tags || ["bulk_operation"]),
      requestData.notes || `Bulk operation for ${totalAccounts} accounts`
    ];
    await query(sessionQuery, sessionParams);
    return sessionId;
  } catch (error2) {
    console.error("Error creating bulk parent session:", error2);
    throw new Error("Failed to create bulk parent session");
  }
}
async function createBatchSession(requestData, batchAccountIds, batchAccounts, parentSessionId, batchNumber) {
  try {
    const sessionId = crypto.randomUUID();
    const now = /* @__PURE__ */ new Date();
    const sessionType = requestData.sessionType || "ACCOUNT_METRICS";
    const totalAccounts = batchAccounts.length;
    const estimatedUnitsPerAccount = calculateUnitsPerAccount(requestData.config || {});
    const totalEstimatedUnits = estimatedUnitsPerAccount * totalAccounts;
    const estimatedCost = totalEstimatedUnits * 1e-3;
    const estimatedDuration = Math.ceil(totalAccounts / 6) * 60 * 1e3;
    const estimatedCompletion = new Date(now.getTime() + estimatedDuration);
    const sessionQuery = `
			INSERT INTO scraping_sessions (
				id,
				session_type,
				status,
				account_ids,
				scraping_config,
				total_accounts,
				completed_accounts,
				failed_accounts,
				skipped_accounts,
				progress,
				estimated_completion,
				total_request_units,
				estimated_cost,
				error_count,
				triggered_by,
				trigger_source,
				tags,
				notes
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
			)
		`;
    const sessionParams = [
      sessionId,
      sessionType,
      "PENDING",
      JSON.stringify(batchAccountIds),
      JSON.stringify({
        ...requestData.config,
        parentSessionId,
        batchNumber,
        priority: requestData.priority
      }),
      totalAccounts,
      0,
      // completed_accounts
      0,
      // failed_accounts
      0,
      // skipped_accounts
      0,
      // progress
      estimatedCompletion,
      0,
      // total_request_units
      estimatedCost,
      0,
      // error_count
      "bulk_api",
      "BULK_BATCH",
      JSON.stringify([...requestData.tags || [], `batch_${batchNumber}`, "bulk_operation"]),
      `Batch ${batchNumber} - ${totalAccounts} accounts`
    ];
    await query(sessionQuery, sessionParams);
    return sessionId;
  } catch (error2) {
    console.error(`Error creating batch session ${batchNumber}:`, error2);
    throw new Error(`Failed to create batch session ${batchNumber}`);
  }
}
async function updateParentSessionWithBatches(parentSessionId, batchSessionIds) {
  try {
    const updateQuery = `
			UPDATE scraping_sessions 
			SET scraping_config = scraping_config || $1
			WHERE id = $2
		`;
    const batchInfo = {
      batchSessionIds,
      batchCount: batchSessionIds.length,
      createdBatches: (/* @__PURE__ */ new Date()).toISOString()
    };
    await query(updateQuery, [JSON.stringify(batchInfo), parentSessionId]);
  } catch (error2) {
    console.error("Error updating parent session with batch info:", error2);
    throw new Error("Failed to update parent session");
  }
}
function calculateUnitsPerAccount(config) {
  let units = 2;
  if (config.includeRecentMedia) {
    units += Math.ceil((config.maxMediaToFetch || 12) / 10);
  }
  if (config.includeFollowers) {
    units += 3;
  }
  if (config.includeStories) {
    units += 1;
  }
  if (config.includeFollowing) {
    units += 2;
  }
  if (config.includeHighlights) {
    units += 1;
  }
  return units;
}
async function logBulkOperation(sessionId, level, message, details = {}) {
  try {
    const logQuery = `
			INSERT INTO scraping_logs (
				id, session_id, level, message, source, details
			) VALUES (
				gen_random_uuid(), $1, $2, $3, $4, $5
			)
		`;
    await query(logQuery, [
      sessionId,
      level,
      message,
      "BULK_MANAGER",
      JSON.stringify(details)
    ]);
  } catch (error2) {
    console.error("Error logging bulk operation:", error2);
  }
}

export { POST };
//# sourceMappingURL=_server.ts-C_48r3Yb.js.map
