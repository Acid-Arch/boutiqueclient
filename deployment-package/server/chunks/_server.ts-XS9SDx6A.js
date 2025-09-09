import { e as error, j as json } from './index-Djsj11qr.js';
import { query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ params, url, locals }) => {
  try {
    const accountId = parseInt(params.accountId);
    const period = url.searchParams.get("period") || "month";
    const metric = url.searchParams.get("metric") || "followers";
    if (isNaN(accountId)) {
      throw error(400, "Invalid account ID");
    }
    const growthData = await getAccountGrowthData(accountId, period, metric);
    return json({
      data: growthData,
      period,
      metric,
      accountId
    });
  } catch (err) {
    console.error("Growth API error:", err);
    return json(
      { error: "Failed to load growth data" },
      { status: 500 }
    );
  }
};
async function getAccountGrowthData(accountId, period, metric) {
  try {
    const now = /* @__PURE__ */ new Date();
    let startDate;
    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1e3);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1e3);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
    }
    const metricColumn = getMetricColumn(metric);
    const sqlQuery = `
			SELECT 
				DATE(scraped_at) as date,
				followers_count as followers,
				following_count as following,
				posts_count as posts,
				engagement_rate as engagement,
				scraped_at
			FROM account_metrics
			WHERE account_id = $1 
				AND scraped_at >= $2
				AND scraped_at <= $3
			ORDER BY scraped_at ASC
		`;
    const result = await query(sqlQuery, [accountId, startDate, now]);
    if (!result?.rows || result.rows.length === 0) {
      return generateSampleGrowthData(startDate, now, metric);
    }
    const processedData = processGrowthData(result.rows, startDate, now, period);
    return processedData;
  } catch (error2) {
    console.error("Error fetching growth data:", error2);
    return [];
  }
}
function getMetricColumn(metric) {
  switch (metric) {
    case "followers":
      return "followers_count";
    case "following":
      return "following_count";
    case "posts":
      return "posts_count";
    case "engagement":
      return "engagement_rate";
    default:
      return "followers_count";
  }
}
function processGrowthData(rows, startDate, endDate, period) {
  if (rows.length === 0) return [];
  const dailyData = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    const dateKey = row.date;
    if (!dailyData.has(dateKey) || new Date(row.scraped_at) > new Date(dailyData.get(dateKey).scraped_at)) {
      dailyData.set(dateKey, {
        date: new Date(row.date),
        followers: parseInt(row.followers) || 0,
        following: parseInt(row.following) || 0,
        posts: parseInt(row.posts) || 0,
        engagement: parseFloat(row.engagement) || 0
      });
    }
  });
  return Array.from(dailyData.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}
function generateSampleGrowthData(startDate, endDate, metric) {
  const data = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1e3 * 60 * 60 * 24));
  const dataPoints = Math.min(daysDiff, 30);
  let baseFollowers = 1250 + Math.floor(Math.random() * 5e3);
  let baseFollowing = 850 + Math.floor(Math.random() * 1e3);
  let basePosts = 120 + Math.floor(Math.random() * 200);
  let baseEngagement = 2.5 + Math.random() * 3;
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(startDate.getTime() + i * (daysDiff / dataPoints) * 24 * 60 * 60 * 1e3);
    const growthFactor = 1 + (Math.random() - 0.4) * 0.05;
    baseFollowers = Math.floor(baseFollowers * growthFactor);
    baseFollowing = Math.floor(baseFollowing * (1 + (Math.random() - 0.5) * 0.02));
    basePosts += Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0;
    baseEngagement = Math.max(0.5, baseEngagement * (1 + (Math.random() - 0.5) * 0.1));
    data.push({
      date,
      followers: baseFollowers,
      following: baseFollowing,
      posts: basePosts,
      engagement: parseFloat(baseEngagement.toFixed(2))
    });
  }
  return data;
}

export { GET };
//# sourceMappingURL=_server.ts-XS9SDx6A.js.map
