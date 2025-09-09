import { d as dev } from './index-Dn7PghUK.js';
export { A as ACCOUNT_STATUSES, C as CLONE_HEALTH, a as CLONE_STATUSES, D as DEVICE_STATUSES, g as getCloneStatusClass, b as getDeviceStatusClass, c as getStatusClass } from './status-BUw8K8Dp.js';
import './false-B2gHlHjM.js';

let _prismaClient = null;
let _prismaAvailable = null;
let _initPromise = null;
const DB_CONFIG = {
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "30000"),
  queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000"),
  statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000"),
  poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT_MS || "0")
};
function buildOptimizedConnectionUrl() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const url = new URL(baseUrl);
  const poolParams = new URLSearchParams(url.search);
  if (!poolParams.has("connection_limit")) {
    poolParams.set("connection_limit", DB_CONFIG.maxConnections.toString());
  }
  if (!poolParams.has("pool_timeout")) {
    poolParams.set("pool_timeout", DB_CONFIG.poolTimeout.toString());
  }
  if (!poolParams.has("connect_timeout")) {
    poolParams.set("connect_timeout", (DB_CONFIG.connectionTimeout / 1e3).toString());
  }
  if (!poolParams.has("statement_timeout")) {
    poolParams.set("statement_timeout", `${DB_CONFIG.statementTimeout}ms`);
  }
  if (!poolParams.has("pgbouncer") && process.env.NODE_ENV === "production") {
    poolParams.set("pgbouncer", "true");
  }
  if (!poolParams.has("sslmode")) {
    poolParams.set("sslmode", process.env.DB_SSL_MODE || "prefer");
  }
  if (!poolParams.has("application_name")) {
    poolParams.set("application_name", process.env.PUBLIC_APP_NAME || "boutique-client-portal");
  }
  url.search = poolParams.toString();
  return url.toString();
}
async function initializePrisma() {
  if (_initPromise) {
    return _initPromise;
  }
  _initPromise = (async () => {
    try {
      console.log("🔄 Initializing Prisma client with connection pooling...");
      const { PrismaClient } = await import('@prisma/client');
      const connectionUrl = buildOptimizedConnectionUrl();
      const client = new PrismaClient({
        datasources: {
          db: {
            url: connectionUrl
          }
        },
        log: dev ? ["query", "info", "warn", "error"] : ["error", "warn"],
        errorFormat: "pretty"
      });
      client.$use(async (params, next) => {
        const start = Date.now();
        try {
          const result = await next(params);
          const duration = Date.now() - start;
          if (dev && duration > 1e3) ;
          return result;
        } catch (error) {
          console.error(`❌ DB query failed: ${params.model}.${params.action}`, error);
          throw error;
        }
      });
      const testPromise = client.$connect().then(() => client.igAccount.count());
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Connection timeout")), DB_CONFIG.connectionTimeout)
      );
      await Promise.race([testPromise, timeoutPromise]);
      console.log("✅ Prisma client with connection pooling initialized successfully");
      console.log(`📊 Pool config: Max ${DB_CONFIG.maxConnections} connections, ${DB_CONFIG.connectionTimeout}ms timeout`);
      const gracefulShutdown = async () => {
        if (_prismaClient) {
          console.log("🔄 Closing database connections...");
          await _prismaClient.$disconnect();
          _prismaClient = null;
          console.log("✅ Database connections closed");
        }
      };
      process.on("SIGINT", gracefulShutdown);
      process.on("SIGTERM", gracefulShutdown);
      process.on("SIGQUIT", gracefulShutdown);
      process.on("beforeExit", gracefulShutdown);
      _prismaClient = client;
      _prismaAvailable = true;
      return { client, available: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("⚠️  Prisma client initialization failed:", errorMessage);
      console.log("📋 This is expected on NixOS. Application will use direct SQL fallback.");
      _prismaClient = null;
      _prismaAvailable = false;
      return { client: null, available: false };
    }
  })();
  return _initPromise;
}
const prisma = new Proxy({}, {
  get: function(target, prop) {
    if (prop === "then" || prop === "catch" || prop === "finally" || typeof prop === "symbol") {
      return void 0;
    }
    if (prop === "$connect" || prop === "$disconnect" || prop === "$queryRaw" || prop === "$executeRaw") {
      return async (...args) => {
        const { client, available } = await initializePrisma();
        if (available && client) {
          return client[prop](...args);
        }
        if (prop === "$connect" || prop === "$disconnect") {
          return Promise.resolve();
        }
        throw new Error(`Prisma not available: Cannot execute ${String(prop)}`);
      };
    }
    if (prop === "igAccount" || prop === "cloneInventory" || prop === "warmupAccount" || prop === "automationSession" || prop === "automationLog") {
      return new Proxy({}, {
        get: function(modelTarget, method) {
          if (method === "then" || method === "catch" || method === "finally" || typeof method === "symbol") {
            return void 0;
          }
          return async (...args) => {
            const { client, available } = await initializePrisma();
            if (available && client && client[prop]) {
              const modelClient = client[prop];
              if (typeof modelClient[method] === "function") {
                return modelClient[method](...args);
              }
            }
            throw new Error(`Prisma not available: Cannot execute ${String(prop)}.${String(method)}`);
          };
        }
      });
    }
    if (prop === "$transaction") {
      return async (...args) => {
        const { client, available } = await initializePrisma();
        if (available && client) {
          return client.$transaction(...args);
        }
        throw new Error("Prisma not available: Cannot execute transaction");
      };
    }
    return async (...args) => {
      const { client, available } = await initializePrisma();
      if (available && client && typeof client[prop] === "function") {
        return client[prop](...args);
      }
      throw new Error(`Prisma not available: Cannot execute ${String(prop)}`);
    };
  }
});
async function isPrismaAvailable() {
  if (_prismaAvailable !== null) {
    return _prismaAvailable;
  }
  const { available } = await initializePrisma();
  return available;
}
async function getPrismaClient() {
  const { client, available } = await initializePrisma();
  if (!available || !client) {
    throw new Error("Prisma client is not available");
  }
  return client;
}
initializePrisma().catch(() => {
});
async function getAccountStats() {
  const [total, statusCounts] = await Promise.all([
    prisma.igAccount.count(),
    prisma.igAccount.groupBy({
      by: ["status"],
      _count: {
        status: true
      }
    })
  ]);
  return {
    total,
    byStatus: statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {})
  };
}
async function createAccount(data) {
  return await prisma.igAccount.create({
    data: {
      recordId: data.recordId,
      instagramUsername: data.instagramUsername,
      instagramPassword: data.instagramPassword,
      emailAddress: data.emailAddress,
      emailPassword: data.emailPassword,
      status: data.status || "Unused",
      imapStatus: data.imapStatus || "On",
      assignedDeviceId: data.assignedDeviceId,
      assignedCloneNumber: data.assignedCloneNumber,
      assignedPackageName: data.assignedPackageName,
      assignmentTimestamp: data.assignedDeviceId ? /* @__PURE__ */ new Date() : null,
      // Account ownership and classification fields
      ownerId: data.ownerId || null,
      accountType: data.accountType || "CLIENT",
      visibility: data.visibility || "PRIVATE",
      isShared: data.isShared || false
    }
  });
}
async function getAccountById(id) {
  return await prisma.igAccount.findUnique({
    where: { id }
  });
}
async function getAccounts(limit = 20, offset = 0, statusFilter, searchQuery, advancedFilters) {
  const where = {};
  const searchClauses = [];
  if (statusFilter && !advancedFilters?.statuses) {
    where.status = statusFilter;
  }
  if (searchQuery && !advancedFilters?.search) {
    searchClauses.push(
      { instagramUsername: { contains: searchQuery, mode: "insensitive" } },
      { emailAddress: { contains: searchQuery, mode: "insensitive" } }
    );
  }
  if (advancedFilters) {
    if (advancedFilters.search) {
      searchClauses.push(
        { instagramUsername: { contains: advancedFilters.search, mode: "insensitive" } },
        { emailAddress: { contains: advancedFilters.search, mode: "insensitive" } },
        { assignedDeviceId: { contains: advancedFilters.search, mode: "insensitive" } }
      );
    }
    if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
      where.status = { in: advancedFilters.statuses };
    }
    if (advancedFilters.deviceAssignment) {
      switch (advancedFilters.deviceAssignment) {
        case "assigned":
          where.assignedDeviceId = { not: null };
          break;
        case "unassigned":
          where.assignedDeviceId = null;
          break;
        case "specific":
          if (advancedFilters.specificDevice) {
            where.assignedDeviceId = advancedFilters.specificDevice;
          }
          break;
      }
    }
    if (advancedFilters.createdDateFrom || advancedFilters.createdDateTo) {
      where.createdAt = {};
      if (advancedFilters.createdDateFrom) {
        where.createdAt.gte = advancedFilters.createdDateFrom;
      }
      if (advancedFilters.createdDateTo) {
        const endOfDay = new Date(advancedFilters.createdDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }
    if (advancedFilters.loginDateFrom || advancedFilters.loginDateTo) {
      where.loginTimestamp = {};
      if (advancedFilters.loginDateFrom) {
        where.loginTimestamp.gte = advancedFilters.loginDateFrom;
      }
      if (advancedFilters.loginDateTo) {
        const endOfDay = new Date(advancedFilters.loginDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        where.loginTimestamp.lte = endOfDay;
      }
    }
    if (advancedFilters.imapStatus && advancedFilters.imapStatus !== "all") {
      where.imapStatus = advancedFilters.imapStatus;
    }
    if (advancedFilters.ownerId !== void 0) {
      where.ownerId = advancedFilters.ownerId;
    }
    if (advancedFilters.accountTypes && advancedFilters.accountTypes.length > 0) {
      where.accountType = { in: advancedFilters.accountTypes };
    }
    if (!advancedFilters.includeMLAccounts) {
      if (where.accountType && where.accountType.in) {
        where.accountType.in = where.accountType.in.filter((type) => type !== "ML_TREND_FINDER");
      } else if (!where.accountType) {
        where.accountType = { not: "ML_TREND_FINDER" };
      }
    }
    if (advancedFilters.visibilityFilter && advancedFilters.visibilityFilter.length > 0) {
      where.visibility = { in: advancedFilters.visibilityFilter };
    }
    if (advancedFilters.includeShared === false) {
      where.isShared = false;
    } else if (advancedFilters.includeShared === true) ;
  }
  if (searchClauses.length > 0) {
    where.OR = searchClauses;
  }
  return await prisma.igAccount.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });
}
async function getAccountsCount(statusFilter, searchQuery, advancedFilters) {
  const where = {};
  const searchClauses = [];
  if (statusFilter && !advancedFilters?.statuses) {
    where.status = statusFilter;
  }
  if (searchQuery && !advancedFilters?.search) {
    searchClauses.push(
      { instagramUsername: { contains: searchQuery, mode: "insensitive" } },
      { emailAddress: { contains: searchQuery, mode: "insensitive" } }
    );
  }
  if (advancedFilters) {
    if (advancedFilters.search) {
      searchClauses.push(
        { instagramUsername: { contains: advancedFilters.search, mode: "insensitive" } },
        { emailAddress: { contains: advancedFilters.search, mode: "insensitive" } },
        { assignedDeviceId: { contains: advancedFilters.search, mode: "insensitive" } }
      );
    }
    if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
      where.status = { in: advancedFilters.statuses };
    }
    if (advancedFilters.deviceAssignment) {
      switch (advancedFilters.deviceAssignment) {
        case "assigned":
          where.assignedDeviceId = { not: null };
          break;
        case "unassigned":
          where.assignedDeviceId = null;
          break;
        case "specific":
          if (advancedFilters.specificDevice) {
            where.assignedDeviceId = advancedFilters.specificDevice;
          }
          break;
      }
    }
    if (advancedFilters.createdDateFrom || advancedFilters.createdDateTo) {
      where.createdAt = {};
      if (advancedFilters.createdDateFrom) {
        where.createdAt.gte = advancedFilters.createdDateFrom;
      }
      if (advancedFilters.createdDateTo) {
        const endOfDay = new Date(advancedFilters.createdDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }
    if (advancedFilters.loginDateFrom || advancedFilters.loginDateTo) {
      where.loginTimestamp = {};
      if (advancedFilters.loginDateFrom) {
        where.loginTimestamp.gte = advancedFilters.loginDateFrom;
      }
      if (advancedFilters.loginDateTo) {
        const endOfDay = new Date(advancedFilters.loginDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        where.loginTimestamp.lte = endOfDay;
      }
    }
    if (advancedFilters.imapStatus && advancedFilters.imapStatus !== "all") {
      where.imapStatus = advancedFilters.imapStatus;
    }
    if (advancedFilters.ownerId !== void 0) {
      where.ownerId = advancedFilters.ownerId;
    }
    if (advancedFilters.accountTypes && advancedFilters.accountTypes.length > 0) {
      where.accountType = { in: advancedFilters.accountTypes };
    }
    if (!advancedFilters.includeMLAccounts) {
      if (where.accountType && where.accountType.in) {
        where.accountType.in = where.accountType.in.filter((type) => type !== "ML_TREND_FINDER");
      } else if (!where.accountType) {
        where.accountType = { not: "ML_TREND_FINDER" };
      }
    }
    if (advancedFilters.visibilityFilter && advancedFilters.visibilityFilter.length > 0) {
      where.visibility = { in: advancedFilters.visibilityFilter };
    }
    if (advancedFilters.includeShared === false) {
      where.isShared = false;
    } else if (advancedFilters.includeShared === true) ;
  }
  if (searchClauses.length > 0) {
    where.OR = searchClauses;
  }
  return await prisma.igAccount.count({ where });
}
async function updateAccount(id, data) {
  const updateData = { ...data };
  if (data.assignedDeviceId && data.assignedDeviceId !== "") {
    updateData.assignmentTimestamp = /* @__PURE__ */ new Date();
  } else if (data.assignedDeviceId === "") {
    updateData.assignedDeviceId = null;
    updateData.assignedCloneNumber = null;
    updateData.assignedPackageName = null;
    updateData.assignmentTimestamp = null;
  }
  if (data.status === "Logged In") {
    updateData.loginTimestamp = /* @__PURE__ */ new Date();
  }
  return await prisma.igAccount.update({
    where: { id },
    data: updateData
  });
}
async function deleteAccount(id) {
  return await prisma.igAccount.delete({
    where: { id }
  });
}
async function checkUsernameExists(username, excludeId) {
  const where = { instagramUsername: username };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  const account = await prisma.igAccount.findFirst({ where });
  return !!account;
}
async function getAccountsForUser(userId, userRole, limit = 20, offset = 0) {
  if (userRole === "UNAUTHORIZED") {
    return { accounts: [], totalCount: 0 };
  }
  try {
    if (userRole === "ADMIN") {
      const advancedFilters = {
        includeMLAccounts: true
      };
      const [accounts2, totalCount2] = await Promise.all([
        getAccounts(limit, offset, void 0, void 0, advancedFilters),
        getAccountsCount(void 0, void 0, advancedFilters)
      ]);
      return { accounts: accounts2, totalCount: totalCount2 };
    }
    const where = {
      OR: [
        // User's own accounts
        {
          ownerId: userId.toString(),
          // Convert to string for user ID comparison
          accountType: { not: "ML_TREND_FINDER" }
          // Exclude ML accounts
        },
        // Shared accounts that are not ML accounts
        {
          isShared: true,
          visibility: { in: ["SHARED", "PUBLIC"] },
          accountType: { not: "ML_TREND_FINDER" }
        }
      ]
    };
    const [accounts, totalCount] = await Promise.all([
      prisma.igAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.igAccount.count({ where })
    ]);
    return { accounts, totalCount };
  } catch (error) {
    console.log("Prisma not available, falling back to direct SQL queries");
    return await getAccountsForUserDirectSQL(userId, userRole, limit, offset);
  }
}
async function getAccountsForUserDirectSQL(userId, userRole, limit = 20, offset = 0, userEmail) {
  const pg = await import('pg');
  const { Client } = pg.default;
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30"
  });
  try {
    await client.connect();
    if (userRole === "ADMIN") {
      const accountsQuery = `
				SELECT 
					id, instagram_username, instagram_password, email_address, email_password,
					status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
					assignment_timestamp, login_timestamp, created_at, updated_at,
					owner_id, account_type, visibility, is_shared, model
				FROM ig_accounts 
				ORDER BY created_at DESC 
				LIMIT $1 OFFSET $2
			`;
      const countQuery = `SELECT COUNT(*) as total FROM ig_accounts`;
      const [accountsResult, countResult] = await Promise.all([
        client.query(accountsQuery, [limit, offset]),
        client.query(countQuery)
      ]);
      return {
        accounts: accountsResult.rows.map((row) => mapDatabaseRowToAccount(row)),
        totalCount: parseInt(countResult.rows[0].total)
      };
    } else {
      let modelFilter = "";
      let queryParams = [userId.toString(), limit, offset];
      if (userEmail && userEmail.includes("@gmail.com")) ;
      const accountsQuery = `
				SELECT 
					id, instagram_username, instagram_password, email_address, email_password,
					status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
					assignment_timestamp, login_timestamp, created_at, updated_at,
					owner_id, account_type, visibility, is_shared, model
				FROM ig_accounts 
				WHERE (
					(owner_id = $1 AND account_type != 'ML_TREND_FINDER')
					OR 
					(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND account_type != 'ML_TREND_FINDER')
					${modelFilter}
				)
				ORDER BY created_at DESC 
				LIMIT $2 OFFSET $3
			`;
      const countQuery = `
				SELECT COUNT(*) as total 
				FROM ig_accounts 
				WHERE (
					(owner_id = $1 AND account_type != 'ML_TREND_FINDER')
					OR 
					(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND account_type != 'ML_TREND_FINDER')
					${modelFilter}
				)
			`;
      const [accountsResult, countResult] = await Promise.all([
        client.query(accountsQuery, queryParams),
        client.query(countQuery, [userId.toString()])
      ]);
      return {
        accounts: accountsResult.rows.map((row) => mapDatabaseRowToAccount(row)),
        totalCount: parseInt(countResult.rows[0].total)
      };
    }
  } finally {
    await client.end();
  }
}
function mapDatabaseRowToAccount(row) {
  return {
    id: row.id,
    recordId: row.record_id,
    instagramUsername: row.instagram_username,
    instagramPassword: row.instagram_password,
    emailAddress: row.email_address,
    emailPassword: row.email_password,
    status: row.status,
    imapStatus: row.imap_status,
    assignedDeviceId: row.assigned_device_id,
    assignedCloneNumber: row.assigned_clone_number,
    assignedPackageName: row.assigned_package_name,
    assignmentTimestamp: row.assignment_timestamp,
    loginTimestamp: row.login_timestamp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
    accountType: row.account_type,
    visibility: row.visibility,
    isShared: row.is_shared,
    model: row.model
  };
}
async function assignAccountToUser(accountId, userId, visibility = "PRIVATE") {
  return await updateAccount(accountId, {
    ownerId: userId,
    accountType: "CLIENT",
    visibility,
    isShared: visibility === "SHARED"
  });
}
async function unassignAccountFromUser(accountId) {
  return await updateAccount(accountId, {
    ownerId: null,
    visibility: "PRIVATE",
    isShared: false
  });
}
async function convertAccountToML(accountId) {
  return await updateAccount(accountId, {
    ownerId: null,
    accountType: "ML_TREND_FINDER",
    visibility: "PRIVATE",
    isShared: false
  });
}
async function getAccountOwnershipSummary() {
  const [
    totalAccounts,
    clientAccounts,
    mlAccounts,
    systemAccounts,
    unassignedAccounts,
    sharedAccounts
  ] = await Promise.all([
    prisma.igAccount.count(),
    prisma.igAccount.count({ where: { accountType: "CLIENT" } }),
    prisma.igAccount.count({ where: { accountType: "ML_TREND_FINDER" } }),
    prisma.igAccount.count({ where: { accountType: "SYSTEM" } }),
    prisma.igAccount.count({ where: { ownerId: null, accountType: "CLIENT" } }),
    prisma.igAccount.count({ where: { isShared: true } })
  ]);
  return {
    total: totalAccounts,
    byType: {
      CLIENT: clientAccounts,
      ML_TREND_FINDER: mlAccounts,
      SYSTEM: systemAccounts
    },
    unassigned: unassignedAccounts,
    shared: sharedAccounts
  };
}
async function getDeviceStats() {
  const allClones = await prisma.cloneInventory.findMany();
  const deviceMap = /* @__PURE__ */ new Map();
  allClones.forEach((clone) => {
    if (!deviceMap.has(clone.deviceId)) {
      deviceMap.set(clone.deviceId, []);
    }
    deviceMap.get(clone.deviceId).push(clone);
  });
  const totalDevices = deviceMap.size;
  const totalClones = allClones.length;
  const availableClones = allClones.filter((c2) => c2.cloneStatus === "Available").length;
  const assignedClones = allClones.filter((c2) => c2.cloneStatus === "Assigned").length;
  const loggedInClones = allClones.filter((c2) => c2.cloneStatus === "Logged In").length;
  const brokenClones = allClones.filter((c2) => c2.cloneStatus === "Broken").length;
  const clonesByStatus = allClones.reduce((acc, clone) => {
    acc[clone.cloneStatus] = (acc[clone.cloneStatus] || 0) + 1;
    return acc;
  }, {});
  const devicesByStatus = {
    "Available": 0,
    "Logged In": 0,
    "Maintenance": 0,
    "Broken": 0
  };
  deviceMap.forEach((clones) => {
    const deviceStatus = determineDeviceStatus(clones);
    devicesByStatus[deviceStatus]++;
  });
  return {
    totalDevices,
    totalClones,
    availableClones,
    assignedClones,
    loggedInClones,
    brokenClones,
    devicesByStatus,
    clonesByStatus
  };
}
function determineDeviceStatus(clones) {
  if (clones.some((c2) => c2.cloneStatus === "Broken" || c2.cloneHealth === "Broken")) {
    return "Broken";
  }
  if (clones.some((c2) => c2.cloneStatus === "Maintenance")) {
    return "Maintenance";
  }
  if (clones.some((c2) => c2.cloneStatus === "Logged In")) {
    return "Logged In";
  }
  return "Available";
}
async function getDeviceSummaries() {
  const allClones = await prisma.cloneInventory.findMany({
    orderBy: [
      { deviceId: "asc" },
      { cloneNumber: "asc" }
    ]
  });
  const deviceMap = /* @__PURE__ */ new Map();
  allClones.forEach((clone) => {
    if (!deviceMap.has(clone.deviceId)) {
      deviceMap.set(clone.deviceId, []);
    }
    deviceMap.get(clone.deviceId).push(clone);
  });
  const summaries = [];
  deviceMap.forEach((clones, deviceId) => {
    const totalClones = clones.length;
    const availableClones = clones.filter((c2) => c2.cloneStatus === "Available").length;
    const assignedClones = clones.filter((c2) => c2.cloneStatus === "Assigned").length;
    const loggedInClones = clones.filter((c2) => c2.cloneStatus === "Logged In").length;
    const brokenClones = clones.filter((c2) => c2.cloneStatus === "Broken").length;
    const deviceStatus = determineDeviceStatus(clones);
    const deviceName = clones[0].deviceName || null;
    const deviceHealth = clones[0].cloneHealth || null;
    const lastScanned = clones.reduce(
      (latest, clone) => clone.lastScanned > latest ? clone.lastScanned : latest,
      clones[0].lastScanned
    );
    summaries.push({
      deviceId,
      deviceName,
      totalClones,
      availableClones,
      assignedClones,
      loggedInClones,
      brokenClones,
      deviceStatus,
      deviceHealth,
      lastScanned
    });
  });
  return summaries.sort((a2, b2) => a2.deviceId.localeCompare(b2.deviceId));
}
async function getDeviceDetails(deviceId) {
  const clones = await prisma.cloneInventory.findMany({
    where: { deviceId },
    orderBy: { cloneNumber: "asc" }
  });
  if (clones.length === 0) {
    return { device: null, clones: [] };
  }
  const totalClones = clones.length;
  const availableClones = clones.filter((c2) => c2.cloneStatus === "Available").length;
  const assignedClones = clones.filter((c2) => c2.cloneStatus === "Assigned").length;
  const loggedInClones = clones.filter((c2) => c2.cloneStatus === "Logged In").length;
  const brokenClones = clones.filter((c2) => c2.cloneStatus === "Broken").length;
  const deviceStatus = determineDeviceStatus(clones);
  const deviceName = clones[0].deviceName || null;
  const deviceHealth = clones[0].cloneHealth || null;
  const lastScanned = clones.reduce(
    (latest, clone) => clone.lastScanned > latest ? clone.lastScanned : latest,
    clones[0].lastScanned
  );
  const device = {
    deviceId,
    deviceName,
    totalClones,
    availableClones,
    assignedClones,
    loggedInClones,
    brokenClones,
    deviceStatus,
    deviceHealth,
    lastScanned
  };
  return { device, clones };
}
async function assignAccountToClone(deviceId, cloneNumber, instagramUsername) {
  try {
    const [updateClone, updateAccount2] = await prisma.$transaction([
      // Update clone status
      prisma.cloneInventory.update({
        where: {
          deviceId_cloneNumber: {
            deviceId,
            cloneNumber
          }
        },
        data: {
          cloneStatus: "Assigned",
          currentAccount: instagramUsername,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }),
      // Update account assignment
      prisma.igAccount.updateMany({
        where: { instagramUsername },
        data: {
          status: "Assigned",
          assignedDeviceId: deviceId,
          assignedCloneNumber: cloneNumber,
          assignmentTimestamp: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }
      })
    ]);
    return true;
  } catch (error) {
    console.error("Failed to assign account to clone:", error);
    return false;
  }
}
async function unassignAccountFromClone(deviceId, cloneNumber) {
  try {
    const clone = await prisma.cloneInventory.findUnique({
      where: {
        deviceId_cloneNumber: {
          deviceId,
          cloneNumber
        }
      }
    });
    if (!clone || !clone.currentAccount) {
      return false;
    }
    await prisma.$transaction([
      // Update clone status
      prisma.cloneInventory.update({
        where: {
          deviceId_cloneNumber: {
            deviceId,
            cloneNumber
          }
        },
        data: {
          cloneStatus: "Available",
          currentAccount: null,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }),
      // Update account assignment
      prisma.igAccount.updateMany({
        where: { instagramUsername: clone.currentAccount },
        data: {
          status: "Unused",
          assignedDeviceId: null,
          assignedCloneNumber: null,
          assignmentTimestamp: null,
          updatedAt: /* @__PURE__ */ new Date()
        }
      })
    ]);
    return true;
  } catch (error) {
    console.error("Failed to unassign account from clone:", error);
    return false;
  }
}
async function updateCloneStatus(deviceId, cloneNumber, status) {
  try {
    await prisma.cloneInventory.update({
      where: {
        deviceId_cloneNumber: {
          deviceId,
          cloneNumber
        }
      },
      data: {
        cloneStatus: status,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    return true;
  } catch (error) {
    console.error("Failed to update clone status:", error);
    return false;
  }
}
async function getAvailableAccounts(limit = 20) {
  const accounts = await prisma.igAccount.findMany({
    where: { status: "Unused" },
    select: {
      id: true,
      instagramUsername: true,
      status: true
    },
    orderBy: { instagramUsername: "asc" },
    take: limit
  });
  return accounts;
}
async function getDeviceList() {
  const devices = await prisma.cloneInventory.groupBy({
    by: ["deviceId", "deviceName"],
    orderBy: {
      deviceId: "asc"
    }
  });
  return devices.map((device) => ({
    deviceId: device.deviceId,
    deviceName: device.deviceName
  }));
}
async function getDeviceCapacityAnalysis() {
  const allClones = await prisma.cloneInventory.findMany({
    orderBy: [
      { deviceId: "asc" },
      { cloneNumber: "asc" }
    ]
  });
  const deviceMap = /* @__PURE__ */ new Map();
  allClones.forEach((clone) => {
    if (!deviceMap.has(clone.deviceId)) {
      deviceMap.set(clone.deviceId, []);
    }
    deviceMap.get(clone.deviceId).push(clone);
  });
  const capacityAnalysis = [];
  deviceMap.forEach((clones, deviceId) => {
    const totalClones = clones.length;
    const availableClones = clones.filter((c2) => c2.cloneStatus === "Available").length;
    const assignedClones = clones.filter((c2) => c2.cloneStatus === "Assigned").length;
    const loggedInClones = clones.filter((c2) => c2.cloneStatus === "Logged In").length;
    const brokenClones = clones.filter((c2) => c2.cloneStatus === "Broken").length;
    const deviceStatus = determineDeviceStatus(clones);
    const deviceName = clones[0].deviceName || null;
    const activeClones = assignedClones + loggedInClones;
    const utilizationRate = totalClones > 0 ? activeClones / totalClones * 100 : 0;
    let efficiency = 100;
    if (deviceStatus === "Broken") efficiency -= 50;
    if (deviceStatus === "Maintenance") efficiency -= 30;
    if (availableClones > 0) efficiency += 10;
    if (utilizationRate > 10 && utilizationRate < 90) efficiency += 5;
    const brokenRate = totalClones > 0 ? brokenClones / totalClones * 100 : 0;
    efficiency -= brokenRate * 0.5;
    efficiency = Math.max(0, Math.min(100, efficiency));
    capacityAnalysis.push({
      deviceId,
      deviceName,
      totalClones,
      availableClones,
      assignedClones,
      loggedInClones,
      brokenClones,
      deviceStatus,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100
    });
  });
  return capacityAnalysis.sort((a2, b2) => a2.deviceId.localeCompare(b2.deviceId));
}
async function getOptimalDeviceAssignments(accountIds, strategy = "capacity-based") {
  if (accountIds.length === 0) {
    return [];
  }
  const accounts = await prisma.igAccount.findMany({
    where: {
      id: { in: accountIds },
      status: "Unused",
      assignedDeviceId: null
    },
    select: {
      id: true,
      instagramUsername: true
    }
  });
  if (accounts.length === 0) {
    return [];
  }
  const availableClones = await prisma.cloneInventory.findMany({
    where: { cloneStatus: "Available" },
    orderBy: [
      { deviceId: "asc" },
      { cloneNumber: "asc" }
    ]
  });
  if (availableClones.length === 0) {
    return [];
  }
  const deviceCapacity = await getDeviceCapacityAnalysis();
  new Map(deviceCapacity.map((d) => [d.deviceId, d]));
  const assignments = [];
  let cloneIndex = 0;
  const sortedAccounts = [...accounts].sort((a2, b2) => a2.instagramUsername.localeCompare(b2.instagramUsername));
  switch (strategy) {
    case "round-robin": {
      const deviceIds = [...new Set(availableClones.map((c2) => c2.deviceId))].sort();
      let currentDeviceIndex = 0;
      for (const account of sortedAccounts) {
        if (cloneIndex >= availableClones.length) break;
        let attempts = 0;
        while (attempts < deviceIds.length) {
          const targetDeviceId = deviceIds[currentDeviceIndex];
          const availableClone = availableClones.slice(cloneIndex).find((c2) => c2.deviceId === targetDeviceId);
          if (availableClone) {
            assignments.push({
              accountId: account.id,
              instagramUsername: account.instagramUsername,
              deviceId: availableClone.deviceId,
              cloneNumber: availableClone.cloneNumber,
              packageName: availableClone.packageName
            });
            const removeIndex = availableClones.findIndex(
              (c2) => c2.deviceId === availableClone.deviceId && c2.cloneNumber === availableClone.cloneNumber
            );
            if (removeIndex >= 0) {
              availableClones.splice(removeIndex, 1);
            }
            break;
          }
          currentDeviceIndex = (currentDeviceIndex + 1) % deviceIds.length;
          attempts++;
        }
        currentDeviceIndex = (currentDeviceIndex + 1) % deviceIds.length;
      }
      break;
    }
    case "fill-first": {
      const sortedClones = [...availableClones].sort(
        (a2, b2) => a2.deviceId.localeCompare(b2.deviceId) || a2.cloneNumber - b2.cloneNumber
      );
      for (let i = 0; i < sortedAccounts.length && i < sortedClones.length; i++) {
        const account = sortedAccounts[i];
        const clone = sortedClones[i];
        assignments.push({
          accountId: account.id,
          instagramUsername: account.instagramUsername,
          deviceId: clone.deviceId,
          cloneNumber: clone.cloneNumber,
          packageName: clone.packageName
        });
      }
      break;
    }
    case "capacity-based": {
      const deviceEfficiencyOrder = deviceCapacity.filter((d) => d.availableClones > 0 && d.deviceStatus !== "Broken").sort((a2, b2) => {
        if (b2.efficiency !== a2.efficiency) {
          return b2.efficiency - a2.efficiency;
        }
        if (b2.availableClones !== a2.availableClones) {
          return b2.availableClones - a2.availableClones;
        }
        return a2.deviceId.localeCompare(b2.deviceId);
      });
      const clonesByDevice = /* @__PURE__ */ new Map();
      availableClones.forEach((clone) => {
        if (!clonesByDevice.has(clone.deviceId)) {
          clonesByDevice.set(clone.deviceId, []);
        }
        clonesByDevice.get(clone.deviceId).push(clone);
      });
      clonesByDevice.forEach((clones) => {
        clones.sort((a2, b2) => a2.cloneNumber - b2.cloneNumber);
      });
      let accountIndex = 0;
      for (const deviceCapacity2 of deviceEfficiencyOrder) {
        const deviceClones = clonesByDevice.get(deviceCapacity2.deviceId) || [];
        for (const clone of deviceClones) {
          if (accountIndex >= sortedAccounts.length) break;
          const account = sortedAccounts[accountIndex];
          assignments.push({
            accountId: account.id,
            instagramUsername: account.instagramUsername,
            deviceId: clone.deviceId,
            cloneNumber: clone.cloneNumber,
            packageName: clone.packageName
          });
          accountIndex++;
        }
        if (accountIndex >= sortedAccounts.length) break;
      }
      break;
    }
  }
  return assignments;
}
async function validateAssignmentFeasibility(accountIds) {
  const result = {
    isValid: true,
    canAssign: 0,
    totalRequested: accountIds.length,
    errors: [],
    warnings: []
  };
  if (accountIds.length === 0) {
    result.errors.push("No accounts specified for assignment");
    result.isValid = false;
    return result;
  }
  try {
    const accounts = await prisma.igAccount.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        instagramUsername: true,
        status: true,
        assignedDeviceId: true
      }
    });
    if (accounts.length !== accountIds.length) {
      const foundIds = accounts.map((a2) => a2.id);
      const missingIds = accountIds.filter((id) => !foundIds.includes(id));
      result.errors.push(`Accounts not found: ${missingIds.join(", ")}`);
    }
    const unavailableAccounts = accounts.filter(
      (a2) => a2.status !== "Unused" || a2.assignedDeviceId !== null
    );
    if (unavailableAccounts.length > 0) {
      result.errors.push(
        `Accounts not available for assignment: ${unavailableAccounts.map((a2) => a2.instagramUsername).join(", ")}`
      );
    }
    const availableAccountCount = accounts.length - unavailableAccounts.length;
    const availableClones = await prisma.cloneInventory.count({
      where: { cloneStatus: "Available" }
    });
    if (availableClones === 0) {
      result.errors.push("No available clones for assignment");
    }
    result.canAssign = Math.min(availableAccountCount, availableClones);
    if (result.canAssign < result.totalRequested) {
      const shortage = result.totalRequested - result.canAssign;
      result.warnings.push(`Can only assign ${result.canAssign} of ${result.totalRequested} accounts (shortage: ${shortage})`);
    }
    if (availableClones < result.totalRequested) {
      result.warnings.push(`Only ${availableClones} clones available for ${result.totalRequested} accounts`);
    }
    const deviceCapacity = await getDeviceCapacityAnalysis();
    const brokenDevices = deviceCapacity.filter((d) => d.deviceStatus === "Broken");
    if (brokenDevices.length > 0) {
      result.warnings.push(`${brokenDevices.length} devices are in broken status and unavailable`);
    }
    const maintenanceDevices = deviceCapacity.filter((d) => d.deviceStatus === "Maintenance");
    if (maintenanceDevices.length > 0) {
      result.warnings.push(`${maintenanceDevices.length} devices are in maintenance and may have limited availability`);
    }
    if (result.errors.length > 0) {
      result.isValid = false;
    }
    return result;
  } catch (error) {
    console.error("Error validating assignment feasibility:", error);
    result.isValid = false;
    result.errors.push("Failed to validate assignment feasibility due to database error");
    return result;
  }
}
async function assignAccountsToDevicesAutomatically(accountIds, strategy = "capacity-based") {
  const result = {
    success: false,
    assignedCount: 0,
    totalRequested: accountIds.length,
    assignments: [],
    errors: [],
    failedAccounts: []
  };
  try {
    const validation = await validateAssignmentFeasibility(accountIds);
    if (!validation.isValid) {
      result.errors = validation.errors;
      return result;
    }
    const optimalAssignments = await getOptimalDeviceAssignments(accountIds, strategy);
    if (optimalAssignments.length === 0) {
      result.errors.push("No optimal assignments found");
      return result;
    }
    await prisma.$transaction(async (tx) => {
      for (const assignment of optimalAssignments) {
        try {
          await tx.cloneInventory.update({
            where: {
              deviceId_cloneNumber: {
                deviceId: assignment.deviceId,
                cloneNumber: assignment.cloneNumber
              }
            },
            data: {
              cloneStatus: "Assigned",
              currentAccount: assignment.instagramUsername,
              updatedAt: /* @__PURE__ */ new Date()
            }
          });
          await tx.igAccount.update({
            where: { id: assignment.accountId },
            data: {
              status: "Assigned",
              assignedDeviceId: assignment.deviceId,
              assignedCloneNumber: assignment.cloneNumber,
              assignedPackageName: assignment.packageName,
              assignmentTimestamp: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date()
            }
          });
          result.assignments.push(assignment);
          result.assignedCount++;
        } catch (assignmentError) {
          console.error(`Failed to assign account ${assignment.instagramUsername}:`, assignmentError);
          result.failedAccounts.push({
            accountId: assignment.accountId,
            instagramUsername: assignment.instagramUsername,
            error: assignmentError instanceof Error ? assignmentError.message : "Unknown assignment error"
          });
        }
      }
    });
    result.success = result.assignedCount > 0;
    if (result.failedAccounts.length > 0) {
      result.errors.push(`Failed to assign ${result.failedAccounts.length} accounts`);
    }
    return result;
  } catch (error) {
    console.error("Error in automatic assignment:", error);
    result.errors.push("Transaction failed during automatic assignment");
    const processedAccountIds = result.assignments.map((a2) => a2.accountId);
    const unprocessedIds = accountIds.filter((id) => !processedAccountIds.includes(id));
    for (const accountId of unprocessedIds) {
      result.failedAccounts.push({
        accountId,
        instagramUsername: `Account-${accountId}`,
        error: "Assignment transaction was rolled back"
      });
    }
    return result;
  }
}

export { assignAccountToClone, assignAccountToUser, assignAccountsToDevicesAutomatically, checkUsernameExists, convertAccountToML, createAccount, deleteAccount, getAccountById, getAccountOwnershipSummary, getAccountStats, getAccounts, getAccountsCount, getAccountsForUser, getAvailableAccounts, getDeviceCapacityAnalysis, getDeviceDetails, getDeviceList, getDeviceStats, getDeviceSummaries, getOptimalDeviceAssignments, getPrismaClient, isPrismaAvailable, prisma, unassignAccountFromClone, unassignAccountFromUser, updateAccount, updateCloneStatus, validateAssignmentFeasibility };
//# sourceMappingURL=database-CKYbeswu.js.map
