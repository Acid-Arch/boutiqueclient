import { prisma } from './database-CKYbeswu.js';
import { l as logUserModelAccess } from './model-access-EMLSkZSA.js';
import pg from 'pg';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './status-BUw8K8Dp.js';

const load = async ({ locals }) => {
  if (!locals.user) {
    return {
      accounts: [],
      stats: {
        totalAccounts: 0,
        activeAccounts: 0,
        assignedDevices: 0,
        totalFollowers: 0
      }
    };
  }
  try {
    logUserModelAccess(locals.user);
    const accounts = await getUserAccountsWithModelAccess(locals.user);
    console.log(`📋 Accounts page: Found ${accounts.length} accounts for user ${locals.user.email}`);
    const stats = {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.status === "Active").length,
      assignedDevices: accounts.filter((a) => a.assignedDevice).length,
      totalFollowers: accounts.reduce((sum, a) => sum + (a.followers || 0), 0)
    };
    return {
      accounts,
      stats
    };
  } catch (error) {
    console.error("Error loading accounts data:", error);
    return {
      accounts: [],
      stats: {
        totalAccounts: 0,
        activeAccounts: 0,
        assignedDevices: 0,
        totalFollowers: 0
      }
    };
  }
};
async function getUserAccountsWithModelAccess(user) {
  try {
    const igAccounts = await prisma.igAccount.findMany({
      where: {
        OR: [
          { ownerId: parseInt(user.id) },
          ...user.email.includes("@gmail.com") ? [{ model: "Dillion" }] : []
        ]
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return transformAccountsForUI(igAccounts);
  } catch (error) {
    console.log("⚠️  Prisma failed, using direct SQL for accounts page");
    return await getUserAccountsDirectSQL(user);
  }
}
async function getUserAccountsDirectSQL(user) {
  const { Client } = pg;
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30"
  });
  try {
    await client.connect();
    let modelFilter = "";
    const queryParams = [user.id];
    if (user.email && user.email.includes("@gmail.com")) {
      modelFilter = `OR (model = 'Dillion' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
      console.log(`🔑 Accounts SQL: Adding Dillion model access for Gmail user: ${user.email}`);
    }
    if (user.email && (user.email.includes("@hotmail.") || user.email.includes("@live.") || user.email.includes("@outlook."))) {
      modelFilter = `OR (model = 'katie' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
      console.log(`🔑 Accounts SQL: Adding katie model access for Hotmail user: ${user.email}`);
    }
    const accountsQuery = `
			SELECT 
				id, instagram_username, instagram_password, email_address, email_password,
				status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
				assignment_timestamp, login_timestamp, created_at, updated_at,
				owner_id, account_type, visibility, is_shared, model
			FROM ig_accounts 
			WHERE (
				(owner_id = $1 AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				OR 
				(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				${modelFilter}
			)
			ORDER BY updated_at DESC 
			LIMIT 1000
		`;
    const result = await client.query(accountsQuery, queryParams);
    const accounts = result.rows.map((row) => ({
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
    }));
    return transformAccountsForUI(accounts);
  } finally {
    await client.end();
  }
}
function transformAccountsForUI(igAccounts) {
  return igAccounts.map((account) => ({
    id: account.id.toString(),
    username: account.instagramUsername,
    email: account.emailAddress,
    status: mapAccountStatus(account.status),
    assignedDevice: account.assignedDeviceId,
    lastLogin: formatTimeAgo(account.loginTimestamp),
    followers: estimateFollowers(account.status),
    // Estimate based on account status
    visibility: mapAccountVisibility(account.visibility),
    model: account.model || "Unassigned"
  }));
}
function estimateFollowers(status) {
  switch (status?.toLowerCase()) {
    case "logged in":
    case "active":
      return 3500;
    // Fixed: Active accounts = 3,500 followers
    case "assigned":
      return 3500;
    // Fixed: Assigned accounts = 3,500 followers  
    case "unused":
    case "inactive":
    default:
      return 1200;
  }
}
function mapAccountStatus(dbStatus) {
  switch (dbStatus?.toLowerCase()) {
    case "active":
    case "assigned":
    case "logged in":
      return "Active";
    case "unused":
    case "inactive":
    case "failed":
      return "Inactive";
    default:
      return "Inactive";
  }
}
function mapAccountVisibility(dbVisibility) {
  switch (dbVisibility) {
    case "PRIVATE":
      return "Private";
    case "SHARED":
      return "Shared";
    case "PUBLIC":
      return "Public";
    default:
      return "Private";
  }
}
function formatTimeAgo(date) {
  if (!date) return "Never";
  const now = /* @__PURE__ */ new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1e3 * 60));
  const diffInHours = Math.floor(diffInMs / (1e3 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1e3 * 60 * 60 * 24));
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 4;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-9jh9KS9i.js')).default;
const server_id = "src/routes/client-portal/accounts/+page.server.ts";
const imports = ["_app/immutable/nodes/4.sv5XSvGM.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DX-Oc8op.js","_app/immutable/chunks/3zx2OM-S.js","_app/immutable/chunks/Dwjkgfq3.js","_app/immutable/chunks/z8oQ6GeD.js","_app/immutable/chunks/ugyboSLg.js","_app/immutable/chunks/BrzuSUaY.js","_app/immutable/chunks/lPcixCUF.js","_app/immutable/chunks/mTYbsNnE.js","_app/immutable/chunks/BID1lDIu.js","_app/immutable/chunks/CUm0MUH_.js","_app/immutable/chunks/BQu96azb.js","_app/immutable/chunks/Bwnq7jH9.js","_app/immutable/chunks/CN0Dtqqk.js","_app/immutable/chunks/CApEzOLg.js","_app/immutable/chunks/BhGjRHH1.js","_app/immutable/chunks/DvgHziNU.js","_app/immutable/chunks/BEt7RVes.js","_app/immutable/chunks/C0A-HqK_.js","_app/immutable/chunks/DdD0hk9E.js","_app/immutable/chunks/Dx4riVje.js"];
const stylesheets = ["_app/immutable/assets/4.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=4-Dfp8fdIy.js.map
