import { j as json } from './index-Djsj11qr.js';

const POST = async ({ cookies, locals }) => {
  try {
    console.log("🔐 Server-side logout initiated");
    cookies.delete("session", { path: "/" });
    const authCookieNames = [
      "authjs.session-token",
      "__Secure-authjs.session-token",
      "__Host-authjs.session-token",
      "authjs.csrf-token",
      "__Secure-authjs.csrf-token",
      "authjs.callback-url",
      "__Secure-authjs.callback-url",
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "__Host-next-auth.session-token"
    ];
    authCookieNames.forEach((name) => {
      cookies.delete(name, { path: "/" });
      cookies.delete(name, { path: "/", secure: true });
      cookies.delete(name, { path: "/", domain: "localhost" });
    });
    cookies.delete("__session", { path: "/" });
    cookies.delete("connect.sid", { path: "/" });
    locals.user = void 0;
    console.log("🔐 User logged out successfully - cookies cleared");
    return json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return json({ success: false, error: "Logout failed" }, { status: 500 });
  }
};

export { POST };
//# sourceMappingURL=_server.ts-DOlcH4n_.js.map
