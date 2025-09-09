import { query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ params, url }) => {
  try {
    const username = params.username;
    const size = parseInt(url.searchParams.get("size") || "80");
    if (!username) {
      return new Response("Username required", { status: 400 });
    }
    try {
      const profileResult = await query(`
				SELECT profile_picture_url 
				FROM account_metrics 
				WHERE username = $1 
				ORDER BY scraped_at DESC 
				LIMIT 1
			`, [username]);
      if (profileResult?.rows?.[0]?.profile_picture_url) {
        const profilePictureUrl = profileResult.rows[0].profile_picture_url;
        if (profilePictureUrl.startsWith("http")) {
          return new Response(null, {
            status: 302,
            headers: {
              "Location": profilePictureUrl,
              "Cache-Control": "public, max-age=3600"
            }
          });
        }
      }
    } catch (error) {
      console.log("Could not fetch profile picture from database:", error);
    }
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&size=${size}&backgroundColor=3b82f6&textColor=ffffff`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": avatarUrl,
        "Cache-Control": "public, max-age=86400"
        // Cache for 24 hours
      }
    });
  } catch (error) {
    console.error("Avatar API error:", error);
    const fallbackUrl = `https://api.dicebear.com/7.x/initials/svg?seed=user&size=80&backgroundColor=6b7280&textColor=ffffff`;
    return new Response(null, {
      status: 302,
      headers: {
        "Location": fallbackUrl,
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
};

export { GET };
//# sourceMappingURL=_server.ts-BUIJA23M.js.map
