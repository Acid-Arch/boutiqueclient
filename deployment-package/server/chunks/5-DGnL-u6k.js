import { l as logUserModelAccess } from './model-access-EMLSkZSA.js';
import pg from 'pg';

async function getAccountsWithModelAccess(user) {
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
      console.log(`🔑 SQL: Adding Dillion model access for Gmail user: ${user.email}`);
    }
    if (user.email && (user.email.includes("@hotmail.") || user.email.includes("@live.") || user.email.includes("@outlook."))) {
      modelFilter = `OR (model = 'katie' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
      console.log(`🔑 SQL: Adding katie model access for Hotmail user: ${user.email}`);
    }
    const accountsQuery = `
			SELECT 
				id, instagram_username, instagram_password, email_address, email_password,
				status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
				assignment_timestamp, login_timestamp, created_at, updated_at,
				owner_id, account_type, visibility, is_shared, model,
				follower_count, following_count, post_count, total_engagement, engagement_rate,
				follower_growth_30d, engagement_growth_30d, last_scraped_at
			FROM ig_accounts 
			WHERE (
				(owner_id = $1 AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				OR 
				(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				${modelFilter}
			)
			ORDER BY created_at DESC 
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
      model: row.model,
      followerCount: row.follower_count,
      followingCount: row.following_count,
      postCount: row.post_count,
      totalEngagement: row.total_engagement,
      engagementRate: parseFloat(row.engagement_rate || 0),
      followerGrowth30d: row.follower_growth_30d,
      engagementGrowth30d: parseFloat(row.engagement_growth_30d || 0),
      lastScrapedAt: row.last_scraped_at
    }));
    return { accounts, totalCount: accounts.length };
  } finally {
    await client.end();
  }
}
const load = async ({ locals }) => {
  if (!locals.user) {
    return {
      analytics: {
        totalFollowers: 0,
        totalEngagement: 0,
        avgEngagementRate: 0,
        totalPosts: 0,
        followerGrowth: 0,
        engagementGrowth: 0,
        accounts: []
      }
    };
  }
  try {
    logUserModelAccess(locals.user);
    const { accounts } = await getAccountsWithModelAccess(locals.user);
    console.log(`📊 Analytics: Found ${accounts.length} accounts for user ${locals.user.email}`);
    const analytics = {
      totalFollowers: calculateTotalFollowers(accounts),
      totalEngagement: calculateTotalEngagement(accounts),
      avgEngagementRate: calculateEngagementRate(accounts),
      totalPosts: calculateTotalPosts(accounts),
      followerGrowth: calculateFollowerGrowth(accounts),
      engagementGrowth: calculateEngagementGrowth(accounts),
      accounts: accounts.slice(0, 20)
      // Limit for analytics display
    };
    console.log(`📈 Analytics stats: ${analytics.totalFollowers} followers, ${analytics.totalPosts} posts, ${analytics.avgEngagementRate}% engagement`);
    return { analytics };
  } catch (error) {
    console.error("Error loading analytics data:", error);
    return {
      analytics: {
        totalFollowers: 0,
        totalEngagement: 0,
        avgEngagementRate: 0,
        totalPosts: 0,
        followerGrowth: 0,
        engagementGrowth: 0,
        accounts: []
      }
    };
  }
};
function calculateTotalFollowers(accounts) {
  return accounts.reduce((total, acc) => {
    return total + (acc.followerCount || 0);
  }, 0);
}
function calculateTotalEngagement(accounts) {
  return accounts.reduce((total, acc) => {
    return total + (acc.totalEngagement || 0);
  }, 0);
}
function calculateEngagementRate(accounts) {
  if (accounts.length === 0) return 0;
  const accountsWithData = accounts.filter((acc) => acc.engagementRate && acc.engagementRate > 0);
  if (accountsWithData.length === 0) return 0;
  const totalRate = accountsWithData.reduce((sum, acc) => sum + acc.engagementRate, 0);
  return Math.round(totalRate / accountsWithData.length * 100) / 100;
}
function calculateTotalPosts(accounts) {
  return accounts.reduce((total, acc) => {
    return total + (acc.postCount || 0);
  }, 0);
}
function calculateFollowerGrowth(accounts) {
  if (accounts.length === 0) return 0;
  const accountsWithGrowthData = accounts.filter(
    (acc) => typeof acc.followerGrowth30d === "number"
  );
  if (accountsWithGrowthData.length === 0) return 0;
  const totalGrowth = accountsWithGrowthData.reduce((sum, acc) => sum + acc.followerGrowth30d, 0);
  const totalFollowers = accountsWithGrowthData.reduce((sum, acc) => sum + (acc.followerCount || 1), 0);
  return Math.round(totalGrowth / totalFollowers * 100 * 10) / 10;
}
function calculateEngagementGrowth(accounts) {
  if (accounts.length === 0) return 0;
  const accountsWithEngagementGrowth = accounts.filter(
    (acc) => typeof acc.engagementGrowth30d === "number"
  );
  if (accountsWithEngagementGrowth.length === 0) return 0;
  const totalGrowth = accountsWithEngagementGrowth.reduce((sum, acc) => sum + acc.engagementGrowth30d, 0);
  return Math.round(totalGrowth / accountsWithEngagementGrowth.length * 100) / 100;
}

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 5;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-De0MG8jL.js')).default;
const server_id = "src/routes/client-portal/analytics/+page.server.ts";
const imports = ["_app/immutable/nodes/5.DwD9ztFQ.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DX-Oc8op.js","_app/immutable/chunks/3zx2OM-S.js","_app/immutable/chunks/Dwjkgfq3.js","_app/immutable/chunks/BrzuSUaY.js","_app/immutable/chunks/lPcixCUF.js","_app/immutable/chunks/Bwnq7jH9.js","_app/immutable/chunks/BID1lDIu.js","_app/immutable/chunks/z8oQ6GeD.js","_app/immutable/chunks/Dx4riVje.js","_app/immutable/chunks/BAf6IcXK.js","_app/immutable/chunks/Dcut3OIX.js","_app/immutable/chunks/C0A-HqK_.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=5-DGnL-u6k.js.map
