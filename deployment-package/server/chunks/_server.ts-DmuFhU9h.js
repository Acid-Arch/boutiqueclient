import { j as json } from './index-Djsj11qr.js';
import { prisma } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const POST = async ({ request }) => {
  try {
    const { records } = await request.json();
    if (!records || !Array.isArray(records)) {
      return json({
        success: false,
        error: "Invalid import data. Expected array of records."
      }, { status: 400 });
    }
    if (records.length === 0) {
      return json({
        success: false,
        error: "No records provided for import."
      }, { status: 400 });
    }
    const validRecords = records.filter((record) => record.valid);
    if (validRecords.length === 0) {
      return json({
        success: false,
        error: "No valid records found for import."
      }, { status: 400 });
    }
    const progress = {
      phase: "starting",
      current: 0,
      total: validRecords.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      message: "Starting import..."
    };
    const importResults = {
      imported: 0,
      errors: [],
      duplicatesSkipped: 0,
      partialSuccess: false
    };
    progress.phase = "validating";
    progress.message = "Validating usernames...";
    const usernamesToCheck = validRecords.map((record) => record.data.instagramUsername).filter((username) => Boolean(username));
    const existingAccounts = await prisma.igAccount.findMany({
      where: {
        instagramUsername: { in: usernamesToCheck }
      },
      select: { instagramUsername: true }
    });
    const existingUsernames = new Set(existingAccounts.map((account) => account.instagramUsername));
    const recordsToImport = validRecords.filter((record) => {
      if (record.data.instagramUsername && existingUsernames.has(record.data.instagramUsername)) {
        importResults.duplicatesSkipped++;
        importResults.errors.push(
          `Row ${record.rowNumber}: Username '${record.data.instagramUsername}' already exists`
        );
        return false;
      }
      return true;
    });
    if (recordsToImport.length === 0) {
      return json({
        success: false,
        error: "All records contain duplicate usernames.",
        duplicatesSkipped: importResults.duplicatesSkipped
      }, { status: 400 });
    }
    progress.phase = "importing";
    progress.total = recordsToImport.length;
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < recordsToImport.length; i += batchSize) {
      batches.push(recordsToImport.slice(i, i + batchSize));
    }
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      progress.message = `Processing batch ${batchIndex + 1} of ${batches.length}...`;
      try {
        await prisma.$transaction(async (tx) => {
          for (const record of batch) {
            try {
              const existingCheck = await tx.igAccount.findFirst({
                where: { instagramUsername: record.data.instagramUsername }
              });
              if (existingCheck) {
                importResults.duplicatesSkipped++;
                importResults.errors.push(
                  `Row ${record.rowNumber}: Username '${record.data.instagramUsername}' was created by another process`
                );
                progress.current++;
                continue;
              }
              await tx.igAccount.create({
                data: {
                  recordId: record.data.recordId,
                  instagramUsername: record.data.instagramUsername,
                  instagramPassword: record.data.instagramPassword,
                  emailAddress: record.data.emailAddress,
                  emailPassword: record.data.emailPassword,
                  status: record.data.status || "Unused",
                  imapStatus: record.data.imapStatus || "On",
                  assignedDeviceId: record.data.assignedDeviceId,
                  assignedCloneNumber: record.data.assignedCloneNumber,
                  assignedPackageName: record.data.assignedPackageName,
                  assignmentTimestamp: record.data.assignedDeviceId ? /* @__PURE__ */ new Date() : null
                }
              });
              importResults.imported++;
              progress.successCount++;
            } catch (error) {
              importResults.errors.push(
                `Row ${record.rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
              );
              progress.errorCount++;
            }
            progress.current++;
          }
        }, {
          timeout: 3e4
          // 30 second timeout per batch
        });
      } catch (batchError) {
        for (const record of batch) {
          if (progress.current < progress.total) {
            importResults.errors.push(
              `Row ${record.rowNumber}: Batch processing failed - ${batchError instanceof Error ? batchError.message : "Unknown error"}`
            );
            progress.errorCount++;
            progress.current++;
          }
        }
      }
      if (batchIndex < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    progress.phase = "complete";
    progress.message = "Import completed";
    const hasSuccessfulImports = importResults.imported > 0;
    const hasErrors = importResults.errors.length > 0;
    const isPartialSuccess = hasSuccessfulImports && hasErrors;
    console.log(`Import completed: ${importResults.imported} accounts imported, ${importResults.errors.length} errors, ${importResults.duplicatesSkipped} duplicates skipped`);
    const response = {
      success: hasSuccessfulImports,
      imported: importResults.imported,
      errors: importResults.errors,
      duplicatesSkipped: importResults.duplicatesSkipped,
      partialSuccess: isPartialSuccess,
      summary: {
        totalProcessed: progress.current,
        successful: progress.successCount,
        failed: progress.errorCount,
        duplicatesSkipped: importResults.duplicatesSkipped
      }
    };
    if (!hasSuccessfulImports) {
      return json(response, { status: 400 });
    } else if (isPartialSuccess) {
      return json(response, { status: 207 });
    } else {
      return json(response, { status: 201 });
    }
  } catch (error) {
    console.error("Import failed:", error);
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return json({
          success: false,
          error: "Import timed out. Please try importing a smaller dataset or contact support."
        }, { status: 408 });
      }
      if (error.message.includes("constraint")) {
        return json({
          success: false,
          error: "Database constraint violation. Please check for duplicate usernames or invalid data."
        }, { status: 409 });
      }
      if (error.message.includes("connection")) {
        return json({
          success: false,
          error: "Database connection error. Please try again in a moment."
        }, { status: 503 });
      }
    }
    return json({
      success: false,
      error: "Import failed due to an internal error. Please try again."
    }, { status: 500 });
  }
};
const GET = async ({ url }) => {
  try {
    const usernames = url.searchParams.get("usernames");
    if (!usernames) {
      return json({
        success: false,
        error: "No usernames provided for validation"
      }, { status: 400 });
    }
    const usernameList = usernames.split(",").map((u) => u.trim()).filter(Boolean);
    if (usernameList.length === 0) {
      return json({
        success: true,
        data: {
          existing: [],
          available: []
        }
      });
    }
    if (usernameList.length > 1e3) {
      return json({
        success: false,
        error: "Too many usernames for validation (max 1000)"
      }, { status: 400 });
    }
    const existingAccounts = await prisma.igAccount.findMany({
      where: {
        instagramUsername: { in: usernameList }
      },
      select: { instagramUsername: true }
    });
    const existingUsernames = existingAccounts.map((account) => account.instagramUsername);
    const availableUsernames = usernameList.filter(
      (username) => !existingUsernames.includes(username)
    );
    return json({
      success: true,
      data: {
        existing: existingUsernames,
        available: availableUsernames,
        totalChecked: usernameList.length,
        duplicateCount: existingUsernames.length
      }
    });
  } catch (error) {
    console.error("Username validation failed:", error);
    return json({
      success: false,
      error: "Failed to validate usernames"
    }, { status: 500 });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-DmuFhU9h.js.map
