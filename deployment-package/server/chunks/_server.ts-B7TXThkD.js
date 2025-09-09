import { r as redirect, j as json } from './index-Djsj11qr.js';
import { O as OAuthService } from './oauth-service-DiGELVR6.js';
import 'pg';
import './auth-direct-XClulT-4.js';
import 'bcrypt';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

const GET = async ({ url, cookies, locals }) => {
  try {
    const returnUrl = cookies.get("oauth_return_url") || "/client-portal";
    cookies.delete("oauth_return_url", { path: "/" });
    const error = url.searchParams.get("error");
    if (error) {
      console.error("OAuth callback error:", error);
      throw redirect(302, `/login?error=oauth_error&message=${encodeURIComponent(error)}`);
    }
    if (locals.user) {
      const successUrl = new URL(returnUrl, url.origin);
      successUrl.searchParams.set("oauth_success", "true");
      throw redirect(302, successUrl.toString());
    }
    throw redirect(302, "/login?error=oauth_no_session");
  } catch (err) {
    console.error("OAuth callback processing error:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw redirect(302, "/login?error=oauth_callback_failed");
  }
};
const POST = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    if (!body.user || !body.account || !body.profile) {
      return json({ error: "Invalid callback payload" }, { status: 400 });
    }
    const googleProfile = {
      sub: body.profile.id,
      email: body.profile.email,
      name: body.profile.name,
      given_name: body.profile.given_name,
      family_name: body.profile.family_name,
      picture: body.profile.picture
    };
    if (!OAuthService.validateGoogleProfile(googleProfile)) {
      return json({ error: "Invalid Google profile structure" }, { status: 400 });
    }
    const oauthResult = await OAuthService.handleGoogleCallback(googleProfile);
    if (!oauthResult.success) {
      return json({
        error: "OAuth authentication failed",
        details: oauthResult.error
      }, { status: 400 });
    }
    if (!oauthResult.user) {
      return json({ error: "No user data returned" }, { status: 400 });
    }
    const sessionData = await OAuthService.createOAuthSession(oauthResult.user, request);
    return json({
      success: true,
      user: oauthResult.user,
      session: {
        token: sessionData.token,
        cookieOptions: sessionData.cookieOptions
      },
      isNewUser: oauthResult.isNewUser,
      accountLinked: oauthResult.accountLinked
    });
  } catch (err) {
    console.error("OAuth POST callback error:", err);
    return json({
      error: "OAuth callback processing failed",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-B7TXThkD.js.map
