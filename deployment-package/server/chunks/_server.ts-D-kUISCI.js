import { j as json } from './index-Djsj11qr.js';
import { A as AuthService } from './auth-direct-XClulT-4.js';
import { v as validateIPAccess, b as recordFailedAttempt } from './ip-whitelist-Di39y6GV.js';
import { v as validateAPIRequest } from './middleware-CRj8HrLf.js';
import { L as LoginSchema } from './schemas-CDG_pjll.js';
import 'bcrypt';
import 'pg';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './ip-utils-B5dp7ZZG.js';
import 'ip-address';
import 'zod';
import './db-security-logger-C-Isx1J6.js';

const POST = async (event) => {
  console.log("🔐 Login API endpoint called");
  const validation = await validateAPIRequest(event, {
    bodySchema: LoginSchema,
    rateLimit: {
      requests: 5,
      // 5 attempts
      windowMs: 15 * 60 * 1e3
      // per 15 minutes
    },
    logRequest: true
  });
  if (!validation.success) {
    return validation.response;
  }
  const { emailOrUsername, password, rememberMe } = validation.body;
  const { request, cookies } = event;
  try {
    console.log("📧 Login attempt for:", emailOrUsername);
    const ipValidation = await validateIPAccess(request, void 0, emailOrUsername.trim());
    if (!ipValidation.allowed) {
      if (ipValidation.publicIP) {
        await recordFailedAttempt(ipValidation.publicIP);
      }
      return json(
        {
          success: false,
          error: "Access denied",
          details: {
            reason: ipValidation.reason,
            publicIP: ipValidation.publicIP,
            code: "IP_ACCESS_DENIED"
          }
        },
        { status: 403 }
      );
    }
    const loginResult = await AuthService.authenticateUser(emailOrUsername.trim(), password);
    if (!loginResult.success) {
      if (ipValidation.publicIP) {
        await recordFailedAttempt(ipValidation.publicIP, loginResult.user?.id);
      }
      return json(
        {
          success: false,
          error: loginResult.error || "Invalid credentials"
        },
        { status: 401 }
      );
    }
    if (loginResult.user) {
      const finalIPValidation = await validateIPAccess(
        request,
        loginResult.user.id,
        loginResult.user.email
      );
      if (!finalIPValidation.allowed) {
        if (finalIPValidation.publicIP) {
          await recordFailedAttempt(finalIPValidation.publicIP, loginResult.user.id);
        }
        return json(
          {
            success: false,
            error: "Access denied for your account from this location",
            details: {
              reason: finalIPValidation.reason,
              publicIP: finalIPValidation.publicIP,
              code: "USER_IP_ACCESS_DENIED"
            }
          },
          { status: 403 }
        );
      }
    }
    const sessionToken = AuthService.generateSessionToken();
    const cookieOptions = AuthService.getSessionCookieOptions();
    if (rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60;
    }
    cookies.set("session", `${loginResult.user.id}:${sessionToken}`, cookieOptions);
    return json({
      success: true,
      user: loginResult.user
    });
  } catch (error) {
    console.error("Login API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error"
      },
      { status: 500 }
    );
  }
};

export { POST };
//# sourceMappingURL=_server.ts-D-kUISCI.js.map
