import { j as json } from './index-Djsj11qr.js';
import { prisma } from './database-CKYbeswu.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './status-BUw8K8Dp.js';

const POST = async ({ request }) => {
  try {
    let evaluateAutomationEligibility = function(account) {
      const canLogin = account.status === "Assigned" && !!account.assignedDeviceId;
      const canWarmup = account.status === "Logged In";
      let loginReason = "";
      let warmupReason = "";
      let recommendedOperation = "none";
      if (account.status !== "Assigned") {
        loginReason = `Account status must be 'Assigned' (current: '${account.status}')`;
      } else if (!account.assignedDeviceId) {
        loginReason = "Account must be assigned to a device";
      } else {
        loginReason = "Ready for login automation";
      }
      if (account.status !== "Logged In") {
        warmupReason = `Account status must be 'Logged In' (current: '${account.status}')`;
      } else {
        warmupReason = "Ready for warmup automation";
      }
      if (canLogin && canWarmup) {
        recommendedOperation = "warmup";
      } else if (canLogin) {
        recommendedOperation = body.operationType === "both" ? "both" : "login";
      } else if (canWarmup) {
        recommendedOperation = "warmup";
      }
      return {
        canLogin,
        canWarmup,
        loginReason,
        warmupReason,
        recommendedOperation
      };
    };
    const body = await request.json();
    if (!body.accountIds || !Array.isArray(body.accountIds) || body.accountIds.length === 0) {
      return json({
        success: false,
        error: "Account IDs are required"
      }, { status: 400 });
    }
    if (body.accountIds.length > 100) {
      return json({
        success: false,
        error: "Maximum 100 accounts allowed per request"
      }, { status: 400 });
    }
    console.log(`Fetching bulk account info for ${body.accountIds.length} accounts`);
    const includeClause = {
      account: {
        select: {
          id: true,
          instagramUsername: true,
          status: true,
          assignedDeviceId: true,
          assignedCloneNumber: true,
          assignedPackageName: true,
          loginTimestamp: true,
          assignmentTimestamp: true,
          createdAt: true,
          updatedAt: true,
          imapStatus: true
        }
      }
    };
    if (body.includeActiveSessions) {
      includeClause.automationSessions = {
        where: {
          status: {
            in: ["STARTING", "RUNNING", "STOPPING"]
          }
        },
        select: {
          id: true,
          sessionType: true,
          status: true,
          progress: true,
          startTime: true
        }
      };
    }
    const accounts = await prisma.igAccount.findMany({
      where: {
        id: {
          in: body.accountIds
        }
      },
      select: {
        id: true,
        instagramUsername: true,
        status: true,
        assignedDeviceId: true,
        assignedCloneNumber: true,
        assignedPackageName: true,
        loginTimestamp: true,
        assignmentTimestamp: true,
        createdAt: true,
        updatedAt: true,
        imapStatus: true,
        automationSessions: body.includeActiveSessions ? {
          where: {
            status: {
              in: ["STARTING", "RUNNING", "STOPPING"]
            }
          },
          select: {
            id: true,
            sessionType: true,
            status: true,
            progress: true,
            startTime: true
          }
        } : false
      },
      orderBy: {
        instagramUsername: "asc"
      }
    });
    let deviceInfoMap = /* @__PURE__ */ new Map();
    if (body.includeAutomationEligibility) {
      const deviceIds = accounts.map((acc) => acc.assignedDeviceId).filter(Boolean);
      if (deviceIds.length > 0) {
        const cloneInventory = await prisma.cloneInventory.findMany({
          where: {
            deviceId: { in: deviceIds }
          },
          select: {
            deviceId: true,
            cloneNumber: true,
            deviceName: true,
            cloneHealth: true,
            cloneStatus: true
          }
        });
        for (const clone of cloneInventory) {
          const key = `${clone.deviceId}_${clone.cloneNumber}`;
          deviceInfoMap.set(key, {
            deviceName: clone.deviceName,
            cloneHealth: clone.cloneHealth,
            cloneStatus: clone.cloneStatus
          });
        }
      }
    }
    const accountData = accounts.map((account) => {
      const baseData = {
        id: account.id,
        instagramUsername: account.instagramUsername,
        status: account.status,
        assignedDeviceId: account.assignedDeviceId,
        assignedCloneNumber: account.assignedCloneNumber,
        assignedPackageName: account.assignedPackageName,
        loginTimestamp: account.loginTimestamp ? account.loginTimestamp.toISOString() : null,
        assignmentTimestamp: account.assignmentTimestamp ? account.assignmentTimestamp.toISOString() : null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        imapStatus: account.imapStatus
      };
      if (body.includeAutomationEligibility) {
        baseData.automationEligibility = evaluateAutomationEligibility(account);
      }
      if (body.includeActiveSessions && account.automationSessions) {
        baseData.activeSessions = account.automationSessions.map((session) => ({
          id: session.id,
          sessionType: session.sessionType,
          status: session.status,
          progress: session.progress,
          startTime: session.startTime ? session.startTime.toISOString() : null
        }));
      }
      if (body.includeAutomationEligibility && account.assignedDeviceId && account.assignedCloneNumber !== null) {
        const deviceKey = `${account.assignedDeviceId}_${account.assignedCloneNumber}`;
        const deviceInfo = deviceInfoMap.get(deviceKey);
        if (deviceInfo) {
          baseData.deviceInfo = deviceInfo;
        }
      }
      return baseData;
    });
    const foundAccountIds = new Set(accounts.map((account) => account.id));
    const notFound = body.accountIds.filter((id) => !foundAccountIds.has(id));
    let eligibilitySummary;
    if (body.includeAutomationEligibility) {
      const summary = {
        canLogin: 0,
        canWarmup: 0,
        canBoth: 0,
        ineligible: 0,
        hasActiveSessions: 0
      };
      for (const account of accountData) {
        if (account.automationEligibility) {
          const { canLogin, canWarmup } = account.automationEligibility;
          if (canLogin && canWarmup) {
            summary.canBoth++;
          } else if (canLogin) {
            summary.canLogin++;
          } else if (canWarmup) {
            summary.canWarmup++;
          } else {
            summary.ineligible++;
          }
        }
        if (account.activeSessions && account.activeSessions.length > 0) {
          summary.hasActiveSessions++;
        }
      }
      eligibilitySummary = summary;
    }
    console.log(`Bulk account info retrieved: ${accounts.length} found, ${notFound.length} not found`);
    if (eligibilitySummary) {
      console.log(`Eligibility summary: ${eligibilitySummary.canLogin} can login, ${eligibilitySummary.canWarmup} can warmup, ${eligibilitySummary.canBoth} can both, ${eligibilitySummary.ineligible} ineligible, ${eligibilitySummary.hasActiveSessions} have active sessions`);
    }
    const response = {
      success: true,
      data: {
        accounts: accountData,
        found: accounts.length,
        notFound
      }
    };
    if (eligibilitySummary) {
      response.data.eligibilitySummary = eligibilitySummary;
    }
    return json(response);
  } catch (error) {
    console.error("Bulk account info error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch account information"
    }, { status: 500 });
  }
};

export { POST };
//# sourceMappingURL=_server.ts-CCUz_WAE.js.map
