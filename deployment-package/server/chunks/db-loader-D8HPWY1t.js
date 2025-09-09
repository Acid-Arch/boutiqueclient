export { A as ACCOUNT_STATUSES, C as CLONE_HEALTH, a as CLONE_STATUSES, D as DEVICE_STATUSES } from './status-BUw8K8Dp.js';

let dbModule = null;
let fallbackModule = null;
let usingFallback = false;
if (process.env.DATABASE_URL?.includes("5.78.151.248")) {
  console.log("🔧 Hetzner database detected, forcing fallback mode");
  usingFallback = true;
}
async function getDbModule() {
  if (dbModule && !usingFallback) return dbModule;
  if (fallbackModule && usingFallback) return fallbackModule;
  try {
    dbModule = await import('./database-CKYbeswu.js');
    const isPrismaWorking = await dbModule.isPrismaAvailable();
    if (isPrismaWorking) {
      console.log("✅ Using Prisma database module");
      usingFallback = false;
      return dbModule;
    } else {
      throw new Error("Prisma not available, switching to fallback");
    }
  } catch (error) {
    console.log("⚠️  Prisma not available, using fallback database connection");
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("📋 Fallback reason:", errorMessage);
    if (!fallbackModule) {
      fallbackModule = await import('./database-fallback-D0uHIhN9.js');
    }
    usingFallback = true;
    return fallbackModule;
  }
}
async function getDb() {
  return await getDbModule();
}
async function getAccountStats() {
  const db = await getDbModule();
  return db.getAccountStats();
}
async function getAccounts(limit, offset, statusFilter, searchQuery, advancedFilters) {
  const db = await getDbModule();
  return db.getAccounts(limit, offset, statusFilter, searchQuery, advancedFilters);
}
async function getAccountsCount(statusFilter, searchQuery, advancedFilters) {
  const db = await getDbModule();
  return db.getAccountsCount(statusFilter, searchQuery, advancedFilters);
}
async function getAccountById(id) {
  const db = await getDbModule();
  return db.getAccountById(id);
}
async function createAccount(data) {
  const db = await getDbModule();
  return db.createAccount(data);
}
async function updateAccount(id, data) {
  const db = await getDbModule();
  return db.updateAccount(id, data);
}
async function deleteAccount(id) {
  const db = await getDbModule();
  return db.deleteAccount(id);
}
async function checkUsernameExists(username, excludeId) {
  const db = await getDbModule();
  return db.checkUsernameExists(username, excludeId);
}
async function getAvailableAccounts(limit) {
  const db = await getDbModule();
  return db.getAvailableAccounts(limit);
}
async function getDeviceSummaries() {
  const db = await getDbModule();
  return db.getDeviceSummaries();
}
async function getDeviceStats() {
  const db = await getDbModule();
  return db.getDeviceStats();
}
async function getDeviceDetails(deviceId) {
  const db = await getDbModule();
  return db.getDeviceDetails(deviceId);
}
async function updateCloneStatus(deviceId, cloneNumber, status) {
  const db = await getDbModule();
  return db.updateCloneStatus(deviceId, cloneNumber, status);
}
async function assignAccountToClone(accountId, deviceId, cloneNumber) {
  const db = await getDbModule();
  return db.assignAccountToClone(accountId, deviceId, cloneNumber);
}
async function getPrisma() {
  const db = await getDbModule();
  if (usingFallback && fallbackModule) {
    return fallbackModule.prisma;
  }
  if (dbModule && !usingFallback) {
    try {
      const isPrismaWorking = await dbModule.isPrismaAvailable();
      if (isPrismaWorking) {
        return dbModule.prisma;
      } else {
        console.log("⚠️  Prisma failed during getPrisma(), switching to fallback");
        if (!fallbackModule) {
          fallbackModule = await import('./database-fallback-D0uHIhN9.js');
        }
        usingFallback = true;
        return fallbackModule.prisma;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log("⚠️  Prisma error in getPrisma(), using fallback:", errorMessage);
      if (!fallbackModule) {
        fallbackModule = await import('./database-fallback-D0uHIhN9.js');
      }
      usingFallback = true;
      return fallbackModule.prisma;
    }
  }
  return db.prisma;
}
let _prisma = null;
let _prismaPromise = null;
async function initializePrisma() {
  if (_prismaPromise) return _prismaPromise;
  _prismaPromise = (async () => {
    try {
      const db = await getDbModule();
      if (usingFallback && fallbackModule) {
        _prisma = fallbackModule.prisma;
        console.log("✅ Using fallback prisma interface");
        return _prisma;
      }
      if (!usingFallback && dbModule) {
        const isPrismaWorking = await dbModule.isPrismaAvailable();
        if (isPrismaWorking) {
          _prisma = dbModule.prisma;
          console.log("✅ Prisma initialized successfully");
          return _prisma;
        }
      }
      if (!fallbackModule) {
        fallbackModule = await import('./database-fallback-D0uHIhN9.js');
      }
      usingFallback = true;
      _prisma = fallbackModule.prisma;
      console.log("✅ Using fallback prisma interface");
      return _prisma;
    } catch (err) {
      console.log("⚠️  Prisma initialization failed, using fallback:", err);
      if (!fallbackModule) {
        fallbackModule = await import('./database-fallback-D0uHIhN9.js');
      }
      usingFallback = true;
      _prisma = fallbackModule.prisma;
      console.log("✅ Using fallback prisma interface");
      return _prisma;
    }
  })();
  return _prismaPromise;
}
const prisma = new Proxy({}, {
  get: function(target, prop) {
    if (_prisma === null) {
      throw new Error(`Prisma not yet initialized. Please await getPrisma() first or use the database functions from db-loader instead.`);
    }
    if (_prisma && _prisma[prop]) {
      return _prisma[prop];
    }
    throw new Error(`Property ${String(prop)} not found on prisma instance`);
  }
});
initializePrisma();
async function query(sql, params = []) {
  const db = await getDbModule();
  return db.query(sql, params);
}

export { assignAccountToClone, checkUsernameExists, createAccount, deleteAccount, getAccountById, getAccountStats, getAccounts, getAccountsCount, getAvailableAccounts, getDb, getDeviceDetails, getDeviceStats, getDeviceSummaries, getPrisma, prisma, query, updateAccount, updateCloneStatus };
//# sourceMappingURL=db-loader-D8HPWY1t.js.map
