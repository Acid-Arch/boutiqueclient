import { r as redirect } from './index-Djsj11qr.js';
import { d as dev } from './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

const GET = async ({ url, cookies }) => {
  try {
    const returnUrl = url.searchParams.get("returnUrl") || "/client-portal";
    cookies.set("oauth_return_url", returnUrl, {
      path: "/",
      httpOnly: true,
      secure: !dev,
      sameSite: "lax",
      maxAge: 300
      // 5 minutes
    });
    const baseUrl = url.origin;
    const oauthUrl = `${baseUrl}/auth/signin/google`;
    const callbackUrl = `${baseUrl}/auth/callback/google`;
    const fullOAuthUrl = `${oauthUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    throw redirect(302, fullOAuthUrl);
  } catch (err) {
    console.error("OAuth initiation error:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw redirect(302, "/login?error=oauth_initiation_failed");
  }
};
const POST = async (event) => {
  return GET(event);
};

export { GET, POST };
//# sourceMappingURL=_server.ts-CHTazxBf.js.map
