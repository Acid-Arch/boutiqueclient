import { j as json } from './index-Djsj11qr.js';
import { getDb, getAccountsCount, query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ url, locals }) => {
  try {
    const stats = await getDashboardStats();
    return json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return json(
      { error: "Failed to load dashboard statistics" },
      { status: 500 }
    );
  }
};
async function getDashboardStats() {
  try {
    const db = await getDb();
    const totalAccounts = await getAccountsCount();
    let scrapedAccounts = 0;
    let activeSessions = 0;
    let totalRequestUnits = 0;
    let usedBudget = 0;
    try {
      const scrapedAccountsResult = await query(`
				SELECT COUNT(DISTINCT account_id) as count
				FROM account_metrics
			`);
      scrapedAccounts = parseInt(scrapedAccountsResult?.rows?.[0]?.count || "0");
    } catch (error) {
      console.log("account_metrics table not found, using default value 0");
    }
    try {
      const activeSessionsResult = await query(`
				SELECT COUNT(*) as count
				FROM scraping_sessions
				WHERE status IN ('INITIALIZING', 'RUNNING', 'PAUSED')
			`);
      activeSessions = parseInt(activeSessionsResult?.rows?.[0]?.count || "0");
    } catch (error) {
      console.log("scraping_sessions table not found, using default value 0");
    }
    try {
      const now = /* @__PURE__ */ new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const budgetResult = await query(`
				SELECT 
					COALESCE(SUM(total_request_units), 0) as total_units,
					COALESCE(SUM(estimated_cost), 0) as total_cost
				FROM scraping_sessions
				WHERE created_at >= $1
			`, [monthStart]);
      totalRequestUnits = parseInt(budgetResult?.rows?.[0]?.total_units || "0");
      usedBudget = parseFloat(budgetResult?.rows?.[0]?.total_cost || "0");
    } catch (error) {
      console.log("scraping_sessions table not found for budget calculation, using default values");
    }
    const monthlyBudget = 100;
    return {
      totalAccounts: parseInt(totalAccounts.toString()),
      scrapedAccounts,
      activeSessions,
      totalRequestUnits,
      monthlyBudget,
      usedBudget
    };
  } catch (error) {
    console.error("Error calculating dashboard stats:", error);
    const fallbackCount = await getAccountsCount();
    return {
      totalAccounts: parseInt(fallbackCount.toString()),
      scrapedAccounts: 0,
      activeSessions: 0,
      totalRequestUnits: 0,
      monthlyBudget: 100,
      usedBudget: 0
    };
  }
}

export { GET };
//# sourceMappingURL=_server.ts-fU2olyRt.js.map
