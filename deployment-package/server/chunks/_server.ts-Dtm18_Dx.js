import { e as error, j as json } from './index-Djsj11qr.js';
import { query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ params, locals }) => {
  try {
    const accountId = parseInt(params.accountId);
    if (isNaN(accountId)) {
      throw error(400, "Invalid account ID");
    }
    const metricsData = await getLatestAccountMetrics(accountId);
    if (!metricsData) {
      return json({
        data: {
          followers: 0,
          following: 0,
          posts: 0,
          avgLikes: 0,
          avgComments: 0,
          engagementRate: 0,
          lastScraped: null,
          scrapingStatus: "PENDING",
          dataQuality: 0
        }
      });
    }
    return json({
      data: {
        followers: metricsData.followers_count || 0,
        following: metricsData.following_count || 0,
        posts: metricsData.posts_count || 0,
        avgLikes: metricsData.average_likes || 0,
        avgComments: metricsData.average_comments || 0,
        engagementRate: metricsData.engagement_rate || 0,
        lastScraped: metricsData.scraped_at,
        scrapingStatus: metricsData.scraping_status || "PENDING",
        dataQuality: metricsData.data_quality || 0
      }
    });
  } catch (err) {
    console.error("Metrics API error:", err);
    return json(
      { error: "Failed to load account metrics" },
      { status: 500 }
    );
  }
};
async function getLatestAccountMetrics(accountId) {
  try {
    const sqlQuery = `
			SELECT 
				account_id,
				followers_count,
				following_count,
				posts_count,
				average_likes,
				average_comments,
				engagement_rate,
				data_quality,
				scraping_status,
				scraped_at,
				created_at
			FROM account_metrics
			WHERE account_id = $1
			ORDER BY scraped_at DESC
			LIMIT 1
		`;
    const result = await query(sqlQuery, [accountId]);
    if (result?.rows && result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error2) {
    console.error("Error fetching account metrics:", error2);
    return null;
  }
}

export { GET };
//# sourceMappingURL=_server.ts-Dtm18_Dx.js.map
