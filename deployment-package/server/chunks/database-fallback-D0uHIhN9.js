import pg from 'pg';
import { m as monitoredQuery } from './db-security-logger-C-Isx1J6.js';
export { A as ACCOUNT_STATUSES, C as CLONE_HEALTH, a as CLONE_STATUSES, D as DEVICE_STATUSES, g as getCloneStatusClass, b as getDeviceStatusClass, c as getStatusClass } from './status-BUw8K8Dp.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

const { Pool } = pg;
const sslRequired = process.env.DATABASE_URL?.includes("sslmode=require") && !process.env.DATABASE_URL?.includes("sslmode=disable");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || (() => {
    throw new Error("DATABASE_URL environment variable is required");
  })(),
  max: parseInt(process.env.DB_POOL_MAX || "20"),
  // Configurable connection pool size
  min: parseInt(process.env.DB_POOL_MIN || "5"),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || "5000"),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000"),
  // Enhanced SSL configuration for security
  ssl: sslRequired ? {
    rejectUnauthorized: process.env.NODE_ENV === "production",
    // Strict in production
    checkServerIdentity: process.env.NODE_ENV === "production" ? void 0 : () => void 0,
    ca: process.env.DB_SSL_CA_CERT,
    // Support for CA certificate
    cert: process.env.DB_SSL_CLIENT_CERT,
    // Client certificate
    key: process.env.DB_SSL_CLIENT_KEY
    // Client private key
  } : false
});
pool.on("error", (err, client) => {
  console.error("Unexpected database error on idle client:", err);
});
pool.on("connect", (client) => {
  console.log("Database connection established via fallback pool");
});
async function withRetry(operation, maxRetries = 3) {
  let lastError = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries && isRetryableError(error)) {
        const delay = Math.pow(2, i) * 1e3;
        console.warn(`Database operation failed, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries + 1}):`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  throw lastError || new Error("Operation failed after retries");
}
function isRetryableError(error) {
  if (!error) return false;
  const retryableCodes = ["ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED"];
  return retryableCodes.includes(error.code) || error instanceof Error && error.message.includes("connection");
}
async function getAccountStats() {
  const client = await pool.connect();
  try {
    const totalResult = await client.query("SELECT COUNT(*) as total FROM ig_accounts");
    const statusResult = await client.query(`
			SELECT status, COUNT(*) as count 
			FROM ig_accounts 
			GROUP BY status 
			ORDER BY count DESC
		`);
    const total = parseInt(totalResult.rows[0].total);
    const byStatus = statusResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});
    return { total, byStatus };
  } finally {
    client.release();
  }
}
function buildWhereClause(where) {
  const conditions = [];
  const params = [];
  let paramCount = 0;
  function addCondition(key, value, operator = "=") {
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (value === null) {
      conditions.push(`${dbKey} IS NULL`);
    } else if (value !== void 0) {
      paramCount++;
      if (operator === "IN" && Array.isArray(value)) {
        const placeholders = value.map((_, index) => {
          return `$${paramCount + index}`;
        });
        conditions.push(`${dbKey} IN (${placeholders.join(", ")})`);
        params.push(...value);
        paramCount += value.length - 1;
      } else {
        conditions.push(`${dbKey} ${operator} $${paramCount}`);
        params.push(value);
      }
    }
  }
  function processWhereConditions(whereObj) {
    for (const [key, value] of Object.entries(whereObj)) {
      if (key === "OR") {
        const orConditions = [];
        for (const orCondition of value) {
          const { whereClause: subWhere, params: subParams } = buildWhereClause(orCondition);
          if (subWhere) {
            orConditions.push(`(${subWhere})`);
            params.push(...subParams);
            paramCount += subParams.length;
          }
        }
        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(" OR ")})`);
        }
      } else if (key === "AND") {
        for (const andCondition of value) {
          for (const subCondition of andCondition.AND || [andCondition]) {
            processWhereConditions(subCondition);
          }
        }
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        if ("in" in value) {
          addCondition(key, value.in, "IN");
        } else if ("notIn" in value) {
          addCondition(key, value.notIn, "NOT IN");
        } else if ("not" in value) {
          addCondition(key, value.not, "!=");
        } else if ("contains" in value) {
          paramCount++;
          const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
          const valueObj = value;
          const ilike = valueObj.mode === "insensitive" ? "ILIKE" : "LIKE";
          conditions.push(`${dbKey} ${ilike} $${paramCount}`);
          params.push(`%${valueObj.contains}%`);
        } else if ("gte" in value) {
          addCondition(key, value.gte, ">=");
        } else if ("lte" in value) {
          addCondition(key, value.lte, "<=");
        } else if ("gt" in value) {
          addCondition(key, value.gt, ">");
        } else if ("lt" in value) {
          addCondition(key, value.lt, "<");
        }
      } else {
        addCondition(key, value);
      }
    }
  }
  processWhereConditions(where);
  return {
    whereClause: conditions.join(" AND "),
    params
  };
}
function buildSetClause(data, startParamCount = 0) {
  const setClauses = [];
  const params = [];
  let paramCount = startParamCount;
  for (const [key, value] of Object.entries(data)) {
    if (value !== void 0 && key !== "updatedAt") {
      paramCount++;
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      setClauses.push(`${dbKey} = $${paramCount}`);
      params.push(value);
    }
  }
  return {
    setClause: setClauses.join(", "),
    params
  };
}
function buildOrderByClause(orderBy) {
  const clauses = [];
  for (const [key, direction] of Object.entries(orderBy)) {
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    clauses.push(`${dbKey} ${direction}`);
  }
  return clauses.join(", ");
}
function buildCloneWhereClause(where) {
  const conditions = [];
  const params = [];
  let paramCount = 0;
  function addCondition(key, value, operator = "=") {
    let dbKey = key;
    switch (key) {
      case "deviceId":
        dbKey = "device_id";
        break;
      case "deviceId_cloneNumber":
        if (typeof value === "object" && value.deviceId && value.cloneNumber !== void 0) {
          paramCount++;
          conditions.push(`device_id = $${paramCount}`);
          params.push(value.deviceId);
          paramCount++;
          conditions.push(`clone_number = $${paramCount}`);
          params.push(value.cloneNumber);
        }
        return;
      case "cloneNumber":
        dbKey = "clone_number";
        break;
      case "cloneStatus":
        dbKey = "clone_status";
        break;
      case "cloneHealth":
        dbKey = "clone_health";
        break;
      case "currentAccount":
        dbKey = "current_account";
        break;
      case "packageName":
        dbKey = "package_name";
        break;
      case "lastScanned":
        dbKey = "last_scanned";
        break;
      case "updatedAt":
        dbKey = "updated_at";
        break;
    }
    if (value === null) {
      conditions.push(`${dbKey} IS NULL`);
    } else if (value !== void 0) {
      paramCount++;
      if (operator === "IN" && Array.isArray(value)) {
        const placeholders = value.map((_, index) => {
          return `$${paramCount + index}`;
        });
        conditions.push(`${dbKey} IN (${placeholders.join(", ")})`);
        params.push(...value);
        paramCount += value.length - 1;
      } else {
        conditions.push(`${dbKey} ${operator} $${paramCount}`);
        params.push(value);
      }
    }
  }
  function processWhereConditions(whereObj) {
    for (const [key, value] of Object.entries(whereObj)) {
      if (key === "OR") {
        const orConditions = [];
        for (const orCondition of value) {
          const { whereClause: subWhere, params: subParams } = buildCloneWhereClause(orCondition);
          if (subWhere) {
            orConditions.push(`(${subWhere})`);
            params.push(...subParams);
            paramCount += subParams.length;
          }
        }
        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(" OR ")})`);
        }
      } else if (key === "AND") {
        for (const andCondition of value) {
          for (const subCondition of andCondition.AND || [andCondition]) {
            processWhereConditions(subCondition);
          }
        }
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        if ("in" in value) {
          addCondition(key, value.in, "IN");
        } else if ("notIn" in value) {
          addCondition(key, value.notIn, "NOT IN");
        } else if ("not" in value) {
          addCondition(key, value.not, "!=");
        }
      } else {
        addCondition(key, value);
      }
    }
  }
  processWhereConditions(where);
  return {
    whereClause: conditions.join(" AND "),
    params
  };
}
function buildCloneSetClause(data, startParamCount = 0) {
  const setClauses = [];
  const params = [];
  let paramCount = startParamCount;
  for (const [key, value] of Object.entries(data)) {
    if (value !== void 0 && key !== "updatedAt") {
      paramCount++;
      let dbKey = key;
      switch (key) {
        case "cloneStatus":
          dbKey = "clone_status";
          break;
        case "currentAccount":
          dbKey = "current_account";
          break;
      }
      setClauses.push(`${dbKey} = $${paramCount}`);
      params.push(value);
    }
  }
  return {
    setClause: setClauses.join(", "),
    params
  };
}
function buildCloneOrderByClause(orderBy) {
  const clauses = [];
  if (Array.isArray(orderBy)) {
    for (const orderItem of orderBy) {
      for (const [key, direction] of Object.entries(orderItem)) {
        let dbKey = key;
        switch (key) {
          case "deviceId":
            dbKey = "device_id";
            break;
          case "cloneNumber":
            dbKey = "clone_number";
            break;
        }
        clauses.push(`${dbKey} ${direction}`);
      }
    }
  } else {
    for (const [key, direction] of Object.entries(orderBy)) {
      let dbKey = key;
      switch (key) {
        case "deviceId":
          dbKey = "device_id";
          break;
        case "cloneNumber":
          dbKey = "clone_number";
          break;
      }
      clauses.push(`${dbKey} ${direction}`);
    }
  }
  return clauses.join(", ");
}
function mapDbRowToAccount(row) {
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
    updatedAt: row.updated_at
  };
}
function mapDbRowToClone(row) {
  return {
    deviceId: row.device_id,
    deviceName: row.device_name,
    cloneNumber: row.clone_number,
    cloneStatus: row.clone_status,
    cloneHealth: row.clone_health,
    currentAccount: row.current_account,
    packageName: row.package_name,
    lastScanned: row.last_scanned,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  };
}
const prisma = {
  igAccount: {
    count: async (options = {}) => {
      const client = await pool.connect();
      try {
        let query2 = "SELECT COUNT(*) as count FROM ig_accounts";
        const { whereClause, params } = buildWhereClause(options.where || {});
        if (whereClause) {
          query2 += ` WHERE ${whereClause}`;
        }
        const result = await client.query(query2, params);
        return parseInt(result.rows[0].count);
      } finally {
        client.release();
      }
    },
    findMany: async (options = {}) => {
      const client = await pool.connect();
      try {
        let query2 = "SELECT * FROM ig_accounts";
        const { whereClause, params } = buildWhereClause(options.where || {});
        let paramCount = params.length;
        if (whereClause) {
          query2 += ` WHERE ${whereClause}`;
        }
        if (options.orderBy) {
          const orderByClauses = buildOrderByClause(options.orderBy);
          if (orderByClauses) {
            query2 += ` ORDER BY ${orderByClauses}`;
          }
        }
        if (options.take) {
          paramCount++;
          query2 += ` LIMIT $${paramCount}`;
          params.push(options.take);
        }
        if (options.skip) {
          paramCount++;
          query2 += ` OFFSET $${paramCount}`;
          params.push(options.skip);
        }
        const result = await client.query(query2, params);
        return result.rows.map(mapDbRowToAccount);
      } finally {
        client.release();
      }
    },
    findFirst: async (options = {}) => {
      const client = await pool.connect();
      try {
        let query2 = "SELECT * FROM ig_accounts";
        const { whereClause, params } = buildWhereClause(options.where || {});
        let paramCount = params.length;
        if (whereClause) {
          query2 += ` WHERE ${whereClause}`;
        }
        if (options.orderBy) {
          const orderByClauses = buildOrderByClause(options.orderBy);
          if (orderByClauses) {
            query2 += ` ORDER BY ${orderByClauses}`;
          }
        }
        query2 += " LIMIT 1";
        const result = await client.query(query2, params);
        return result.rows.length > 0 ? mapDbRowToAccount(result.rows[0]) : null;
      } finally {
        client.release();
      }
    },
    update: async (options) => {
      const client = await pool.connect();
      try {
        const { whereClause, params: whereParams } = buildWhereClause(options.where);
        const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
        if (!whereClause || !setClause) {
          throw new Error("Invalid update parameters");
        }
        const query2 = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
        const allParams = [...whereParams, ...setParams];
        const result = await client.query(query2, allParams);
        return result.rows.length > 0 ? mapDbRowToAccount(result.rows[0]) : null;
      } finally {
        client.release();
      }
    },
    updateMany: async (options) => {
      const client = await pool.connect();
      try {
        const { whereClause, params: whereParams } = buildWhereClause(options.where);
        const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
        if (!whereClause || !setClause) {
          throw new Error("Invalid updateMany parameters");
        }
        const query2 = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
        const allParams = [...whereParams, ...setParams];
        const result = await client.query(query2, allParams);
        return { count: result.rowCount || 0 };
      } finally {
        client.release();
      }
    },
    deleteMany: async (options) => {
      const client = await pool.connect();
      try {
        const { whereClause, params } = buildWhereClause(options.where);
        if (!whereClause) {
          throw new Error("DELETE requires WHERE clause for safety");
        }
        const query2 = `DELETE FROM ig_accounts WHERE ${whereClause}`;
        const result = await client.query(query2, params);
        return { count: result.rowCount || 0 };
      } finally {
        client.release();
      }
    },
    groupBy: async (options) => {
      const client = await pool.connect();
      try {
        const { whereClause, params } = buildWhereClause(options.where || {});
        const groupByFields = options.by.map((field) => {
          return field.replace(/([A-Z])/g, "_$1").toLowerCase();
        });
        let selectClause = groupByFields.join(", ");
        if (options._count) {
          for (const [countField, _] of Object.entries(options._count)) {
            const dbField = countField.replace(/([A-Z])/g, "_$1").toLowerCase();
            selectClause += `, COUNT(${dbField}) as _count_${dbField}`;
          }
        }
        let query2 = `SELECT ${selectClause} FROM ig_accounts`;
        if (whereClause) {
          query2 += ` WHERE ${whereClause}`;
        }
        query2 += ` GROUP BY ${groupByFields.join(", ")}`;
        const result = await client.query(query2, params);
        return result.rows.map((row) => {
          const transformed = {};
          options.by.forEach((field, index) => {
            const dbField = groupByFields[index];
            transformed[field] = row[dbField];
          });
          if (options._count) {
            transformed._count = {};
            for (const countField of Object.keys(options._count)) {
              const dbField = countField.replace(/([A-Z])/g, "_$1").toLowerCase();
              transformed._count[countField] = parseInt(row[`_count_${dbField}`]);
            }
          }
          return transformed;
        });
      } finally {
        client.release();
      }
    }
  },
  cloneInventory: {
    count: async (options = {}) => {
      const client = await pool.connect();
      try {
        let query2 = "SELECT COUNT(*) as count FROM clone_inventory";
        const { whereClause, params } = buildCloneWhereClause(options.where || {});
        if (whereClause) {
          query2 += ` WHERE ${whereClause}`;
        }
        const result = await client.query(query2, params);
        return parseInt(result.rows[0].count);
      } finally {
        client.release();
      }
    },
    findMany: async (options = {}) => {
      const client = await pool.connect();
      try {
        let query2 = "SELECT * FROM clone_inventory";
        const { whereClause, params } = buildCloneWhereClause(options.where || {});
        let paramCount = params.length;
        if (whereClause) {
          query2 += ` WHERE ${whereClause}`;
        }
        if (options.orderBy) {
          const orderByClauses = buildCloneOrderByClause(options.orderBy);
          if (orderByClauses) {
            query2 += ` ORDER BY ${orderByClauses}`;
          }
        }
        if (options.take) {
          paramCount++;
          query2 += ` LIMIT $${paramCount}`;
          params.push(options.take);
        }
        if (options.skip) {
          paramCount++;
          query2 += ` OFFSET $${paramCount}`;
          params.push(options.skip);
        }
        const result = await client.query(query2, params);
        return result.rows.map(mapDbRowToClone);
      } finally {
        client.release();
      }
    },
    update: async (options) => {
      const client = await pool.connect();
      try {
        const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
        const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
        if (!whereClause || !setClause) {
          throw new Error("Invalid clone update parameters");
        }
        const query2 = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
        const allParams = [...whereParams, ...setParams];
        const result = await client.query(query2, allParams);
        return result.rows.length > 0 ? mapDbRowToClone(result.rows[0]) : null;
      } finally {
        client.release();
      }
    },
    updateMany: async (options) => {
      const client = await pool.connect();
      try {
        const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
        const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
        if (!whereClause || !setClause) {
          throw new Error("Invalid clone updateMany parameters");
        }
        const query2 = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
        const allParams = [...whereParams, ...setParams];
        const result = await client.query(query2, allParams);
        return { count: result.rowCount || 0 };
      } finally {
        client.release();
      }
    }
  },
  // Transaction support
  $transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = {
        igAccount: {
          update: async (options) => {
            const { whereClause, params: whereParams } = buildWhereClause(options.where);
            const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
            if (!whereClause || !setClause) {
              throw new Error("Invalid update parameters");
            }
            const query2 = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
            const allParams = [...whereParams, ...setParams];
            const result2 = await client.query(query2, allParams);
            return result2.rows.length > 0 ? mapDbRowToAccount(result2.rows[0]) : null;
          },
          updateMany: async (options) => {
            const { whereClause, params: whereParams } = buildWhereClause(options.where);
            const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
            if (!whereClause || !setClause) {
              throw new Error("Invalid updateMany parameters");
            }
            const query2 = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
            const allParams = [...whereParams, ...setParams];
            const result2 = await client.query(query2, allParams);
            return { count: result2.rowCount || 0 };
          },
          deleteMany: async (options) => {
            const { whereClause, params } = buildWhereClause(options.where);
            if (!whereClause) {
              throw new Error("DELETE requires WHERE clause for safety");
            }
            const query2 = `DELETE FROM ig_accounts WHERE ${whereClause}`;
            const result2 = await client.query(query2, params);
            return { count: result2.rowCount || 0 };
          },
          findMany: async (options = {}) => {
            const { whereClause, params } = buildWhereClause(options.where || {});
            let paramCount = params.length;
            let query2 = "SELECT * FROM ig_accounts";
            if (whereClause) {
              query2 += ` WHERE ${whereClause}`;
            }
            const result2 = await client.query(query2, params);
            return result2.rows.map(mapDbRowToAccount);
          }
        },
        cloneInventory: {
          update: async (options) => {
            const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
            const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
            if (!whereClause || !setClause) {
              throw new Error("Invalid clone update parameters");
            }
            const query2 = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
            const allParams = [...whereParams, ...setParams];
            const result2 = await client.query(query2, allParams);
            return result2.rows.length > 0 ? mapDbRowToClone(result2.rows[0]) : null;
          },
          updateMany: async (options) => {
            const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
            const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
            if (!whereClause || !setClause) {
              throw new Error("Invalid clone updateMany parameters");
            }
            const query2 = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
            const allParams = [...whereParams, ...setParams];
            const result2 = await client.query(query2, allParams);
            return { count: result2.rowCount || 0 };
          }
        }
      };
      const result = await callback(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};
async function getAccounts(limit = 20, offset = 0, statusFilter, searchQuery, advancedFilters) {
  const client = await pool.connect();
  try {
    let query2 = "SELECT * FROM ig_accounts";
    const params = [];
    const conditions = [];
    const searchClauses = [];
    let paramCount = 0;
    if (statusFilter && !advancedFilters?.statuses) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      params.push(statusFilter);
    }
    if (searchQuery && !advancedFilters?.search) {
      paramCount++;
      searchClauses.push(`instagram_username ILIKE $${paramCount}`);
      params.push(`%${searchQuery}%`);
      paramCount++;
      searchClauses.push(`email_address ILIKE $${paramCount}`);
      params.push(`%${searchQuery}%`);
    }
    if (advancedFilters) {
      if (advancedFilters.search) {
        paramCount++;
        searchClauses.push(`instagram_username ILIKE $${paramCount}`);
        params.push(`%${advancedFilters.search}%`);
        paramCount++;
        searchClauses.push(`email_address ILIKE $${paramCount}`);
        params.push(`%${advancedFilters.search}%`);
        paramCount++;
        searchClauses.push(`assigned_device_id ILIKE $${paramCount}`);
        params.push(`%${advancedFilters.search}%`);
      }
      if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
        const statusPlaceholders = [];
        for (const status of advancedFilters.statuses) {
          paramCount++;
          statusPlaceholders.push(`$${paramCount}`);
          params.push(status);
        }
        conditions.push(`status IN (${statusPlaceholders.join(", ")})`);
      }
      if (advancedFilters.deviceAssignment) {
        switch (advancedFilters.deviceAssignment) {
          case "assigned":
            conditions.push("assigned_device_id IS NOT NULL");
            break;
          case "unassigned":
            conditions.push("assigned_device_id IS NULL");
            break;
          case "specific":
            if (advancedFilters.specificDevice) {
              paramCount++;
              conditions.push(`assigned_device_id = $${paramCount}`);
              params.push(advancedFilters.specificDevice);
            }
            break;
        }
      }
      if (advancedFilters.createdDateFrom) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        params.push(advancedFilters.createdDateFrom);
      }
      if (advancedFilters.createdDateTo) {
        const endOfDay = new Date(advancedFilters.createdDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        params.push(endOfDay);
      }
      if (advancedFilters.loginDateFrom) {
        paramCount++;
        conditions.push(`login_timestamp >= $${paramCount}`);
        params.push(advancedFilters.loginDateFrom);
      }
      if (advancedFilters.loginDateTo) {
        const endOfDay = new Date(advancedFilters.loginDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        paramCount++;
        conditions.push(`login_timestamp <= $${paramCount}`);
        params.push(endOfDay);
      }
      if (advancedFilters.imapStatus && advancedFilters.imapStatus !== "all") {
        paramCount++;
        conditions.push(`imap_status = $${paramCount}`);
        params.push(advancedFilters.imapStatus);
      }
    }
    if (searchClauses.length > 0) {
      conditions.push(`(${searchClauses.join(" OR ")})`);
    }
    if (conditions.length > 0) {
      query2 += ` WHERE ${conditions.join(" AND ")}`;
    }
    query2 += ` ORDER BY created_at DESC`;
    if (limit > 0) {
      paramCount++;
      query2 += ` LIMIT $${paramCount}`;
      params.push(limit);
    }
    if (offset > 0) {
      paramCount++;
      query2 += ` OFFSET $${paramCount}`;
      params.push(offset);
    }
    const result = await client.query(query2, params);
    return result.rows.map((row) => ({
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
      updatedAt: row.updated_at
    }));
  } finally {
    client.release();
  }
}
async function getAccountById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM ig_accounts WHERE id = $1", [id]);
    if (!result.rows[0]) return null;
    const row = result.rows[0];
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
      updatedAt: row.updated_at
    };
  } finally {
    client.release();
  }
}
async function createAccount(data) {
  const client = await pool.connect();
  try {
    const query2 = `
			INSERT INTO ig_accounts (
				record_id, instagram_username, instagram_password, 
				email_address, email_password, status, imap_status,
				assigned_device_id, assigned_clone_number, assigned_package_name,
				assignment_timestamp, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
			RETURNING *
		`;
    const values = [
      data.recordId || null,
      data.instagramUsername,
      data.instagramPassword,
      data.emailAddress,
      data.emailPassword,
      data.status || "Unused",
      data.imapStatus || "On",
      data.assignedDeviceId || null,
      data.assignedCloneNumber || null,
      data.assignedPackageName || null,
      data.assignedDeviceId ? /* @__PURE__ */ new Date() : null
    ];
    const result = await client.query(query2, values);
    const row = result.rows[0];
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
      updatedAt: row.updated_at
    };
  } finally {
    client.release();
  }
}
async function updateAccount(id, data) {
  const client = await pool.connect();
  try {
    const updates = [];
    const values = [];
    let paramCount = 0;
    Object.entries(data).forEach(([key, value]) => {
      if (value !== void 0) {
        paramCount++;
        const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        updates.push(`${dbKey} = $${paramCount}`);
        values.push(value);
      }
    });
    if (updates.length === 0) return null;
    paramCount++;
    updates.push(`updated_at = NOW()`);
    values.push(id);
    const query2 = `
			UPDATE ig_accounts 
			SET ${updates.join(", ")} 
			WHERE id = $${paramCount}
			RETURNING *
		`;
    const result = await client.query(query2, values);
    if (!result.rows[0]) return null;
    const row = result.rows[0];
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
      updatedAt: row.updated_at
    };
  } finally {
    client.release();
  }
}
async function deleteAccount(id) {
  const client = await pool.connect();
  try {
    const result = await client.query("DELETE FROM ig_accounts WHERE id = $1 RETURNING *", [id]);
    if (!result.rows[0]) return null;
    const row = result.rows[0];
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
      updatedAt: row.updated_at
    };
  } finally {
    client.release();
  }
}
async function checkUsernameExists(username, excludeId) {
  const client = await pool.connect();
  try {
    let query2 = "SELECT id FROM ig_accounts WHERE instagram_username = $1";
    const params = [username];
    if (excludeId) {
      query2 += " AND id != $2";
      params.push(excludeId.toString());
    }
    const result = await client.query(query2, params);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}
async function getAccountsCount(statusFilter, searchQuery, advancedFilters) {
  const client = await pool.connect();
  try {
    let query2 = "SELECT COUNT(*) as count FROM ig_accounts";
    const params = [];
    const conditions = [];
    const searchClauses = [];
    let paramCount = 0;
    if (statusFilter && !advancedFilters?.statuses) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      params.push(statusFilter);
    }
    if (searchQuery && !advancedFilters?.search) {
      paramCount++;
      searchClauses.push(`instagram_username ILIKE $${paramCount}`);
      params.push(`%${searchQuery}%`);
      paramCount++;
      searchClauses.push(`email_address ILIKE $${paramCount}`);
      params.push(`%${searchQuery}%`);
    }
    if (advancedFilters) {
      if (advancedFilters.search) {
        paramCount++;
        searchClauses.push(`instagram_username ILIKE $${paramCount}`);
        params.push(`%${advancedFilters.search}%`);
        paramCount++;
        searchClauses.push(`email_address ILIKE $${paramCount}`);
        params.push(`%${advancedFilters.search}%`);
        paramCount++;
        searchClauses.push(`assigned_device_id ILIKE $${paramCount}`);
        params.push(`%${advancedFilters.search}%`);
      }
      if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
        const statusPlaceholders = [];
        for (const status of advancedFilters.statuses) {
          paramCount++;
          statusPlaceholders.push(`$${paramCount}`);
          params.push(status);
        }
        conditions.push(`status IN (${statusPlaceholders.join(", ")})`);
      }
      if (advancedFilters.deviceAssignment) {
        switch (advancedFilters.deviceAssignment) {
          case "assigned":
            conditions.push("assigned_device_id IS NOT NULL");
            break;
          case "unassigned":
            conditions.push("assigned_device_id IS NULL");
            break;
          case "specific":
            if (advancedFilters.specificDevice) {
              paramCount++;
              conditions.push(`assigned_device_id = $${paramCount}`);
              params.push(advancedFilters.specificDevice);
            }
            break;
        }
      }
      if (advancedFilters.createdDateFrom) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        params.push(advancedFilters.createdDateFrom);
      }
      if (advancedFilters.createdDateTo) {
        const endOfDay = new Date(advancedFilters.createdDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        params.push(endOfDay);
      }
      if (advancedFilters.loginDateFrom) {
        paramCount++;
        conditions.push(`login_timestamp >= $${paramCount}`);
        params.push(advancedFilters.loginDateFrom);
      }
      if (advancedFilters.loginDateTo) {
        const endOfDay = new Date(advancedFilters.loginDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        paramCount++;
        conditions.push(`login_timestamp <= $${paramCount}`);
        params.push(endOfDay);
      }
      if (advancedFilters.imapStatus && advancedFilters.imapStatus !== "all") {
        paramCount++;
        conditions.push(`imap_status = $${paramCount}`);
        params.push(advancedFilters.imapStatus);
      }
    }
    if (searchClauses.length > 0) {
      conditions.push(`(${searchClauses.join(" OR ")})`);
    }
    if (conditions.length > 0) {
      query2 += ` WHERE ${conditions.join(" AND ")}`;
    }
    const result = await client.query(query2, params);
    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}
async function getAvailableAccounts(limit = 20) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
			SELECT id, instagram_username, status 
			FROM ig_accounts 
			WHERE status = 'Unused' 
			ORDER BY instagram_username 
			LIMIT $1
		`, [limit]);
    return result.rows.map((row) => ({
      id: row.id,
      instagramUsername: row.instagram_username,
      status: row.status
    }));
  } finally {
    client.release();
  }
}
async function getDeviceSummaries() {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM clone_inventory ORDER BY device_id, clone_number");
      const deviceMap = /* @__PURE__ */ new Map();
      result.rows.forEach((clone) => {
        if (!deviceMap.has(clone.device_id)) {
          deviceMap.set(clone.device_id, []);
        }
        deviceMap.get(clone.device_id).push(clone);
      });
      const summaries = [];
      deviceMap.forEach((clones, deviceId) => {
        const totalClones = clones.length;
        const availableClones = clones.filter((c2) => c2.clone_status === "Available").length;
        const assignedClones = clones.filter((c2) => c2.clone_status === "Assigned").length;
        const loggedInClones = clones.filter((c2) => c2.clone_status === "Logged In").length;
        const brokenClones = clones.filter((c2) => c2.clone_status === "Broken").length;
        const deviceStatus = determineDeviceStatus(clones);
        const deviceName = clones[0].device_name || null;
        const deviceHealth = clones[0].clone_health || null;
        const lastScanned = clones.reduce(
          (latest, clone) => clone.last_scanned > latest ? clone.last_scanned : latest,
          clones[0].last_scanned
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
    } finally {
      client.release();
    }
  });
}
async function getDeviceStats() {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM clone_inventory");
      const allClones = result.rows;
      const deviceMap = /* @__PURE__ */ new Map();
      allClones.forEach((clone) => {
        if (!deviceMap.has(clone.device_id)) {
          deviceMap.set(clone.device_id, []);
        }
        deviceMap.get(clone.device_id).push(clone);
      });
      const totalDevices = deviceMap.size;
      const totalClones = allClones.length;
      const availableClones = allClones.filter((c2) => c2.clone_status === "Available").length;
      const assignedClones = allClones.filter((c2) => c2.clone_status === "Assigned").length;
      const loggedInClones = allClones.filter((c2) => c2.clone_status === "Logged In").length;
      const brokenClones = allClones.filter((c2) => c2.clone_status === "Broken").length;
      const clonesByStatus = {
        "Available": availableClones,
        "Assigned": assignedClones,
        "Logged In": loggedInClones,
        "Login Error": allClones.filter((c2) => c2.clone_status === "Login Error").length,
        "Maintenance": allClones.filter((c2) => c2.clone_status === "Maintenance").length,
        "Broken": brokenClones
      };
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
    } finally {
      client.release();
    }
  });
}
async function getDeviceDetails(deviceId) {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM clone_inventory WHERE device_id = $1 ORDER BY clone_number", [deviceId]);
      const rawClones = result.rows;
      if (rawClones.length === 0) {
        return { device: null, clones: [] };
      }
      const clones = rawClones.map((row) => ({
        id: row.id,
        deviceId: row.device_id,
        cloneNumber: row.clone_number,
        packageName: row.package_name,
        cloneStatus: row.clone_status,
        currentAccount: row.current_account,
        deviceName: row.device_name,
        cloneHealth: row.clone_health,
        lastScanned: row.last_scanned,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      const totalClones = clones.length;
      const availableClones = clones.filter((c2) => c2.cloneStatus === "Available").length;
      const assignedClones = clones.filter((c2) => c2.cloneStatus === "Assigned").length;
      const loggedInClones = clones.filter((c2) => c2.cloneStatus === "Logged In").length;
      const brokenClones = clones.filter((c2) => c2.cloneStatus === "Broken").length;
      const deviceStatus = determineDeviceStatus(rawClones);
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
    } finally {
      client.release();
    }
  });
}
async function getDeviceList() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
			SELECT DISTINCT device_id, device_name 
			FROM clone_inventory 
			ORDER BY device_id
		`);
    return result.rows.map((row) => ({
      deviceId: row.device_id,
      deviceName: row.device_name
    }));
  } finally {
    client.release();
  }
}
function determineDeviceStatus(clones) {
  if (clones.some((c2) => c2.clone_status === "Broken" || c2.clone_health === "Broken")) {
    return "Broken";
  }
  if (clones.some((c2) => c2.clone_status === "Maintenance")) {
    return "Maintenance";
  }
  if (clones.some((c2) => c2.clone_status === "Logged In")) {
    return "Logged In";
  }
  return "Available";
}
async function assignAccountToClone(deviceId, cloneNumber, instagramUsername) {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cloneResult = await client.query(`
				UPDATE clone_inventory 
				SET clone_status = 'Assigned',
				    current_account = $1,
				    updated_at = NOW()
				WHERE device_id = $2 AND clone_number = $3
				RETURNING *
			`, [instagramUsername, deviceId, cloneNumber]);
      if (cloneResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const accountResult = await client.query(`
				UPDATE ig_accounts 
				SET status = 'Assigned',
				    assigned_device_id = $1,
				    assigned_clone_number = $2,
				    assignment_timestamp = NOW(),
				    updated_at = NOW()
				WHERE instagram_username = $3
			`, [deviceId, cloneNumber, instagramUsername]);
      if (accountResult.rowCount === null || accountResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to assign account to clone:", error);
      return false;
    } finally {
      client.release();
    }
  });
}
async function unassignAccountFromClone(deviceId, cloneNumber) {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cloneResult = await client.query(`
				SELECT current_account 
				FROM clone_inventory 
				WHERE device_id = $1 AND clone_number = $2
			`, [deviceId, cloneNumber]);
      if (cloneResult.rows.length === 0 || !cloneResult.rows[0].current_account) {
        await client.query("ROLLBACK");
        return false;
      }
      const currentAccount = cloneResult.rows[0].current_account;
      await client.query(`
				UPDATE clone_inventory 
				SET clone_status = 'Available',
				    current_account = NULL,
				    updated_at = NOW()
				WHERE device_id = $1 AND clone_number = $2
			`, [deviceId, cloneNumber]);
      await client.query(`
				UPDATE ig_accounts 
				SET status = 'Unused',
				    assigned_device_id = NULL,
				    assigned_clone_number = NULL,
				    assignment_timestamp = NULL,
				    updated_at = NOW()
				WHERE instagram_username = $1
			`, [currentAccount]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to unassign account from clone:", error);
      return false;
    } finally {
      client.release();
    }
  });
}
async function updateCloneStatus(deviceId, cloneNumber, status) {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
				UPDATE clone_inventory 
				SET clone_status = $1,
				    updated_at = NOW()
				WHERE device_id = $2 AND clone_number = $3
				RETURNING id
			`, [status, deviceId, cloneNumber]);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Failed to update clone status:", error);
      return false;
    } finally {
      client.release();
    }
  });
}
async function getDeviceCapacityAnalysis() {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT * FROM clone_inventory ORDER BY device_id, clone_number");
      const allClones = result.rows;
      const deviceMap = /* @__PURE__ */ new Map();
      allClones.forEach((clone) => {
        if (!deviceMap.has(clone.device_id)) {
          deviceMap.set(clone.device_id, []);
        }
        deviceMap.get(clone.device_id).push(clone);
      });
      const capacityAnalysis = [];
      deviceMap.forEach((clones, deviceId) => {
        const totalClones = clones.length;
        const availableClones = clones.filter((c2) => c2.clone_status === "Available").length;
        const assignedClones = clones.filter((c2) => c2.clone_status === "Assigned").length;
        const loggedInClones = clones.filter((c2) => c2.clone_status === "Logged In").length;
        const brokenClones = clones.filter((c2) => c2.clone_status === "Broken").length;
        const deviceStatus = determineDeviceStatus(clones);
        const deviceName = clones[0].device_name || null;
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
    } finally {
      client.release();
    }
  });
}
async function getOptimalDeviceAssignments(accountIds, strategy = "capacity-based") {
  if (accountIds.length === 0) {
    return [];
  }
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const accountsResult = await client.query(`
				SELECT id, instagram_username 
				FROM ig_accounts 
				WHERE id = ANY($1) AND status = 'Unused' AND assigned_device_id IS NULL
				ORDER BY instagram_username
			`, [accountIds]);
      if (accountsResult.rows.length === 0) {
        return [];
      }
      const clonesResult = await client.query(`
				SELECT device_id, clone_number, package_name, device_name, clone_health 
				FROM clone_inventory 
				WHERE clone_status = 'Available' 
				ORDER BY device_id, clone_number
			`);
      if (clonesResult.rows.length === 0) {
        return [];
      }
      const accounts = accountsResult.rows;
      const availableClones = clonesResult.rows.map((row) => ({
        deviceId: row.device_id,
        cloneNumber: row.clone_number,
        packageName: row.package_name,
        deviceName: row.device_name,
        cloneHealth: row.clone_health
      }));
      const assignments = [];
      switch (strategy) {
        case "round-robin": {
          const deviceIds = [...new Set(availableClones.map((c2) => c2.deviceId))].sort();
          let currentDeviceIndex = 0;
          for (const account of accounts) {
            if (assignments.length >= availableClones.length) break;
            let attempts = 0;
            while (attempts < deviceIds.length) {
              const targetDeviceId = deviceIds[currentDeviceIndex];
              const availableClone = availableClones.find(
                (c2) => c2.deviceId === targetDeviceId && !assignments.some((a2) => a2.deviceId === c2.deviceId && a2.cloneNumber === c2.cloneNumber)
              );
              if (availableClone) {
                assignments.push({
                  accountId: account.id,
                  instagramUsername: account.instagram_username,
                  deviceId: availableClone.deviceId,
                  cloneNumber: availableClone.cloneNumber,
                  packageName: availableClone.packageName
                });
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
          for (let i = 0; i < accounts.length && i < sortedClones.length; i++) {
            const account = accounts[i];
            const clone = sortedClones[i];
            assignments.push({
              accountId: account.id,
              instagramUsername: account.instagram_username,
              deviceId: clone.deviceId,
              cloneNumber: clone.cloneNumber,
              packageName: clone.packageName
            });
          }
          break;
        }
        case "capacity-based": {
          const deviceCapacity = await getDeviceCapacityAnalysis();
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
          for (const deviceInfo of deviceEfficiencyOrder) {
            const deviceClones = clonesByDevice.get(deviceInfo.deviceId) || [];
            for (const clone of deviceClones) {
              if (accountIndex >= accounts.length) break;
              const account = accounts[accountIndex];
              assignments.push({
                accountId: account.id,
                instagramUsername: account.instagram_username,
                deviceId: clone.deviceId,
                cloneNumber: clone.cloneNumber,
                packageName: clone.packageName
              });
              accountIndex++;
            }
            if (accountIndex >= accounts.length) break;
          }
          break;
        }
      }
      return assignments;
    } finally {
      client.release();
    }
  });
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
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const accountsResult = await client.query(`
				SELECT id, instagram_username, status, assigned_device_id 
				FROM ig_accounts 
				WHERE id = ANY($1)
			`, [accountIds]);
      if (accountsResult.rows.length !== accountIds.length) {
        const foundIds = accountsResult.rows.map((a2) => a2.id);
        const missingIds = accountIds.filter((id) => !foundIds.includes(id));
        result.errors.push(`Accounts not found: ${missingIds.join(", ")}`);
      }
      const unavailableAccounts = accountsResult.rows.filter(
        (a2) => a2.status !== "Unused" || a2.assigned_device_id !== null
      );
      if (unavailableAccounts.length > 0) {
        result.errors.push(
          `Accounts not available for assignment: ${unavailableAccounts.map((a2) => a2.instagram_username).join(", ")}`
        );
      }
      const availableAccountCount = accountsResult.rows.length - unavailableAccounts.length;
      const cloneCountResult = await client.query(`
				SELECT COUNT(*) as count 
				FROM clone_inventory 
				WHERE clone_status = 'Available'
			`);
      const availableClones = parseInt(cloneCountResult.rows[0].count);
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
      const deviceHealthResult = await client.query(`
				SELECT 
					COUNT(DISTINCT CASE WHEN clone_status = 'Broken' THEN device_id END) as broken_devices,
					COUNT(DISTINCT CASE WHEN clone_status = 'Maintenance' THEN device_id END) as maintenance_devices
				FROM clone_inventory
			`);
      const brokenDevices = parseInt(deviceHealthResult.rows[0].broken_devices);
      const maintenanceDevices = parseInt(deviceHealthResult.rows[0].maintenance_devices);
      if (brokenDevices > 0) {
        result.warnings.push(`${brokenDevices} devices are in broken status and unavailable`);
      }
      if (maintenanceDevices > 0) {
        result.warnings.push(`${maintenanceDevices} devices are in maintenance and may have limited availability`);
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
    } finally {
      client.release();
    }
  });
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
  return withRetry(async () => {
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const assignment of optimalAssignments) {
          try {
            const cloneUpdateResult = await client.query(`
							UPDATE clone_inventory 
							SET clone_status = 'Assigned',
							    current_account = $1,
							    updated_at = NOW()
							WHERE device_id = $2 AND clone_number = $3 AND clone_status = 'Available'
							RETURNING id
						`, [assignment.instagramUsername, assignment.deviceId, assignment.cloneNumber]);
            if (cloneUpdateResult.rowCount === null || cloneUpdateResult.rowCount === 0) {
              throw new Error("Clone no longer available for assignment");
            }
            const accountUpdateResult = await client.query(`
							UPDATE ig_accounts 
							SET status = 'Assigned',
							    assigned_device_id = $1,
							    assigned_clone_number = $2,
							    assigned_package_name = $3,
							    assignment_timestamp = NOW(),
							    updated_at = NOW()
							WHERE id = $4 AND status = 'Unused' AND assigned_device_id IS NULL
							RETURNING id
						`, [assignment.deviceId, assignment.cloneNumber, assignment.packageName, assignment.accountId]);
            if (accountUpdateResult.rowCount === null || accountUpdateResult.rowCount === 0) {
              throw new Error("Account no longer available for assignment");
            }
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
        await client.query("COMMIT");
        result.success = result.assignedCount > 0;
        if (result.failedAccounts.length > 0) {
          result.errors.push(`Failed to assign ${result.failedAccounts.length} accounts`);
        }
        return result;
      } catch (transactionError) {
        await client.query("ROLLBACK");
        throw transactionError;
      } finally {
        client.release();
      }
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
  });
}
class BulkOperationError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "BulkOperationError";
  }
}
function validateBulkOperationParams(accountIds, operation) {
  const errors = [];
  if (!Array.isArray(accountIds)) {
    errors.push("accountIds must be an array");
    return { valid: false, errors };
  }
  if (accountIds.length === 0) {
    errors.push("accountIds array cannot be empty");
  }
  if (accountIds.length > 1e3) {
    errors.push("Cannot process more than 1000 accounts at once");
  }
  for (let i = 0; i < accountIds.length; i++) {
    const id = accountIds[i];
    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`Invalid account ID at index ${i}: ${id}`);
    }
  }
  const validOperations = ["updateStatus", "assignDevices", "export", "delete"];
  if (!validOperations.includes(operation)) {
    errors.push(`Invalid operation: ${operation}`);
  }
  return { valid: errors.length === 0, errors };
}
function sanitizeInput(input) {
  if (typeof input === "string") {
    return input.replace(/[;\\-\\-\\/\\*\\*\\/\\x00\\x1a]/g, "");
  }
  return input;
}
async function bulkUpdateAccountStatus(accountIds, newStatus, additionalData) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(", ");
    const params = [...accountIds];
    let paramCount = accountIds.length;
    let setClause = "status = $" + ++paramCount;
    params.push(newStatus);
    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        if (value !== void 0) {
          const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
          setClause += `, ${dbKey} = $${++paramCount}`;
          params.push(value);
        }
      }
    }
    setClause += ", updated_at = NOW()";
    const query2 = `UPDATE ig_accounts SET ${setClause} WHERE id IN (${placeholders})`;
    const result = await client.query(query2, params);
    await client.query("COMMIT");
    return { count: result.rowCount || 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function bulkDeleteAccounts(accountIds) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(", ");
    const assignedAccountsResult = await client.query(`
			SELECT id, assigned_device_id, assigned_clone_number 
			FROM ig_accounts 
			WHERE id IN (${placeholders}) 
			  AND assigned_device_id IS NOT NULL 
			  AND assigned_clone_number IS NOT NULL
		`, accountIds);
    for (const account of assignedAccountsResult.rows) {
      await client.query(`
				UPDATE clone_inventory 
				SET clone_status = 'Available', current_account = NULL, updated_at = NOW() 
				WHERE device_id = $1 AND clone_number = $2
			`, [account.assigned_device_id, account.assigned_clone_number]);
    }
    const deleteResult = await client.query(`
			DELETE FROM ig_accounts WHERE id IN (${placeholders})
		`, accountIds);
    await client.query("COMMIT");
    return { count: deleteResult.rowCount || 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function getAccountsForExport(filters = {}, fields = []) {
  const client = await pool.connect();
  try {
    let selectClause = "*";
    if (fields.length > 0) {
      const dbFields = fields.map((field) => {
        switch (field) {
          case "instagramUsername":
            return "instagram_username";
          case "instagramPassword":
            return "instagram_password";
          case "emailAddress":
            return "email_address";
          case "emailPassword":
            return "email_password";
          case "imapStatus":
            return "imap_status";
          case "assignedDeviceId":
            return "assigned_device_id";
          case "assignedCloneNumber":
            return "assigned_clone_number";
          case "assignedPackageName":
            return "assigned_package_name";
          case "assignmentTimestamp":
            return "assignment_timestamp";
          case "loginTimestamp":
            return "login_timestamp";
          case "createdAt":
            return "created_at";
          case "updatedAt":
            return "updated_at";
          default:
            return field;
        }
      });
      selectClause = dbFields.join(", ");
    }
    let query2 = `SELECT ${selectClause} FROM ig_accounts`;
    const params = [];
    let paramCount = 0;
    const conditions = [];
    if (filters.status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      params.push(filters.status);
    }
    if (filters.search) {
      paramCount++;
      const searchParam = `%${filters.search}%`;
      conditions.push(`(instagram_username ILIKE $${paramCount} OR email_address ILIKE $${paramCount})`);
      params.push(searchParam);
    }
    if (filters.dateFrom) {
      paramCount++;
      conditions.push(`created_at >= $${paramCount}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      paramCount++;
      conditions.push(`created_at <= $${paramCount}`);
      params.push(filters.dateTo);
    }
    if (conditions.length > 0) {
      query2 += ` WHERE ${conditions.join(" AND ")}`;
    }
    query2 += " ORDER BY created_at DESC";
    const result = await client.query(query2, params);
    return result.rows.map(mapDbRowToAccount);
  } finally {
    client.release();
  }
}
async function $queryRaw(query2, ...values) {
  const client = await pool.connect();
  try {
    if (typeof query2 === "string") {
      return await client.query(query2, values);
    } else {
      const queryStr = query2.join("?");
      return await client.query(queryStr, values);
    }
  } finally {
    client.release();
  }
}
async function query(sql, params = [], context) {
  return await monitoredQuery(
    async () => {
      return await withRetry(async () => {
        const client = await pool.connect();
        try {
          const result = await client.query(sql, params);
          return result;
        } finally {
          client.release();
        }
      });
    },
    sql,
    params,
    context
  );
}

export { $queryRaw, BulkOperationError, assignAccountToClone, assignAccountsToDevicesAutomatically, bulkDeleteAccounts, bulkUpdateAccountStatus, checkUsernameExists, createAccount, deleteAccount, getAccountById, getAccountStats, getAccounts, getAccountsCount, getAccountsForExport, getAvailableAccounts, getDeviceCapacityAnalysis, getDeviceDetails, getDeviceList, getDeviceStats, getDeviceSummaries, getOptimalDeviceAssignments, pool, prisma, query, sanitizeInput, unassignAccountFromClone, updateAccount, updateCloneStatus, validateAssignmentFeasibility, validateBulkOperationParams };
//# sourceMappingURL=database-fallback-D0uHIhN9.js.map
