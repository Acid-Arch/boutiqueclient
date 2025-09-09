import { e as error, j as json } from './index-Djsj11qr.js';
import { getPrisma } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

let capacityCache = null;
const CACHE_TTL_MS = 3e4;
const PERFORMANCE_WARNING_THRESHOLD_MS = 5e3;
let cacheWarmingInterval = null;
function startCacheWarming() {
  if (cacheWarmingInterval) return;
  cacheWarmingInterval = setInterval(async () => {
    try {
      console.log("[CacheWarming] Starting background cache refresh...");
      const startTime = Date.now();
      const data = await getCapacityData({
        includeUnhealthy: false,
        status: "all"
      }, "cache-warm");
      const responseTime = Date.now() - startTime;
      capacityCache = {
        data: {
          ...data,
          realTimeMetrics: {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            responseTimeMs: responseTime,
            cacheHit: false
          }
        },
        timestamp: Date.now(),
        ttlMs: CACHE_TTL_MS
      };
      console.log(`[CacheWarming] Cache refreshed in ${responseTime}ms`);
      if (responseTime > PERFORMANCE_WARNING_THRESHOLD_MS) {
        console.warn(`[CacheWarming] Performance warning: Cache refresh took ${responseTime}ms (threshold: ${PERFORMANCE_WARNING_THRESHOLD_MS}ms)`);
      }
    } catch (error2) {
      console.error("[CacheWarming] Failed to refresh cache:", error2);
    }
  }, 25e3);
}
startCacheWarming();
const GET = async ({ url }) => {
  const startTime = Date.now();
  const requestId = `cap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Starting capacity check request`);
  try {
    const deviceId = url.searchParams.get("deviceId") || void 0;
    const deviceIdsParam = url.searchParams.get("deviceIds");
    const deviceIds = deviceIdsParam ? deviceIdsParam.split(",") : void 0;
    const minAvailableClones = url.searchParams.get("minAvailableClones");
    const includeUnhealthy = url.searchParams.get("includeUnhealthy") === "true";
    const status = url.searchParams.get("status") || "all";
    const useCache = url.searchParams.get("cache") !== "false";
    if (minAvailableClones && (isNaN(parseInt(minAvailableClones)) || parseInt(minAvailableClones) < 0)) {
      console.log(`[${requestId}] Invalid minAvailableClones parameter: ${minAvailableClones}`);
      throw error(400, "minAvailableClones must be a non-negative integer");
    }
    if (deviceIds && deviceIds.some((id) => !id.trim())) {
      console.log(`[${requestId}] Invalid deviceIds parameter: contains empty IDs`);
      throw error(400, "deviceIds parameter contains invalid device IDs");
    }
    const filters = {
      deviceId,
      deviceIds,
      minAvailableClones: minAvailableClones ? parseInt(minAvailableClones) : void 0,
      includeUnhealthy,
      status
    };
    console.log(`[${requestId}] Request filters:`, JSON.stringify(filters, null, 2));
    const isCacheableRequest = !deviceId && !deviceIds && !minAvailableClones && status === "all";
    let usingCache = false;
    if (useCache && isCacheableRequest && capacityCache) {
      const age = Date.now() - capacityCache.timestamp;
      if (age < capacityCache.ttlMs) {
        const responseTime2 = Date.now() - startTime;
        usingCache = true;
        console.log(`[${requestId}] Cache hit - age: ${age}ms, response time: ${responseTime2}ms`);
        const cachedResponse = {
          ...capacityCache.data,
          realTimeMetrics: {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            responseTimeMs: responseTime2,
            cacheHit: true
          }
        };
        return json(cachedResponse);
      } else {
        console.log(`[${requestId}] Cache expired - age: ${age}ms, TTL: ${capacityCache.ttlMs}ms`);
      }
    } else {
      console.log(`[${requestId}] Cache not applicable - useCache: ${useCache}, isCacheable: ${isCacheableRequest}, hasCache: ${!!capacityCache}`);
    }
    console.log(`[${requestId}] Fetching fresh capacity data...`);
    const capacityData = await getCapacityData(filters, requestId);
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}] Data fetch completed - response time: ${responseTime}ms, devices: ${capacityData.deviceCapacities.length}, total available: ${capacityData.totalCapacity.availableClones}`);
    const response = {
      ...capacityData,
      realTimeMetrics: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        responseTimeMs: responseTime,
        cacheHit: usingCache
      }
    };
    if (isCacheableRequest) {
      capacityCache = {
        data: response,
        timestamp: Date.now(),
        ttlMs: CACHE_TTL_MS
      };
      console.log(`[${requestId}] Updated cache with fresh data`);
    }
    console.log(`[${requestId}] Request completed successfully - total time: ${responseTime}ms`);
    return json(response);
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Failed to check capacity";
    console.error(`[${requestId}] Capacity check error (${responseTime}ms):`, {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : void 0,
      context: "capacity-check-endpoint"
    });
    return json({
      error: errorMessage,
      realTimeMetrics: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        responseTimeMs: responseTime,
        cacheHit: false
      },
      requestId
    }, { status: 500 });
  }
};
const POST = async ({ request }) => {
  const startTime = Date.now();
  const requestId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Starting capacity simulation request`);
  try {
    const body = await request.json();
    const {
      requiredSlots = 1,
      accountIds = [],
      strategy = "round-robin",
      preferredDevices = [],
      excludeDevices = []
    } = body;
    console.log(`[${requestId}] Simulation parameters:`, {
      requiredSlots,
      accountIds: accountIds.length,
      strategy,
      preferredDevices: preferredDevices.length,
      excludeDevices: excludeDevices.length
    });
    if (requiredSlots < 1 || requiredSlots > 100) {
      console.log(`[${requestId}] Invalid requiredSlots: ${requiredSlots}`);
      throw error(400, "requiredSlots must be between 1 and 100");
    }
    if (accountIds.length > 0 && accountIds.some((id) => typeof id !== "number" || id <= 0)) {
      console.log(`[${requestId}] Invalid accountIds provided`);
      throw error(400, "accountIds must be an array of positive integers");
    }
    const filters = {
      deviceIds: preferredDevices.length > 0 ? preferredDevices : void 0,
      includeUnhealthy: false,
      status: "available"
    };
    console.log(`[${requestId}] Fetching capacity data for simulation...`);
    const capacityData = await getCapacityData(filters, requestId);
    const filteredDevices = capacityData.deviceCapacities.filter(
      (device) => !excludeDevices.includes(device.deviceId)
    );
    const totalAvailableSlots = filteredDevices.reduce(
      (sum, device) => sum + device.availableClones,
      0
    );
    const canAssign = totalAvailableSlots >= requiredSlots;
    console.log(`[${requestId}] Assignment feasibility: canAssign=${canAssign}, required=${requiredSlots}, available=${totalAvailableSlots}`);
    let assignmentPlan = [];
    if (canAssign) {
      console.log(`[${requestId}] Running assignment simulation with strategy: ${strategy}`);
      assignmentPlan = simulateAssignment(filteredDevices, requiredSlots, strategy);
      console.log(`[${requestId}] Simulation complete - ${assignmentPlan.length} devices would be used`);
    }
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}] Simulation request completed in ${responseTime}ms`);
    return json({
      canAssign,
      requiredSlots,
      availableSlots: totalAvailableSlots,
      shortfall: canAssign ? 0 : requiredSlots - totalAvailableSlots,
      strategy,
      assignmentPlan,
      alternativeStrategies: canAssign ? [] : await getSuggestedAlternatives(capacityData, requiredSlots),
      deviceCapacities: filteredDevices,
      realTimeMetrics: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        responseTimeMs: responseTime,
        cacheHit: false
      }
    });
  } catch (err) {
    console.error("Capacity check simulation error:", err);
    if (err instanceof Error) {
      throw error(500, err.message);
    }
    throw error(500, "Internal server error during capacity simulation");
  }
};
async function getCapacityData(filters, requestId) {
  const logPrefix = requestId ? `[${requestId}]` : "[CapacityData]";
  const prisma = await getPrisma();
  let cloneWhereClause = {};
  if (filters.deviceId) {
    cloneWhereClause.deviceId = filters.deviceId;
  } else if (filters.deviceIds && filters.deviceIds.length > 0) {
    cloneWhereClause.deviceId = { in: filters.deviceIds };
  }
  if (filters.status && filters.status !== "all") {
    const statusMap = {
      "available": "Available",
      "assigned": "Assigned",
      "logged-in": "Logged In",
      "broken": "Broken"
    };
    cloneWhereClause.cloneStatus = statusMap[filters.status];
  }
  if (!filters.includeUnhealthy) {
    cloneWhereClause.cloneHealth = { not: "Broken" };
  }
  console.log(`${logPrefix} Query conditions:`, JSON.stringify(cloneWhereClause, null, 2));
  const cloneQueryStart = Date.now();
  const allClones = await prisma.cloneInventory.findMany({
    where: cloneWhereClause,
    select: {
      deviceId: true,
      deviceName: true,
      cloneNumber: true,
      cloneStatus: true,
      cloneHealth: true,
      lastScanned: true,
      currentAccount: true
    }
  });
  const cloneQueryTime = Date.now() - cloneQueryStart;
  console.log(`${logPrefix} Clone query completed in ${cloneQueryTime}ms, found ${allClones.length} clones`);
  const processingStart = Date.now();
  const deviceMap = /* @__PURE__ */ new Map();
  for (const clone of allClones) {
    if (!deviceMap.has(clone.deviceId)) {
      deviceMap.set(clone.deviceId, {
        deviceName: clone.deviceName,
        clones: [],
        lastScanned: clone.lastScanned,
        deviceHealth: clone.cloneHealth,
        statusCounts: { available: 0, assigned: 0, loggedIn: 0, broken: 0 }
      });
    }
    const deviceData = deviceMap.get(clone.deviceId);
    deviceData.clones.push(clone);
    switch (clone.cloneStatus) {
      case "Available":
        deviceData.statusCounts.available++;
        break;
      case "Assigned":
        deviceData.statusCounts.assigned++;
        break;
      case "Logged In":
        deviceData.statusCounts.loggedIn++;
        break;
      case "Broken":
        deviceData.statusCounts.broken++;
        break;
    }
    if (clone.lastScanned > deviceData.lastScanned) {
      deviceData.lastScanned = clone.lastScanned;
    }
  }
  const processingTime = Date.now() - processingStart;
  console.log(`${logPrefix} Data processing completed in ${processingTime}ms, processed ${deviceMap.size} devices`);
  const deviceCapacities = Array.from(deviceMap.entries()).map(([deviceId, data]) => {
    const totalClones = data.clones.length;
    const { available: availableClones, assigned: assignedClones, loggedIn: loggedInClones, broken: brokenClones } = data.statusCounts;
    const utilizationRate = totalClones > 0 ? (assignedClones + loggedInClones) / totalClones * 100 : 0;
    return {
      deviceId,
      deviceName: data.deviceName,
      totalClones,
      availableClones,
      assignedClones,
      loggedInClones,
      brokenClones,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      lastScanned: data.lastScanned.toISOString(),
      deviceHealth: data.deviceHealth
    };
  }).filter((device) => {
    if (filters.minAvailableClones && device.availableClones < filters.minAvailableClones) {
      return false;
    }
    return true;
  });
  const totalCapacity = {
    totalClones: deviceCapacities.reduce((sum, device) => sum + device.totalClones, 0),
    availableClones: deviceCapacities.reduce((sum, device) => sum + device.availableClones, 0),
    assignedClones: deviceCapacities.reduce((sum, device) => sum + device.assignedClones, 0),
    loggedInClones: deviceCapacities.reduce((sum, device) => sum + device.loggedInClones, 0),
    brokenClones: deviceCapacities.reduce((sum, device) => sum + device.brokenClones, 0),
    utilizationRate: 0
  };
  totalCapacity.utilizationRate = totalCapacity.totalClones > 0 ? Math.round((totalCapacity.assignedClones + totalCapacity.loggedInClones) / totalCapacity.totalClones * 1e4) / 100 : 0;
  const assignmentRecommendations = generateAssignmentRecommendations(deviceCapacities, totalCapacity);
  return {
    totalCapacity,
    deviceCapacities: deviceCapacities.sort((a, b) => a.deviceId.localeCompare(b.deviceId)),
    assignmentRecommendations
  };
}
function generateAssignmentRecommendations(deviceCapacities, totalCapacity) {
  const availableDevices = deviceCapacities.filter((d) => d.availableClones > 0);
  let recommendedStrategy = "round-robin";
  let reasoning = "";
  let bottleneckDevice;
  const brokenDevices = deviceCapacities.filter((d) => d.brokenClones > d.totalClones * 0.3);
  if (brokenDevices.length > 0) {
    bottleneckDevice = {
      deviceId: brokenDevices[0].deviceId,
      issue: `High broken clone ratio (${brokenDevices[0].brokenClones}/${brokenDevices[0].totalClones})`
    };
  }
  if (availableDevices.length === 0) {
    recommendedStrategy = "round-robin";
    reasoning = "No available devices - strategy irrelevant";
  } else if (availableDevices.length === 1) {
    recommendedStrategy = "fill-first";
    reasoning = "Only one device available - use fill-first strategy";
  } else {
    const capacityVariance = calculateCapacityVariance(availableDevices);
    const avgUtilization = totalCapacity.utilizationRate;
    if (capacityVariance > 50) {
      recommendedStrategy = "capacity-based";
      reasoning = "High capacity variance between devices - prefer devices with more total capacity";
    } else if (avgUtilization > 70) {
      recommendedStrategy = "round-robin";
      reasoning = "High system utilization - distribute load evenly across devices";
    } else {
      recommendedStrategy = "fill-first";
      reasoning = "Low utilization with similar device capacities - fill devices sequentially for better resource management";
    }
  }
  return {
    recommendedStrategy,
    reasoning,
    canAssignAccounts: totalCapacity.availableClones,
    bottleneckDevice
  };
}
function calculateCapacityVariance(devices) {
  if (devices.length < 2) return 0;
  const capacities = devices.map((d) => d.totalClones);
  const mean = capacities.reduce((sum, cap) => sum + cap, 0) / capacities.length;
  const variance = capacities.reduce((sum, cap) => sum + Math.pow(cap - mean, 2), 0) / capacities.length;
  return Math.sqrt(variance);
}
function simulateAssignment(devices, requiredSlots, strategy) {
  const plan = [];
  let remainingSlots = requiredSlots;
  const sortedDevices = [...devices];
  switch (strategy) {
    case "fill-first":
      sortedDevices.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
      break;
    case "capacity-based":
      sortedDevices.sort((a, b) => b.totalClones - a.totalClones);
      break;
    case "round-robin":
    default:
      sortedDevices.sort((a, b) => b.availableClones - a.availableClones);
      break;
  }
  if (strategy === "round-robin") {
    while (remainingSlots > 0 && sortedDevices.some((d) => d.availableClones > 0)) {
      for (const device of sortedDevices) {
        if (remainingSlots <= 0) break;
        if (device.availableClones > 0) {
          const existingPlan = plan.find((p) => p.deviceId === device.deviceId);
          if (existingPlan) {
            existingPlan.clonesToAssign++;
            existingPlan.remainingCapacity--;
          } else {
            plan.push({
              deviceId: device.deviceId,
              clonesToAssign: 1,
              remainingCapacity: device.availableClones - 1
            });
          }
          device.availableClones--;
          remainingSlots--;
        }
      }
    }
  } else {
    for (const device of sortedDevices) {
      if (remainingSlots <= 0) break;
      const slotsToAssign = Math.min(remainingSlots, device.availableClones);
      if (slotsToAssign > 0) {
        plan.push({
          deviceId: device.deviceId,
          clonesToAssign: slotsToAssign,
          remainingCapacity: device.availableClones - slotsToAssign
        });
        remainingSlots -= slotsToAssign;
      }
    }
  }
  return plan;
}
async function getSuggestedAlternatives(capacityData, requiredSlots) {
  const alternatives = [
    {
      strategy: "Wait for devices",
      description: `Wait for ${requiredSlots - capacityData.totalCapacity.availableClones} more clones to become available`,
      feasible: capacityData.totalCapacity.assignedClones > 0
      // Some might become available
    },
    {
      strategy: "Partial assignment",
      description: `Assign ${capacityData.totalCapacity.availableClones} accounts now, ${requiredSlots - capacityData.totalCapacity.availableClones} later`,
      feasible: capacityData.totalCapacity.availableClones > 0
    },
    {
      strategy: "Include unhealthy devices",
      description: "Consider devices with health issues for assignment",
      feasible: capacityData.totalCapacity.brokenClones > 0
    }
  ];
  return alternatives;
}

export { GET, POST };
//# sourceMappingURL=_server.ts-CpOn4OId.js.map
