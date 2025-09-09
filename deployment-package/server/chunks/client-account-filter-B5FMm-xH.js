import { prisma } from './database-CKYbeswu.js';

async function getClientAccountsForScraping() {
  try {
    const accounts = await prisma.igAccount.findMany({
      where: {
        accountType: "CLIENT"
        // Only CLIENT accounts (not ML_TREND_FINDER)
        // Include both owned and unowned accounts
        // Unowned accounts are company accounts with op.pl emails ready for client assignment
      },
      select: {
        id: true,
        instagramUsername: true,
        // Note: using actual column name
        emailAddress: true,
        // Note: using actual column name
        ownerId: true,
        accountType: true,
        visibility: true,
        isShared: true,
        status: true,
        // Note: using actual column name
        loginTimestamp: true,
        // Note: using actual column name
        createdAt: true
      },
      orderBy: [
        { ownerId: "asc" },
        // Owned accounts first
        { instagramUsername: "asc" }
      ]
    });
    return accounts.map((account) => ({
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: account.ownerId ? parseInt(account.ownerId) : null,
      accountType: account.accountType || "CLIENT",
      visibility: account.visibility || "PRIVATE",
      isShared: account.isShared || false,
      currentStatus: account.status || "Unknown",
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    }));
  } catch (error) {
    console.error("Error fetching client accounts for scraping:", error);
    throw new Error(`Failed to fetch client accounts: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
async function getClientAccountStats() {
  try {
    const [totalStats, ownedStats, activeStats] = await Promise.all([
      // Total CLIENT accounts
      prisma.igAccount.count({
        where: { accountType: "CLIENT" }
      }),
      // Owned CLIENT accounts
      prisma.igAccount.count({
        where: {
          accountType: "CLIENT",
          ownerId: { not: null }
        }
      }),
      // Active accounts (recently logged in or in ready states)
      prisma.igAccount.count({
        where: {
          accountType: "CLIENT",
          status: { in: ["Active", "Online", "Ready", "Unused"] }
        }
      })
    ]);
    const unownedClientAccounts = totalStats - ownedStats;
    const eligibleForScraping = totalStats;
    return {
      totalClientAccounts: totalStats,
      ownedClientAccounts: ownedStats,
      unownedClientAccounts,
      activeAccounts: activeStats,
      eligibleForScraping
    };
  } catch (error) {
    console.error("Error fetching client account stats:", error);
    throw new Error(`Failed to fetch client account stats: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
function filterAccountsForScraping(accounts) {
  return accounts.filter((account) => {
    if (!account.username || account.username.trim() === "") {
      return false;
    }
    const problematicStates = ["Suspended", "Banned", "Deleted", "Error", "Failed"];
    if (account.currentStatus && problematicStates.includes(account.currentStatus)) {
      return false;
    }
    if (account.accountType !== "CLIENT") {
      return false;
    }
    return true;
  });
}
async function getClientAccountSample(limit = 5) {
  try {
    const [ownedAccounts, unownedAccounts] = await Promise.all([
      prisma.igAccount.findMany({
        where: {
          accountType: "CLIENT",
          ownerId: { not: null },
          status: { notIn: ["Suspended", "Banned", "Deleted", "Error", "Failed"] }
        },
        select: {
          id: true,
          instagramUsername: true,
          emailAddress: true,
          ownerId: true,
          accountType: true,
          visibility: true,
          isShared: true,
          status: true,
          loginTimestamp: true,
          createdAt: true
        },
        orderBy: { loginTimestamp: "desc" },
        take: Math.ceil(limit / 2)
        // Half the sample from owned accounts
      }),
      prisma.igAccount.findMany({
        where: {
          accountType: "CLIENT",
          ownerId: null,
          emailAddress: { contains: "@op.pl" },
          status: { notIn: ["Suspended", "Banned", "Deleted", "Error", "Failed"] }
        },
        select: {
          id: true,
          instagramUsername: true,
          emailAddress: true,
          ownerId: true,
          accountType: true,
          visibility: true,
          isShared: true,
          status: true,
          loginTimestamp: true,
          createdAt: true
        },
        orderBy: { instagramUsername: "asc" },
        take: Math.floor(limit / 2)
        // Half from unassigned company accounts
      })
    ]);
    const allAccounts = [...ownedAccounts, ...unownedAccounts].slice(0, limit);
    return allAccounts.map((account) => ({
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: account.ownerId ? parseInt(account.ownerId) : null,
      accountType: account.accountType || "CLIENT",
      visibility: account.visibility || "PRIVATE",
      isShared: account.isShared || false,
      currentStatus: account.status || "Unknown",
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    }));
  } catch (error) {
    console.error("Error fetching client account sample:", error);
    throw new Error(`Failed to fetch account sample: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export { getClientAccountSample as a, getClientAccountsForScraping as b, filterAccountsForScraping as f, getClientAccountStats as g };
//# sourceMappingURL=client-account-filter-B5FMm-xH.js.map
