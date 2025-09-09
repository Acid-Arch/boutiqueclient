import { e as error, j as json } from './index-Djsj11qr.js';
import { getPrisma } from './db-loader-D8HPWY1t.js';
import { A as ACCOUNT_STATUSES } from './status-BUw8K8Dp.js';

const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { operation, accountIds } = body;
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      throw error(400, "No account IDs provided");
    }
    const prisma = await getPrisma();
    const existingAccounts = await prisma.igAccount.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        instagramUsername: true,
        status: true,
        assignedDeviceId: true,
        assignedCloneNumber: true,
        emailAddress: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (existingAccounts.length !== accountIds.length) {
      throw error(400, "Some account IDs are invalid");
    }
    switch (operation) {
      case "updateStatus":
        return await handleStatusUpdate(existingAccounts, body.newStatus, prisma);
      case "assignDevices":
        return await handleDeviceAssignment(existingAccounts, body, prisma);
      case "export":
        return await handleExport(existingAccounts, body.format, prisma);
      case "delete":
        return await handleBulkDelete(accountIds, prisma);
      default:
        throw error(400, "Invalid operation");
    }
  } catch (err) {
    console.error("Bulk operation error:", err);
    if (err instanceof Error) {
      throw error(500, err.message);
    }
    throw error(500, "Internal server error");
  }
};
async function handleStatusUpdate(accounts, newStatus, prisma) {
  if (!ACCOUNT_STATUSES.includes(newStatus)) {
    throw error(400, "Invalid status");
  }
  const errors = [];
  let updated = 0;
  try {
    const updateData = { status: newStatus, updatedAt: /* @__PURE__ */ new Date() };
    if (newStatus === "Logged In") {
      updateData.loginTimestamp = /* @__PURE__ */ new Date();
    } else if (newStatus === "Unused") {
      updateData.assignedDeviceId = null;
      updateData.assignedCloneNumber = null;
      updateData.assignedPackageName = null;
      updateData.assignmentTimestamp = null;
    }
    const result = await prisma.igAccount.updateMany({
      where: { id: { in: accounts.map((a) => a.id) } },
      data: updateData
    });
    updated = result.count;
    if (newStatus === "Unused") {
      const assignedClones = accounts.filter((a) => a.assignedDeviceId && a.assignedCloneNumber);
      if (assignedClones.length > 0) {
        await prisma.cloneInventory.updateMany({
          where: {
            OR: assignedClones.map((account) => ({
              AND: [
                { deviceId: account.assignedDeviceId },
                { cloneNumber: account.assignedCloneNumber }
              ]
            }))
          },
          data: {
            cloneStatus: "Available",
            currentAccount: null,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
      }
    }
  } catch (updateError) {
    console.error("Status update error:", updateError);
    errors.push("Failed to update some accounts");
  }
  return json({
    updated,
    errors,
    message: updated > 0 ? `Successfully updated ${updated} accounts` : "No accounts were updated"
  });
}
async function handleDeviceAssignment(accounts, options, prisma) {
  const {
    assignmentMode = "auto",
    deviceId,
    autoAssignmentStrategy = "round-robin",
    preferredDeviceIds = [],
    excludeDeviceIds = [],
    maxAccountsPerDevice,
    allowPartialAssignment = false
  } = options;
  const unassignedAccounts = accounts.filter((account) => !account.assignedDeviceId);
  if (unassignedAccounts.length === 0) {
    return json({
      assigned: 0,
      errors: [],
      message: "No unassigned accounts to process"
    });
  }
  let assignments;
  let errors = [];
  try {
    assignments = await getAssignments(unassignedAccounts, {
      assignmentMode,
      deviceId,
      strategy: autoAssignmentStrategy,
      preferredDeviceIds,
      excludeDeviceIds,
      maxAccountsPerDevice,
      allowPartialAssignment
    }, prisma);
  } catch (assignmentError) {
    if (allowPartialAssignment && assignmentError.message.includes("Insufficient capacity")) {
      try {
        assignments = await getPartialAssignments(unassignedAccounts, {
          assignmentMode,
          deviceId,
          strategy: autoAssignmentStrategy,
          preferredDeviceIds,
          excludeDeviceIds,
          maxAccountsPerDevice
        }, prisma);
        errors.push(`Partial assignment: Only ${assignments.length} of ${unassignedAccounts.length} accounts could be assigned`);
      } catch (partialError) {
        throw error(400, partialError.message);
      }
    } else {
      throw error(400, assignmentError.message);
    }
  }
  let assigned = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const { account, clone } of assignments) {
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
        assigned++;
      }
    });
  } catch (assignError) {
    console.error("Assignment error:", assignError);
    errors.push("Failed to assign some accounts to devices");
  }
  return json({
    assigned,
    errors,
    message: assigned > 0 ? `Successfully assigned ${assigned} accounts to devices` : "No accounts were assigned"
  });
}
async function handleExport(accounts, format, prisma) {
  const completeAccounts = await prisma.igAccount.findMany({
    where: { id: { in: accounts.map((a) => a.id) } },
    select: {
      id: true,
      instagramUsername: true,
      emailAddress: true,
      status: true,
      assignedDeviceId: true,
      assignedCloneNumber: true,
      assignedPackageName: true,
      assignmentTimestamp: true,
      loginTimestamp: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (format === "csv") {
    const headers = [
      "ID",
      "Username",
      "Email",
      "Status",
      "Device ID",
      "Clone Number",
      "Package Name",
      "Assignment Date",
      "Last Login",
      "Created",
      "Updated"
    ];
    const rows = completeAccounts.map((account) => [
      account.id.toString(),
      account.instagramUsername,
      account.emailAddress,
      account.status,
      account.assignedDeviceId || "",
      account.assignedCloneNumber?.toString() || "",
      account.assignedPackageName || "",
      account.assignmentTimestamp?.toISOString() || "",
      account.loginTimestamp?.toISOString() || "",
      account.createdAt.toISOString(),
      account.updatedAt.toISOString()
    ]);
    const csv = [headers, ...rows].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="accounts_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv"`
      }
    });
  } else {
    const jsonData = {
      exported_at: (/* @__PURE__ */ new Date()).toISOString(),
      total_accounts: completeAccounts.length,
      accounts: completeAccounts
    };
    return new Response(JSON.stringify(jsonData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="accounts_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json"`
      }
    });
  }
}
async function handleBulkDelete(accountIds, prisma) {
  const errors = [];
  let deleted = 0;
  try {
    const accountsToDelete = await prisma.igAccount.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        instagramUsername: true,
        assignedDeviceId: true,
        assignedCloneNumber: true
      }
    });
    await prisma.$transaction(async (tx) => {
      const assignedAccounts = accountsToDelete.filter((a) => a.assignedDeviceId && a.assignedCloneNumber);
      if (assignedAccounts.length > 0) {
        await tx.cloneInventory.updateMany({
          where: {
            OR: assignedAccounts.map((account) => ({
              AND: [
                { deviceId: account.assignedDeviceId },
                { cloneNumber: account.assignedCloneNumber }
              ]
            }))
          },
          data: {
            cloneStatus: "Available",
            currentAccount: null,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      const result = await tx.igAccount.deleteMany({
        where: { id: { in: accountIds } }
      });
      deleted = result.count;
    });
  } catch (deleteError) {
    console.error("Delete error:", deleteError);
    errors.push("Failed to delete some accounts");
  }
  return json({
    deleted,
    errors,
    message: deleted > 0 ? `Successfully deleted ${deleted} accounts` : "No accounts were deleted"
  });
}
async function getAssignments(accounts, options, prisma) {
  const { assignmentMode, deviceId, strategy, preferredDeviceIds = [], excludeDeviceIds = [], maxAccountsPerDevice } = options;
  const whereClause = {
    cloneStatus: "Available"
  };
  if (assignmentMode === "specific" && deviceId) {
    whereClause.deviceId = deviceId;
  } else if (preferredDeviceIds.length > 0) {
    whereClause.deviceId = { in: preferredDeviceIds };
  }
  if (excludeDeviceIds.length > 0) {
    if (whereClause.deviceId) {
      if (typeof whereClause.deviceId === "string") {
        if (excludeDeviceIds.includes(whereClause.deviceId)) {
          throw new Error("Specified device is in exclusion list");
        }
      } else if (whereClause.deviceId.in) {
        whereClause.deviceId.in = whereClause.deviceId.in.filter((id) => !excludeDeviceIds.includes(id));
        if (whereClause.deviceId.in.length === 0) {
          throw new Error("All preferred devices are excluded");
        }
      }
    } else {
      whereClause.deviceId = { notIn: excludeDeviceIds };
    }
  }
  const availableClones = await prisma.cloneInventory.findMany({
    where: whereClause,
    orderBy: [
      { deviceId: "asc" },
      { cloneNumber: "asc" }
    ]
  });
  if (availableClones.length === 0) {
    throw new Error("No available clones found");
  }
  let filteredClones = availableClones;
  if (maxAccountsPerDevice) {
    filteredClones = await applyDeviceCapacityLimits(availableClones, maxAccountsPerDevice, prisma);
  }
  if (filteredClones.length < accounts.length) {
    throw new Error(`Insufficient capacity. Need ${accounts.length} slots, but only ${filteredClones.length} available`);
  }
  switch (strategy) {
    case "round-robin":
      return getRoundRobinAssignments(accounts, filteredClones);
    case "fill-first":
      return getFillFirstAssignments(accounts, filteredClones);
    case "capacity-based":
      return getCapacityBasedAssignments(accounts, filteredClones);
    case "balanced-load":
      return getBalancedLoadAssignments(accounts, filteredClones, prisma);
    case "optimal-distribution":
      return getOptimalDistributionAssignments(accounts, filteredClones, prisma);
    default:
      return getRoundRobinAssignments(accounts, filteredClones);
  }
}
async function getRoundRobinAssignments(accounts, availableClones, prisma) {
  const deviceClones = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceClones.has(clone.deviceId)) {
      deviceClones.set(clone.deviceId, []);
    }
    deviceClones.get(clone.deviceId).push(clone);
  }
  const assignments = [];
  const devices = Array.from(deviceClones.keys());
  let deviceIndex = 0;
  for (const account of accounts) {
    let attempts = 0;
    while (attempts < devices.length) {
      const currentDevice = devices[deviceIndex];
      const availableDeviceClones = deviceClones.get(currentDevice);
      if (availableDeviceClones.length > 0) {
        const clone = availableDeviceClones.shift();
        assignments.push({ account, clone });
        break;
      }
      deviceIndex = (deviceIndex + 1) % devices.length;
      attempts++;
    }
    deviceIndex = (deviceIndex + 1) % devices.length;
  }
  return assignments;
}
async function getFillFirstAssignments(accounts, availableClones, prisma) {
  const assignments = [];
  const clonesCopy = [...availableClones];
  for (let i = 0; i < accounts.length && i < clonesCopy.length; i++) {
    assignments.push({
      account: accounts[i],
      clone: clonesCopy[i]
    });
  }
  return assignments;
}
async function getCapacityBasedAssignments(accounts, availableClones, prisma) {
  const deviceClones = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceClones.has(clone.deviceId)) {
      deviceClones.set(clone.deviceId, []);
    }
    deviceClones.get(clone.deviceId).push(clone);
  }
  const sortedDevices = Array.from(deviceClones.entries()).sort((a, b) => b[1].length - a[1].length).map(([deviceId, clones]) => ({ deviceId, clones }));
  const assignments = [];
  let deviceIndex = 0;
  for (const account of accounts) {
    while (deviceIndex < sortedDevices.length) {
      const device = sortedDevices[deviceIndex];
      if (device.clones.length > 0) {
        const clone = device.clones.shift();
        assignments.push({ account, clone });
        if (device.clones.length === 0) {
          deviceIndex++;
        }
        break;
      }
      deviceIndex++;
    }
  }
  return assignments;
}
async function getBalancedLoadAssignments(accounts, availableClones, prisma) {
  const deviceLoadMap = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceLoadMap.has(clone.deviceId)) {
      const currentLoad = await prisma.cloneInventory.count({
        where: {
          deviceId: clone.deviceId,
          cloneStatus: { in: ["Assigned", "Logged In"] }
        }
      });
      deviceLoadMap.set(clone.deviceId, currentLoad);
    }
  }
  const deviceClones = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceClones.has(clone.deviceId)) {
      deviceClones.set(clone.deviceId, []);
    }
    deviceClones.get(clone.deviceId).push(clone);
  }
  const sortedDevices = Array.from(deviceClones.entries()).sort((a, b) => (deviceLoadMap.get(a[0]) || 0) - (deviceLoadMap.get(b[0]) || 0)).map(([deviceId, clones]) => ({ deviceId, clones, currentLoad: deviceLoadMap.get(deviceId) || 0 }));
  const assignments = [];
  let deviceIndex = 0;
  for (const account of accounts) {
    while (deviceIndex < sortedDevices.length) {
      const device = sortedDevices[deviceIndex];
      if (device.clones.length > 0) {
        const clone = device.clones.shift();
        assignments.push({ account, clone });
        device.currentLoad++;
        let newIndex = deviceIndex;
        while (newIndex > 0 && sortedDevices[newIndex - 1].currentLoad > device.currentLoad) {
          [sortedDevices[newIndex], sortedDevices[newIndex - 1]] = [sortedDevices[newIndex - 1], sortedDevices[newIndex]];
          newIndex--;
        }
        while (newIndex < sortedDevices.length - 1 && sortedDevices[newIndex + 1].currentLoad < device.currentLoad) {
          [sortedDevices[newIndex], sortedDevices[newIndex + 1]] = [sortedDevices[newIndex + 1], sortedDevices[newIndex]];
          newIndex++;
        }
        deviceIndex = newIndex;
        break;
      }
      deviceIndex++;
    }
  }
  return assignments;
}
async function getOptimalDistributionAssignments(accounts, availableClones, prisma) {
  const deviceInfo = /* @__PURE__ */ new Map();
  for (const clone of availableClones) {
    if (!deviceInfo.has(clone.deviceId)) {
      const totalCapacity = await prisma.cloneInventory.count({
        where: { deviceId: clone.deviceId }
      });
      const currentUsage = await prisma.cloneInventory.count({
        where: {
          deviceId: clone.deviceId,
          cloneStatus: { in: ["Assigned", "Logged In"] }
        }
      });
      const efficiency = totalCapacity > 0 ? (totalCapacity - currentUsage) / totalCapacity : 0;
      deviceInfo.set(clone.deviceId, {
        totalCapacity,
        currentUsage,
        availableClones: [],
        efficiency
      });
    }
    deviceInfo.get(clone.deviceId).availableClones.push(clone);
  }
  const assignments = [];
  const deviceList = Array.from(deviceInfo.entries()).filter(([_, info]) => info.availableClones.length > 0).sort((a, b) => b[1].efficiency - a[1].efficiency);
  let totalWeight = deviceList.reduce((sum, [_, info]) => sum + info.efficiency, 0);
  for (const account of accounts) {
    if (deviceList.length === 0) break;
    let remainingWeight = Math.random() * totalWeight;
    let selectedDeviceIndex = 0;
    for (let i = 0; i < deviceList.length; i++) {
      remainingWeight -= deviceList[i][1].efficiency;
      if (remainingWeight <= 0 || deviceList[i][1].availableClones.length > 0) {
        selectedDeviceIndex = i;
        break;
      }
    }
    const [deviceId, deviceData] = deviceList[selectedDeviceIndex];
    if (deviceData.availableClones.length > 0) {
      const clone = deviceData.availableClones.shift();
      assignments.push({ account, clone });
      deviceData.currentUsage++;
      deviceData.efficiency = deviceData.totalCapacity > 0 ? (deviceData.totalCapacity - deviceData.currentUsage) / deviceData.totalCapacity : 0;
      if (deviceData.availableClones.length === 0) {
        deviceList.splice(selectedDeviceIndex, 1);
        totalWeight -= deviceData.efficiency;
      }
    }
  }
  return assignments;
}
async function applyDeviceCapacityLimits(clones, maxAccountsPerDevice, prisma) {
  const deviceUsage = /* @__PURE__ */ new Map();
  for (const clone of clones) {
    if (!deviceUsage.has(clone.deviceId)) {
      const currentUsage = await prisma.cloneInventory.count({
        where: {
          deviceId: clone.deviceId,
          cloneStatus: { in: ["Assigned", "Logged In"] }
        }
      });
      deviceUsage.set(clone.deviceId, currentUsage);
    }
  }
  const filteredClones = [];
  const deviceCloneCounts = /* @__PURE__ */ new Map();
  for (const clone of clones) {
    const currentDeviceCount = deviceCloneCounts.get(clone.deviceId) || 0;
    const currentUsage = deviceUsage.get(clone.deviceId) || 0;
    if (currentUsage + currentDeviceCount < maxAccountsPerDevice) {
      filteredClones.push(clone);
      deviceCloneCounts.set(clone.deviceId, currentDeviceCount + 1);
    }
  }
  return filteredClones;
}
async function getPartialAssignments(accounts, options, prisma) {
  const whereClause = { cloneStatus: "Available" };
  if (options.assignmentMode === "specific" && options.deviceId) {
    whereClause.deviceId = options.deviceId;
  } else if (options.preferredDeviceIds && options.preferredDeviceIds.length > 0) {
    whereClause.deviceId = { in: options.preferredDeviceIds };
  }
  if (options.excludeDeviceIds && options.excludeDeviceIds.length > 0) {
    if (whereClause.deviceId) {
      if (typeof whereClause.deviceId === "string") {
        if (options.excludeDeviceIds.includes(whereClause.deviceId)) {
          throw new Error("Specified device is excluded");
        }
      } else if (whereClause.deviceId.in) {
        whereClause.deviceId.in = whereClause.deviceId.in.filter(
          (id) => !options.excludeDeviceIds.includes(id)
        );
      }
    } else {
      whereClause.deviceId = { notIn: options.excludeDeviceIds };
    }
  }
  const availableClones = await prisma.cloneInventory.findMany({
    where: whereClause,
    orderBy: [
      { deviceId: "asc" },
      { cloneNumber: "asc" }
    ]
  });
  let filteredClones = availableClones;
  if (options.maxAccountsPerDevice) {
    filteredClones = await applyDeviceCapacityLimits(availableClones, options.maxAccountsPerDevice, prisma);
  }
  const accountsToAssign = accounts.slice(0, filteredClones.length);
  switch (options.strategy) {
    case "round-robin":
      return getRoundRobinAssignments(accountsToAssign, filteredClones);
    case "fill-first":
      return getFillFirstAssignments(accountsToAssign, filteredClones);
    case "capacity-based":
      return getCapacityBasedAssignments(accountsToAssign, filteredClones);
    case "balanced-load":
      return getBalancedLoadAssignments(accountsToAssign, filteredClones, prisma);
    case "optimal-distribution":
      return getOptimalDistributionAssignments(accountsToAssign, filteredClones, prisma);
    default:
      return getRoundRobinAssignments(accountsToAssign, filteredClones);
  }
}

export { POST };
//# sourceMappingURL=_server.ts-B72wxalV.js.map
