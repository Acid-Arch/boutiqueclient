import { j as json } from './index-Djsj11qr.js';
import { H as HikerAPIClient } from './hiker-api-client-BwPCqXIk.js';
import { u as updateSessionProgress, c as cancelSession, p as pauseSession, a as createBulkSession, g as getSessionById, s as startSession, b as getActiveProcessingSessions } from './session-manager-6fwnccII.js';
import { v as validateErrorRecoverySystem, w as withErrorHandling } from './error-recovery-DvvqzRuU.js';
import './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

let notifySessionProgress;
let notifySessionComplete;
let notifyCostUpdate;
let notifySessionStateChange;
class BulkScrapingOrchestrator {
  hikerClient;
  sessionManager;
  constructor() {
    this.hikerClient = new HikerAPIClient();
    this.sessionManager = {
      pauseSession,
      cancelSession,
      updateSessionProgress
    };
  }
  /**
   * Create and start a bulk scraping session
   */
  async createSession(config) {
    try {
      this.validateConfig(config);
      const sessionId = await createBulkSession(
        config.sessionType,
        config.targetAccounts,
        {
          priority: config.priority,
          batchSize: config.batchSize,
          costLimit: config.costLimit,
          scheduledFor: config.scheduledFor,
          triggeredBy: config.triggeredBy,
          triggerSource: config.triggerSource
        }
      );
      console.log(`Created bulk scraping session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error("Failed to create bulk scraping session:", error);
      throw error;
    }
  }
  /**
   * Execute a bulk scraping session
   */
  async executeSession(sessionId) {
    const startTime = Date.now();
    let processedAccounts = 0;
    let successfulAccounts = 0;
    let failedAccounts = 0;
    let skippedAccounts = 0;
    let totalRequestUnits = 0;
    let totalCost = 0;
    const errors = [];
    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      await startSession(sessionId);
      console.log(`Started bulk scraping session: ${sessionId}`);
      notifySessionStateChange(sessionId, "PENDING", "IN_PROGRESS", "Session started");
      const targetAccounts = await this.getSessionTargetAccounts(sessionId);
      const batchSize = 5;
      const batches = this.createBatches(targetAccounts, batchSize);
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} accounts)`);
        const batchResults = await this.processBatch(batch, session, batchIndex + 1);
        batchResults.forEach((result2) => {
          processedAccounts++;
          if (result2.success) {
            successfulAccounts++;
            totalRequestUnits += result2.requestUnits || 0;
            totalCost += result2.cost || 0;
          } else if (result2.skipped) {
            skippedAccounts++;
          } else {
            failedAccounts++;
            errors.push({
              accountId: result2.accountId,
              error: result2.error || "Unknown error",
              timestamp: /* @__PURE__ */ new Date()
            });
          }
        });
        await updateSessionProgress(sessionId, {
          completedAccounts: successfulAccounts,
          failedAccounts,
          skippedAccounts,
          requestUnits: totalRequestUnits,
          actualCost: totalCost
        });
        const progress = Math.round(processedAccounts / targetAccounts.length * 100);
        const estimatedTimeRemaining = this.calculateTimeRemaining(
          processedAccounts,
          targetAccounts.length,
          Date.now() - startTime
        );
        notifySessionProgress(sessionId, {
          progress,
          completedAccounts: successfulAccounts,
          failedAccounts,
          skippedAccounts,
          totalAccounts: targetAccounts.length,
          currentAccount: batch[batch.length - 1],
          // Last processed account in batch
          estimatedTimeRemaining,
          requestUnits: totalRequestUnits,
          actualCost: totalCost,
          status: "IN_PROGRESS"
        });
        notifyCostUpdate(sessionId, {
          requestUnits: totalRequestUnits,
          cost: totalCost,
          budgetUsed: totalCost / session.estimatedCost * 100,
          budgetRemaining: Math.max(0, session.estimatedCost - totalCost)
        });
        if (totalCost >= session.estimatedCost * 1.5) {
          console.log(`Cost limit exceeded, stopping session ${sessionId}`);
          break;
        }
        if (batchIndex < batches.length - 1) {
          const delayMs = this.calculateBatchDelay(batchResults);
          if (delayMs > 0) {
            console.log(`Rate limiting: waiting ${delayMs}ms before next batch`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }
      const duration = Date.now() - startTime;
      console.log(`Completed bulk scraping session ${sessionId} in ${duration}ms`);
      const result = {
        sessionId,
        success: true,
        totalAccounts: targetAccounts.length,
        processedAccounts,
        successfulAccounts,
        failedAccounts,
        skippedAccounts,
        totalRequestUnits,
        totalCost,
        duration,
        errors
      };
      notifySessionComplete(sessionId, result);
      return result;
    } catch (error) {
      console.error(`Bulk scraping session ${sessionId} failed:`, error);
      try {
        await cancelSession(sessionId, error instanceof Error ? error.message : "Unknown error");
      } catch (cancelError) {
        console.error(`Failed to cancel session ${sessionId}:`, cancelError);
      }
      return {
        sessionId,
        success: false,
        totalAccounts: 0,
        processedAccounts,
        successfulAccounts,
        failedAccounts,
        skippedAccounts,
        totalRequestUnits,
        totalCost,
        duration: Date.now() - startTime,
        errors: [
          ...errors,
          {
            accountId: "SYSTEM",
            error: error instanceof Error ? error.message : "Unknown system error",
            timestamp: /* @__PURE__ */ new Date()
          }
        ]
      };
    }
  }
  /**
   * Process a batch of accounts with error handling and recovery
   */
  async processBatch(accounts, session, batchNumber) {
    const results = [];
    for (let i = 0; i < accounts.length; i++) {
      const accountId = accounts[i];
      console.log(`Processing account ${i + 1}/${accounts.length}: ${accountId}`);
      const errorContext = {
        sessionId: session.id,
        accountId,
        requestType: session.sessionType,
        attemptNumber: 1,
        totalAttempts: 3,
        consecutiveErrors: 0,
        sessionStartTime: session.startTime || /* @__PURE__ */ new Date()
      };
      const result = await withErrorHandling(
        async () => {
          switch (session.sessionType) {
            case "ACCOUNT_METRICS":
              return await this.hikerClient.getUserProfile(accountId);
            case "DETAILED_ANALYSIS":
              return await this.hikerClient.getUserProfile(accountId, { force: true });
            case "FOLLOWERS_ANALYSIS":
              return await this.hikerClient.getUserProfile(accountId);
            default:
              throw new Error(`Unknown session type: ${session.sessionType}`);
          }
        },
        errorContext,
        this.sessionManager
      );
      if (result.success) {
        results.push({
          accountId,
          success: true,
          skipped: false,
          requestUnits: result.data.requestUnits || 2,
          cost: result.data.metrics?.totalCost || 2e-3
        });
      } else {
        const shouldSkip = result.recovery.strategy === "SKIP";
        results.push({
          accountId,
          success: false,
          skipped: shouldSkip,
          error: result.error.message
        });
        if (["PAUSE_SESSION", "CANCEL_SESSION"].includes(result.recovery.strategy)) {
          console.log(`Batch processing stopped due to: ${result.recovery.reason}`);
          break;
        }
      }
      if (i < accounts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    }
    return results;
  }
  /**
   * Create batches from target accounts
   */
  createBatches(accounts, batchSize) {
    const batches = [];
    for (let i = 0; i < accounts.length; i += batchSize) {
      batches.push(accounts.slice(i, i + batchSize));
    }
    return batches;
  }
  /**
   * Calculate delay between batches based on rate limiting
   */
  calculateBatchDelay(batchResults) {
    const rateLimit = parseInt(process.env.HIKER_RATE_LIMIT_PER_SECOND || "11");
    const successfulRequests = batchResults.filter((r) => r.success).length;
    if (successfulRequests >= rateLimit) {
      return 2e3;
    }
    return 0;
  }
  /**
   * Get target accounts for a session (placeholder - would be stored in session data)
   */
  async getSessionTargetAccounts(sessionId) {
    return ["therock", "instagram", "natgeo", "cristiano", "kyliejenner"];
  }
  /**
   * Validate bulk scraping configuration
   */
  validateConfig(config) {
    if (!config.targetAccounts || config.targetAccounts.length === 0) {
      throw new Error("Target accounts list cannot be empty");
    }
    if (config.batchSize <= 0 || config.batchSize > 50) {
      throw new Error("Batch size must be between 1 and 50");
    }
    if (config.maxConcurrentRequests <= 0 || config.maxConcurrentRequests > 10) {
      throw new Error("Max concurrent requests must be between 1 and 10");
    }
    if (config.costLimit <= 0 || config.costLimit > 100) {
      throw new Error("Cost limit must be between $0.01 and $100.00");
    }
    const validSessionTypes = ["ACCOUNT_METRICS", "DETAILED_ANALYSIS", "FOLLOWERS_ANALYSIS"];
    if (!validSessionTypes.includes(config.sessionType)) {
      throw new Error(`Invalid session type. Must be one of: ${validSessionTypes.join(", ")}`);
    }
  }
  /**
   * Calculate estimated time remaining for session completion
   */
  calculateTimeRemaining(processedAccounts, totalAccounts, elapsedTime) {
    if (processedAccounts === 0) return 0;
    const averageTimePerAccount = elapsedTime / processedAccounts;
    const remainingAccounts = totalAccounts - processedAccounts;
    return Math.round(remainingAccounts * averageTimePerAccount / 1e3);
  }
  /**
   * Get status of all active bulk scraping sessions
   */
  async getActiveSessions() {
    return await getActiveProcessingSessions(10);
  }
}
const bulkScrapingOrchestrator = new BulkScrapingOrchestrator();
const GET = async ({ url }) => {
  try {
    const action = url.searchParams.get("action");
    switch (action) {
      case "health":
        const errorSystemHealth = validateErrorRecoverySystem();
        return json({
          success: true,
          health: {
            bulkOrchestrator: "operational",
            errorRecovery: errorSystemHealth,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      case "active-sessions":
        const activeSessions = await bulkScrapingOrchestrator.getActiveSessions();
        return json({
          success: true,
          activeSessions,
          count: activeSessions.length
        });
      default:
        return json(
          { success: false, error: "Invalid action. Use: health, active-sessions" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Bulk scraping API error:", error);
    return json(
      {
        success: false,
        error: "Failed to process bulk scraping request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
};
const POST = async ({ request }) => {
  try {
    const data = await request.json();
    const { action } = data;
    switch (action) {
      case "create-session":
        const config = {
          sessionType: data.sessionType || "ACCOUNT_METRICS",
          targetAccounts: data.targetAccounts || [],
          batchSize: data.batchSize || 5,
          maxConcurrentRequests: data.maxConcurrentRequests || 3,
          costLimit: data.costLimit || 5,
          priority: data.priority || "NORMAL",
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : void 0,
          triggeredBy: data.triggeredBy || "USER",
          triggerSource: data.triggerSource || "MANUAL"
        };
        const sessionId = await bulkScrapingOrchestrator.createSession(config);
        return json({
          success: true,
          sessionId,
          message: "Bulk scraping session created successfully",
          config: {
            ...config,
            scheduledFor: config.scheduledFor?.toISOString()
          }
        });
      case "execute-session":
        if (!data.sessionId) {
          return json(
            { success: false, error: "Session ID is required" },
            { status: 400 }
          );
        }
        const result = await bulkScrapingOrchestrator.executeSession(data.sessionId);
        return json({
          success: true,
          result,
          message: result.success ? "Bulk scraping session completed successfully" : "Bulk scraping session completed with errors"
        });
      case "create-and-execute":
        const createConfig = {
          sessionType: data.sessionType || "ACCOUNT_METRICS",
          targetAccounts: data.targetAccounts || [],
          batchSize: data.batchSize || 5,
          maxConcurrentRequests: data.maxConcurrentRequests || 3,
          costLimit: data.costLimit || 5,
          priority: data.priority || "HIGH",
          // Higher priority for immediate execution
          triggeredBy: data.triggeredBy || "USER",
          triggerSource: data.triggerSource || "MANUAL"
        };
        if (!createConfig.targetAccounts || createConfig.targetAccounts.length === 0) {
          return json(
            { success: false, error: "Target accounts list is required and cannot be empty" },
            { status: 400 }
          );
        }
        const newSessionId = await bulkScrapingOrchestrator.createSession(createConfig);
        const executeResult = await bulkScrapingOrchestrator.executeSession(newSessionId);
        return json({
          success: true,
          sessionId: newSessionId,
          result: executeResult,
          message: executeResult.success ? "Bulk scraping session created and completed successfully" : "Bulk scraping session created but completed with errors",
          summary: {
            totalAccounts: executeResult.totalAccounts,
            successfulAccounts: executeResult.successfulAccounts,
            failedAccounts: executeResult.failedAccounts,
            skippedAccounts: executeResult.skippedAccounts,
            totalCost: executeResult.totalCost,
            duration: executeResult.duration,
            errorCount: executeResult.errors.length
          }
        });
      case "test-integration":
        const testConfig = {
          sessionType: "ACCOUNT_METRICS",
          targetAccounts: ["therock", "instagram", "natgeo"],
          batchSize: 2,
          maxConcurrentRequests: 2,
          costLimit: 1,
          priority: "NORMAL",
          triggeredBy: "SYSTEM_TEST",
          triggerSource: "API"
        };
        const testSessionId = await bulkScrapingOrchestrator.createSession(testConfig);
        return json({
          success: true,
          message: "Integration test successful - session created",
          testSessionId,
          testConfig,
          nextStep: `Use POST /api/scraping/bulk with action: execute-session and sessionId: ${testSessionId} to run the test`
        });
      default:
        return json(
          {
            success: false,
            error: "Invalid action. Available actions: create-session, execute-session, create-and-execute, test-integration"
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Bulk scraping POST API error:", error);
    return json(
      {
        success: false,
        error: "Failed to process bulk scraping request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-C6DhOExq.js.map
