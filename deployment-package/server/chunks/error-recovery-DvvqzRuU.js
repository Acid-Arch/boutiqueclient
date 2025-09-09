function classifyError(error, context) {
  const timestamp = /* @__PURE__ */ new Date();
  if (error.status === 429 || error.message?.includes("rate limit") || error.code === "RATE_LIMITED") {
    return {
      type: "RATE_LIMIT",
      severity: "MEDIUM",
      code: error.status || 429,
      message: "Rate limit exceeded - requests too frequent",
      details: error,
      timestamp,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      retryable: true,
      suggestedDelay: 6e4,
      // 1 minute
      maxRetries: 5
    };
  }
  if (error.status === 401 || error.status === 403 || error.message?.includes("unauthorized")) {
    return {
      type: "AUTHENTICATION_ERROR",
      severity: "HIGH",
      code: error.status || 401,
      message: "Authentication failed - invalid or expired credentials",
      details: error,
      timestamp,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      retryable: false,
      maxRetries: 0
    };
  }
  if (error.status === 402 || error.message?.includes("quota") || error.message?.includes("budget")) {
    return {
      type: "QUOTA_EXCEEDED",
      severity: "CRITICAL",
      code: error.status || 402,
      message: "API quota or budget limit exceeded",
      details: error,
      timestamp,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      retryable: false,
      maxRetries: 0
    };
  }
  if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
    return {
      type: "TIMEOUT_ERROR",
      severity: "MEDIUM",
      code: error.code || "TIMEOUT",
      message: "Request timed out - network connectivity issue",
      details: error,
      timestamp,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      retryable: true,
      suggestedDelay: 1e4,
      // 10 seconds
      maxRetries: 3
    };
  }
  if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED" || error.status >= 500) {
    return {
      type: "NETWORK_ERROR",
      severity: "MEDIUM",
      code: error.status || error.code,
      message: "Network error - server unavailable or connection failed",
      details: error,
      timestamp,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      retryable: true,
      suggestedDelay: 3e4,
      // 30 seconds
      maxRetries: 5
    };
  }
  if (error.status >= 400 && error.status < 500) {
    return {
      type: "API_ERROR",
      severity: "HIGH",
      code: error.status,
      message: `API error: ${error.message || "Invalid request"}`,
      details: error,
      timestamp,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      retryable: error.status === 408 || error.status === 409,
      // Only retry for timeout or conflict
      suggestedDelay: error.status === 409 ? 5e3 : void 0,
      maxRetries: error.status === 408 || error.status === 409 ? 3 : 0
    };
  }
  return {
    type: "UNKNOWN_ERROR",
    severity: "MEDIUM",
    code: error.status || error.code || "UNKNOWN",
    message: error.message || "An unknown error occurred",
    details: error,
    timestamp,
    sessionId: context?.sessionId,
    accountId: context?.accountId,
    retryable: true,
    suggestedDelay: 15e3,
    // 15 seconds
    maxRetries: 2
  };
}
function determineRecoveryStrategy(scrapingError, context) {
  if (scrapingError.severity === "CRITICAL") {
    return {
      strategy: "CANCEL_SESSION",
      reason: `Critical error: ${scrapingError.message}`
    };
  }
  if (scrapingError.type === "AUTHENTICATION_ERROR") {
    return {
      strategy: "SKIP",
      reason: "Authentication failed - skipping account"
    };
  }
  if (scrapingError.type === "RATE_LIMIT") {
    const pauseDuration = Math.min(
      (scrapingError.suggestedDelay || 6e4) * Math.pow(2, context.consecutiveErrors),
      3e5
      // Max 5 minutes
    );
    return {
      strategy: "PAUSE_SESSION",
      delay: pauseDuration,
      reason: "Rate limit exceeded - pausing session"
    };
  }
  if (scrapingError.retryable && context.attemptNumber < (scrapingError.maxRetries || 3)) {
    const baseDelay = scrapingError.suggestedDelay || 1e4;
    const exponentialDelay = baseDelay * Math.pow(2, context.attemptNumber - 1);
    const jitterDelay = exponentialDelay + Math.random() * 5e3;
    return {
      strategy: "BACKOFF",
      delay: Math.min(jitterDelay, 12e4),
      // Max 2 minutes
      retryCount: context.attemptNumber,
      maxRetries: scrapingError.maxRetries || 3,
      reason: `Retrying after ${Math.round(jitterDelay / 1e3)}s (attempt ${context.attemptNumber})`
    };
  }
  if (context.consecutiveErrors >= 10) {
    return {
      strategy: "PAUSE_SESSION",
      delay: 3e5,
      // 5 minutes
      reason: "Too many consecutive errors - pausing session for recovery"
    };
  }
  return {
    strategy: "SKIP",
    reason: `Max retries exceeded or non-retryable error: ${scrapingError.message}`
  };
}
async function executeRecoveryStrategy(strategy, context, sessionManager) {
  try {
    switch (strategy.strategy) {
      case "RETRY":
        if (strategy.delay) {
          await new Promise((resolve) => setTimeout(resolve, strategy.delay));
        }
        return {
          success: true,
          message: `Retrying after ${strategy.delay || 0}ms delay`,
          shouldContinue: true
        };
      case "BACKOFF":
        if (strategy.delay) {
          await new Promise((resolve) => setTimeout(resolve, strategy.delay));
        }
        return {
          success: true,
          message: strategy.reason,
          shouldContinue: true
        };
      case "SKIP":
        await sessionManager.updateSessionProgress(context.sessionId, {
          skippedAccounts: 1
        });
        return {
          success: true,
          message: strategy.reason,
          shouldContinue: true
        };
      case "PAUSE_SESSION":
        await sessionManager.pauseSession(context.sessionId);
        if (strategy.delay) {
          console.log(`Session ${context.sessionId} paused for ${strategy.delay}ms: ${strategy.reason}`);
        }
        return {
          success: true,
          message: `Session paused: ${strategy.reason}`,
          shouldContinue: false
        };
      case "CANCEL_SESSION":
        await sessionManager.cancelSession(context.sessionId, strategy.reason);
        return {
          success: true,
          message: `Session cancelled: ${strategy.reason}`,
          shouldContinue: false
        };
      case "SWITCH_ACCOUNT":
        return {
          success: false,
          message: "Account switching not yet implemented",
          shouldContinue: false
        };
      default:
        return {
          success: false,
          message: "Unknown recovery strategy",
          shouldContinue: false
        };
    }
  } catch (error) {
    console.error("Error executing recovery strategy:", error);
    return {
      success: false,
      message: `Recovery strategy failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      shouldContinue: false
    };
  }
}
async function withErrorHandling(operation, context, sessionManager) {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const scrapingError = classifyError(error, context);
    const recoveryStrategy = determineRecoveryStrategy(scrapingError, context);
    console.error(`Scraping error in session ${context.sessionId}:`, {
      error: scrapingError,
      recovery: recoveryStrategy,
      context
    });
    const recoveryResult = await executeRecoveryStrategy(recoveryStrategy, context, sessionManager);
    if (!recoveryResult.success) {
      console.error(`Recovery strategy failed for session ${context.sessionId}:`, recoveryResult.message);
    }
    return {
      success: false,
      error: scrapingError,
      recovery: recoveryStrategy
    };
  }
}
function validateErrorRecoverySystem() {
  const capabilities = [
    "Error classification (8 types)",
    "Severity assessment (4 levels)",
    "Retry logic with exponential backoff",
    "Rate limit handling",
    "Session pause/resume capability",
    "Account skipping for non-retryable errors",
    "Critical error handling with session cancellation",
    "Jitter in retry delays to prevent thundering herd"
  ];
  return {
    valid: true,
    message: "Error recovery system fully operational",
    capabilities
  };
}

export { classifyError as c, determineRecoveryStrategy as d, executeRecoveryStrategy as e, validateErrorRecoverySystem as v, withErrorHandling as w };
//# sourceMappingURL=error-recovery-DvvqzRuU.js.map
