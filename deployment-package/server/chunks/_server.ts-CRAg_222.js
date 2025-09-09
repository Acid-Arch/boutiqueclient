import { j as json } from './index-Djsj11qr.js';
import { getPrisma } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const FIELD_DISPLAY_NAMES = {
  id: "ID",
  recordId: "Record ID",
  instagramUsername: "Instagram Username",
  instagramPassword: "Instagram Password",
  emailAddress: "Email Address",
  emailPassword: "Email Password",
  status: "Status",
  imapStatus: "IMAP Status",
  assignedDeviceId: "Device ID",
  assignedCloneNumber: "Clone Number",
  assignedPackageName: "Package Name",
  assignmentTimestamp: "Assignment Date",
  loginTimestamp: "Login Date",
  createdAt: "Created Date",
  updatedAt: "Updated Date"
};
function formatDateForExport(date) {
  if (!date) return "";
  return date.toISOString().replace("T", " ").substring(0, 19);
}
function getFieldValue(account, fieldName) {
  const value = account[fieldName];
  if (fieldName.includes("Timestamp") || fieldName.includes("At")) {
    return formatDateForExport(value);
  }
  if (value === null || value === void 0) {
    return "";
  }
  return String(value);
}
function escapeCsvField(value) {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
function convertToCSV(accounts, fields, includeHeaders = true) {
  const selectedFields = Object.entries(fields).filter(([_, selected]) => selected).map(([fieldName, _]) => fieldName);
  const rows = [];
  if (includeHeaders) {
    const headers = selectedFields.map((field) => FIELD_DISPLAY_NAMES[field]);
    rows.push(headers.map((header) => escapeCsvField(header)).join(","));
  }
  accounts.forEach((account) => {
    const values = selectedFields.map((field) => {
      const value = getFieldValue(account, field);
      return escapeCsvField(value);
    });
    rows.push(values.join(","));
  });
  return rows.join("\n");
}
function convertToJSON(accounts, fields, includeMetadata = true) {
  const selectedFields = Object.entries(fields).filter(([_, selected]) => selected).map(([fieldName, _]) => fieldName);
  const filteredAccounts = accounts.map((account) => {
    const filtered = {};
    selectedFields.forEach((field) => {
      const value = account[field];
      if (field.includes("Timestamp") || field.includes("At")) {
        filtered[field] = value ? value.toISOString() : void 0;
      } else {
        filtered[field] = value ?? void 0;
      }
    });
    return filtered;
  });
  if (includeMetadata) {
    return JSON.stringify({
      metadata: {
        exportDate: (/* @__PURE__ */ new Date()).toISOString(),
        recordCount: accounts.length,
        fields: selectedFields,
        format: "instagram-account-export-v1"
      },
      accounts: filteredAccounts
    }, null, 2);
  }
  return JSON.stringify(filteredAccounts, null, 2);
}
function generateExportFilename(format, recordCount, prefix = "ig-accounts") {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const extension = format === "csv" ? "csv" : "json";
  return `${prefix}-${recordCount}-records-${timestamp}.${extension}`;
}
function validateExportConfig(config) {
  const errors = [];
  if (!config.format) {
    errors.push("Export format is required");
  } else if (!["csv", "json"].includes(config.format)) {
    errors.push("Export format must be CSV or JSON");
  }
  if (!config.fields) {
    errors.push("Field selection is required");
  } else {
    const selectedFields = Object.values(config.fields).filter(Boolean);
    if (selectedFields.length === 0) {
      errors.push("At least one field must be selected for export");
    }
  }
  if (config.dateRange) {
    if (!config.dateRange.from || !config.dateRange.to) {
      errors.push("Both start and end dates are required for date range filtering");
    } else if (config.dateRange.from > config.dateRange.to) {
      errors.push("Start date cannot be after end date");
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function estimateExportSize(recordCount, fields, format) {
  const selectedFieldCount = Object.values(fields).filter(Boolean).length;
  const avgFieldSize = 35;
  const headerSize = 500;
  const estimatedBytes = recordCount * selectedFieldCount * avgFieldSize + headerSize;
  let size;
  let unit;
  if (estimatedBytes < 1024) {
    size = estimatedBytes;
    unit = "B";
  } else if (estimatedBytes < 1024 * 1024) {
    size = estimatedBytes / 1024;
    unit = "KB";
  } else {
    size = estimatedBytes / (1024 * 1024);
    unit = "MB";
  }
  return {
    size: Math.round(size * 100) / 100,
    unit,
    displaySize: `${Math.round(size * 100) / 100} ${unit}`
  };
}
function isLargeExport(recordCount, fields) {
  const estimate = estimateExportSize(recordCount, fields);
  return estimate.size > 1 && estimate.unit === "MB";
}
function getRecommendedBatchSize(recordCount) {
  if (recordCount <= 1e3) return recordCount;
  if (recordCount <= 5e3) return 1e3;
  if (recordCount <= 1e4) return 2e3;
  return 5e3;
}
const POST = async ({ request }) => {
  try {
    const config = await request.json();
    const prisma = await getPrisma();
    const validation = validateExportConfig(config);
    if (!validation.valid) {
      return json({
        success: false,
        error: `Invalid export configuration: ${validation.errors.join(", ")}`
      }, { status: 400 });
    }
    const where = {};
    if (config.statusFilter) {
      where.status = config.statusFilter;
    }
    if (config.searchQuery) {
      where.OR = [
        { instagramUsername: { contains: config.searchQuery, mode: "insensitive" } },
        { emailAddress: { contains: config.searchQuery, mode: "insensitive" } }
      ];
    }
    if (config.dateRange) {
      where.createdAt = {
        gte: config.dateRange.from,
        lte: config.dateRange.to
      };
    }
    const totalCount = await prisma.igAccount.count({ where });
    if (totalCount === 0) {
      return json({
        success: false,
        error: "No accounts match the specified filters"
      }, { status: 400 });
    }
    const needsBatching = isLargeExport(totalCount, config.fields);
    let accounts = [];
    if (needsBatching) {
      const batchSize = getRecommendedBatchSize(totalCount);
      let skip = 0;
      while (skip < totalCount) {
        const batchAccounts = await prisma.igAccount.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: batchSize,
          skip,
          include: {
            // Only include device info if device fields are selected
            ...config.fields.assignedDeviceId || config.fields.assignedCloneNumber || config.fields.assignedPackageName ? {
              // Note: In a real scenario, you'd join with CloneInventory table
              // For now, we'll just include the basic assignment info
            } : {}
          }
        });
        accounts.push(...batchAccounts);
        skip += batchSize;
        if (batchAccounts.length === 0) break;
      }
    } else {
      accounts = await prisma.igAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          // Only include device info if device fields are selected
          ...config.fields.assignedDeviceId || config.fields.assignedCloneNumber || config.fields.assignedPackageName ? {
            // Note: In a real scenario, you'd join with CloneInventory table
          } : {}
        }
      });
    }
    if (config.fields.assignedDeviceId || config.fields.assignedCloneNumber || config.fields.assignedPackageName) {
      const deviceIds = accounts.map((account) => account.assignedDeviceId).filter((id) => Boolean(id));
      if (deviceIds.length > 0) {
        const deviceData = await prisma.cloneInventory.findMany({
          where: {
            deviceId: { in: deviceIds }
          },
          select: {
            deviceId: true,
            deviceName: true,
            packageName: true,
            cloneHealth: true,
            cloneNumber: true
          }
        });
        const deviceMap = new Map(
          deviceData.map((device) => [`${device.deviceId}-${device.cloneNumber}`, device])
        );
        accounts = accounts.map((account) => {
          if (account.assignedDeviceId && account.assignedCloneNumber !== null) {
            const deviceKey = `${account.assignedDeviceId}-${account.assignedCloneNumber}`;
            const deviceInfo = deviceMap.get(deviceKey);
            if (deviceInfo) {
              return {
                ...account,
                assignedDevice: {
                  deviceName: deviceInfo.deviceName,
                  packageName: deviceInfo.packageName,
                  cloneHealth: deviceInfo.cloneHealth
                }
              };
            }
          }
          return account;
        });
      }
    }
    let exportData;
    let filename;
    if (config.format === "csv") {
      exportData = convertToCSV(accounts, config.fields, config.includeHeaders);
      filename = generateExportFilename("csv", accounts.length, "ig-accounts");
    } else {
      exportData = convertToJSON(accounts, config.fields, true);
      filename = generateExportFilename("json", accounts.length, "ig-accounts");
    }
    console.log(`Export completed: ${accounts.length} accounts exported in ${config.format.toUpperCase()} format`);
    return json({
      success: true,
      data: exportData,
      filename,
      recordCount: accounts.length,
      metadata: {
        format: config.format,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        totalRecords: accounts.length,
        fieldsExported: Object.entries(config.fields).filter(([_, selected]) => selected).map(([field, _]) => field),
        filtersApplied: {
          status: config.statusFilter || null,
          search: config.searchQuery || null,
          dateRange: config.dateRange || null
        }
      }
    });
  } catch (error) {
    console.error("Export failed:", error);
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return json({
          success: false,
          error: "Export timed out. Please try exporting a smaller dataset or contact support."
        }, { status: 408 });
      }
      if (error.message.includes("memory")) {
        return json({
          success: false,
          error: "Export dataset too large. Please apply additional filters to reduce the data size."
        }, { status: 413 });
      }
    }
    return json({
      success: false,
      error: "Export failed due to an internal error. Please try again."
    }, { status: 500 });
  }
};
const GET = async ({ url }) => {
  try {
    const prisma = await getPrisma();
    const statusFilter = url.searchParams.get("status") || void 0;
    const searchQuery = url.searchParams.get("search") || void 0;
    const where = {};
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (searchQuery) {
      where.OR = [
        { instagramUsername: { contains: searchQuery, mode: "insensitive" } },
        { emailAddress: { contains: searchQuery, mode: "insensitive" } }
      ];
    }
    const [totalCount, oldestAccount, newestAccount] = await Promise.all([
      prisma.igAccount.count({ where }),
      prisma.igAccount.findFirst({
        where,
        orderBy: { createdAt: "asc" },
        select: { createdAt: true }
      }),
      prisma.igAccount.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);
    const statusBreakdown = await prisma.igAccount.groupBy({
      by: ["status"],
      where: searchQuery ? {
        OR: [
          { instagramUsername: { contains: searchQuery, mode: "insensitive" } },
          { emailAddress: { contains: searchQuery, mode: "insensitive" } }
        ]
      } : {},
      _count: {
        status: true
      }
    });
    const statusCounts = statusBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});
    return json({
      success: true,
      data: {
        totalRecords: totalCount,
        dateRange: {
          oldest: oldestAccount?.createdAt || null,
          newest: newestAccount?.createdAt || null
        },
        statusBreakdown: statusCounts,
        hasData: totalCount > 0
      }
    });
  } catch (error) {
    console.error("Failed to get export stats:", error);
    return json({
      success: false,
      error: "Failed to retrieve export statistics"
    }, { status: 500 });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-CRAg_222.js.map
