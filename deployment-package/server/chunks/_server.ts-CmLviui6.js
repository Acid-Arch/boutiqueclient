import { e as error, j as json } from './index-Djsj11qr.js';
import { prisma } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { accountId, instagramUsername, strategy = "round-robin", deviceId, preferDeviceIds } = body;
    if (!accountId && !instagramUsername) {
      throw error(400, "Either accountId or instagramUsername is required");
    }
    let account;
    if (accountId) {
      account = await prisma.igAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          instagramUsername: true,
          status: true,
          assignedDeviceId: true,
          assignedCloneNumber: true
        }
      });
    } else {
      account = await prisma.igAccount.findFirst({
        where: { instagramUsername },
        select: {
          id: true,
          instagramUsername: true,
          status: true,
          assignedDeviceId: true,
          assignedCloneNumber: true
        }
      });
    }
    if (!account) {
      throw error(404, "Account not found");
    }
    if (account.assignedDeviceId && account.assignedCloneNumber) {
      return json({
        success: false,
        error: `Account ${account.instagramUsername} is already assigned to device ${account.assignedDeviceId} clone ${account.assignedCloneNumber}`,
        availableCapacity: await getCapacityInfo()
      });
    }
    const assignment = await findOptimalAssignment(account, strategy, deviceId, preferDeviceIds);
    if (!assignment) {
      return json({
        success: false,
        error: "No available clones found for assignment",
        availableCapacity: await getCapacityInfo()
      });
    }
    const success = await performAssignment(account, assignment.clone);
    if (success) {
      return json({
        success: true,
        assignment: {
          accountId: account.id,
          instagramUsername: account.instagramUsername,
          deviceId: assignment.clone.deviceId,
          cloneNumber: assignment.clone.cloneNumber,
          packageName: assignment.clone.packageName,
          strategy
        }
      });
    } else {
      return json({
        success: false,
        error: "Failed to perform assignment due to database error",
        availableCapacity: await getCapacityInfo()
      });
    }
  } catch (err) {
    console.error("Auto-assign error:", err);
    if (err instanceof Error) {
      throw error(500, err.message);
    }
    throw error(500, "Internal server error during auto-assignment");
  }
};
const GET = async ({ url }) => {
  try {
    const accountIdParam = url.searchParams.get("accountId");
    const instagramUsername = url.searchParams.get("instagramUsername");
    const strategy = url.searchParams.get("strategy") || "round-robin";
    const deviceId = url.searchParams.get("deviceId") || void 0;
    let account = null;
    if (accountIdParam || instagramUsername) {
      if (accountIdParam) {
        account = await prisma.igAccount.findUnique({
          where: { id: parseInt(accountIdParam) },
          select: {
            id: true,
            instagramUsername: true,
            status: true,
            assignedDeviceId: true,
            assignedCloneNumber: true
          }
        });
      } else if (instagramUsername) {
        account = await prisma.igAccount.findFirst({
          where: { instagramUsername },
          select: {
            id: true,
            instagramUsername: true,
            status: true,
            assignedDeviceId: true,
            assignedCloneNumber: true
          }
        });
      }
      if (!account) {
        throw error(404, "Account not found");
      }
    }
    const capacityInfo = await getCapacityInfo(deviceId);
    let suggestedAssignment = null;
    if (account && !account.assignedDeviceId) {
      const assignment = await findOptimalAssignment(account, strategy, deviceId);
      if (assignment) {
        suggestedAssignment = {
          deviceId: assignment.clone.deviceId,
          cloneNumber: assignment.clone.cloneNumber,
          packageName: assignment.clone.packageName,
          strategy
        };
      }
    }
    return json({
      success: true,
      availableCapacity: capacityInfo,
      suggestedAssignment,
      accountStatus: account ? {
        id: account.id,
        instagramUsername: account.instagramUsername,
        status: account.status,
        alreadyAssigned: !!(account.assignedDeviceId && account.assignedCloneNumber)
      } : null
    });
  } catch (err) {
    console.error("Auto-assign preview error:", err);
    if (err instanceof Error) {
      throw error(500, err.message);
    }
    throw error(500, "Internal server error during assignment preview");
  }
};
async function findOptimalAssignment(account, strategy, specificDeviceId, preferDeviceIds) {
  const whereClause = {
    cloneStatus: "Available"
  };
  if (specificDeviceId) {
    whereClause.deviceId = specificDeviceId;
  } else if (preferDeviceIds && preferDeviceIds.length > 0) {
    whereClause.deviceId = { in: preferDeviceIds };
  }
  let availableClones = await prisma.cloneInventory.findMany({
    where: whereClause,
    orderBy: [
      { deviceId: "asc" },
      { cloneNumber: "asc" }
    ]
  });
  if (availableClones.length === 0 && !specificDeviceId && preferDeviceIds) {
    availableClones = await prisma.cloneInventory.findMany({
      where: { cloneStatus: "Available" },
      orderBy: [
        { deviceId: "asc" },
        { cloneNumber: "asc" }
      ]
    });
  }
  if (availableClones.length === 0) {
    return null;
  }
  let selectedClone;
  switch (strategy) {
    case "round-robin":
      selectedClone = selectRoundRobinClone(availableClones);
      break;
    case "fill-first":
      selectedClone = availableClones[0];
      break;
    case "capacity-based":
      selectedClone = await selectCapacityBasedClone(availableClones);
      break;
    default:
      selectedClone = availableClones[0];
  }
  return { clone: selectedClone };
}
function selectRoundRobinClone(availableClones) {
  const deviceGroups = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceGroups.has(clone.deviceId)) {
      deviceGroups.set(clone.deviceId, []);
    }
    deviceGroups.get(clone.deviceId).push(clone);
  }
  let bestDevice = "";
  let maxAvailable = 0;
  for (const [deviceId, clones] of deviceGroups) {
    if (clones.length > maxAvailable) {
      maxAvailable = clones.length;
      bestDevice = deviceId;
    }
  }
  return deviceGroups.get(bestDevice)[0];
}
async function selectCapacityBasedClone(availableClones) {
  const deviceClones = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceClones.has(clone.deviceId)) {
      deviceClones.set(clone.deviceId, []);
    }
    deviceClones.get(clone.deviceId).push(clone);
  }
  const deviceCapacities = /* @__PURE__ */ new Map();
  for (const deviceId of deviceClones.keys()) {
    const totalClones = await prisma.cloneInventory.count({
      where: { deviceId }
    });
    deviceCapacities.set(deviceId, totalClones);
  }
  let bestDevice = "";
  let maxCapacity = 0;
  for (const [deviceId, capacity] of deviceCapacities) {
    if (capacity > maxCapacity) {
      maxCapacity = capacity;
      bestDevice = deviceId;
    }
  }
  return deviceClones.get(bestDevice)[0];
}
async function performAssignment(account, clone) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.igAccount.update({
        where: { id: account.id },
        data: {
          status: "Assigned",
          assignedDeviceId: clone.deviceId,
          assignedCloneNumber: clone.cloneNumber,
          assignedPackageName: clone.packageName,
          assignmentTimestamp: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
      await tx.cloneInventory.update({
        where: {
          deviceId_cloneNumber: {
            deviceId: clone.deviceId,
            cloneNumber: clone.cloneNumber
          }
        },
        data: {
          cloneStatus: "Assigned",
          currentAccount: account.instagramUsername,
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
    });
    return true;
  } catch (assignmentError) {
    console.error("Assignment transaction error:", assignmentError);
    return false;
  }
}
async function getCapacityInfo(specificDeviceId) {
  const whereClause = {
    cloneStatus: "Available"
  };
  if (specificDeviceId) {
    whereClause.deviceId = specificDeviceId;
  }
  const availableClones = await prisma.cloneInventory.findMany({
    where: whereClause,
    select: {
      deviceId: true,
      deviceName: true,
      cloneNumber: true
    }
  });
  const deviceMap = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceMap.has(clone.deviceId)) {
      deviceMap.set(clone.deviceId, {
        deviceName: clone.deviceName,
        count: 0
      });
    }
    deviceMap.get(clone.deviceId).count++;
  }
  const deviceBreakdown = Array.from(deviceMap.entries()).map(([deviceId, info]) => ({
    deviceId,
    deviceName: info.deviceName,
    availableClones: info.count
  }));
  return {
    totalAvailable: availableClones.length,
    deviceBreakdown: deviceBreakdown.sort((a, b) => a.deviceId.localeCompare(b.deviceId))
  };
}

export { GET, POST };
//# sourceMappingURL=_server.ts-CmLviui6.js.map
