import { e as error, j as json, r as redirect } from './index-Djsj11qr.js';
import { d as dev } from './index-Dn7PghUK.js';
import { G as GOOGLE_CLIENT_ID, a as GOOGLE_CLIENT_SECRET } from './auth-direct-XClulT-4.js';
import { O as OAuthService } from './oauth-service-DiGELVR6.js';
import './false-B2gHlHjM.js';
import 'bcrypt';
import 'pg';

const GET = async ({ url, cookies }) => {
  const action = url.searchParams.get("action");
  try {
    switch (action) {
      case "initiate":
        await handleOAuthInitiation(url, cookies);
        return new Response(null, { status: 302 });
      case "callback":
        await handleOAuthCallback(url, cookies);
        return new Response(null, { status: 302 });
      case "status":
        return handleOAuthStatus();
      default:
        throw error(400, "Invalid OAuth action. Use ?action=initiate, ?action=callback, or ?action=status");
    }
  } catch (err) {
    console.error("OAuth endpoint error:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "OAuth authentication failed");
  }
};
async function handleOAuthInitiation(url, cookies) {
  const state = generateSecureState();
  const returnUrl = url.searchParams.get("returnUrl") || "/client-portal";
  cookies.set("oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: !dev,
    sameSite: "lax",
    maxAge: 300
    // 5 minutes
  });
  cookies.set("oauth_return_url", returnUrl, {
    path: "/",
    httpOnly: true,
    secure: !dev,
    sameSite: "lax",
    maxAge: 300
    // 5 minutes
  });
  const baseUrl = "https://your-domain.com";
  const redirectUri = `${baseUrl}/api/auth/oauth/google?action=callback`;
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("state", state);
  throw redirect(302, googleAuthUrl.toString());
}
async function handleOAuthCallback(url, cookies) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error_param = url.searchParams.get("error");
  const storedState = cookies.get("oauth_state");
  const returnUrl = cookies.get("oauth_return_url") || "/client-portal";
  cookies.delete("oauth_state", { path: "/" });
  cookies.delete("oauth_return_url", { path: "/" });
  if (error_param) {
    console.error("OAuth error from Google:", error_param);
    throw redirect(302, `/login?error=oauth_error&message=${encodeURIComponent(error_param)}`);
  }
  if (!state || !storedState || state !== storedState) {
    console.error("OAuth state mismatch:", { received: state, stored: storedState });
    throw redirect(302, "/login?error=oauth_state_mismatch");
  }
  if (!code) {
    console.error("Missing OAuth authorization code");
    throw redirect(302, "/login?error=oauth_no_code");
  }
  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    const userProfile = await getGoogleUserProfile(tokenResponse.access_token);
    if (!OAuthService.validateGoogleProfile(userProfile)) {
      throw new Error("Invalid Google profile structure");
    }
    const oauthResult = await OAuthService.handleGoogleCallback(userProfile);
    if (!oauthResult.success) {
      console.error("OAuth user handling failed:", oauthResult.error);
      throw redirect(302, `/login?error=oauth_user_error&message=${encodeURIComponent(oauthResult.error || "Authentication failed")}`);
    }
    if (!oauthResult.user) {
      throw new Error("No user returned from OAuth handling");
    }
    const sessionData = await OAuthService.createOAuthSession(oauthResult.user, new Request(url.toString()));
    cookies.set("session", `${oauthResult.user.id}:${sessionData.token}`, sessionData.cookieOptions);
    const successUrl = new URL(returnUrl, url.origin);
    if (oauthResult.isNewUser) {
      successUrl.searchParams.set("welcome", "true");
    }
    if (oauthResult.accountLinked) {
      successUrl.searchParams.set("linked", "true");
    }
    throw redirect(302, successUrl.toString());
  } catch (err) {
    console.error("OAuth callback processing error:", err);
    const errorMessage = err instanceof Error ? err.message : "Authentication failed";
    throw redirect(302, `/login?error=oauth_callback_error&message=${encodeURIComponent(errorMessage)}`);
  }
}
async function handleOAuthStatus() {
  return json({
    provider: "google",
    available: true,
    clientId: "configured",
    clientSecret: "configured",
    redirectUris: {
      development: "http://localhost:5173/api/auth/oauth/google?action=callback",
      production: "https://your-domain.com/api/auth/oauth/google?action=callback"
    }
  });
}
async function exchangeCodeForTokens(code) {
  const baseUrl = "https://your-domain.com";
  const redirectUri = `${baseUrl}/api/auth/oauth/google?action=callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error("Token exchange failed:", errorData);
    throw new Error("Failed to exchange authorization code for tokens");
  }
  const tokens = await tokenResponse.json();
  if (!tokens.access_token) {
    throw new Error("No access token received from Google");
  }
  return tokens;
}
async function getGoogleUserProfile(accessToken) {
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });
  if (!profileResponse.ok) {
    const errorData = await profileResponse.text();
    console.error("Profile fetch failed:", errorData);
    throw new Error("Failed to fetch user profile from Google");
  }
  const profile = await profileResponse.json();
  if (!profile.id || !profile.email || !profile.name) {
    throw new Error("Incomplete profile data from Google");
  }
  return profile;
}
function generateSecureState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export { GET };
//# sourceMappingURL=_server.ts-Bp5ag_qK.js.map
