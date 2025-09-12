import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { authHandle } from "./auth.js";

// Route definitions
const AUTH_ROUTES = ["/login", "/register", "/api/auth", "/api/google-oauth"];
const PUBLIC_ROUTES = ["/", "/unauthorized"];
const PROTECTED_ROUTES = ["/client-portal"];

const customHandle: Handle = async ({ event, resolve }) => {
  const { url, cookies } = event;
  const pathname = url.pathname;
  
  // Get Auth.js session if available
  const getSession = event.locals.getSession;
  if (getSession) {
    try {
      const session = await getSession();
      if (session?.user) {
        event.locals.user = {
          id: session.user.id || "",
          email: session.user.email || "",
          name: session.user.name || "",
          role: (session.user as any).role || "CLIENT",
          isActive: (session.user as any).isActive !== false,
          model: (session.user as any).model || null,
          picture: session.user.image,
          provider: (session.user as any).provider || "unknown"
        };
        console.log(`🔐 Auth.js session found for: ${session.user.email} (role: ${(session.user as any).role || "CLIENT"})`);
      }
    } catch (error) {
      console.error("Error getting Auth.js session:", error);
    }
  }
  
  // Fallback: Check for OAuth session cookie (legacy)
  if (!event.locals.user) {
    const userSession = cookies.get("user_session");
    if (userSession) {
      try {
        const sessionData = JSON.parse(userSession);
        if (sessionData.email && sessionData.loginTime) {
          event.locals.user = {
            id: sessionData.id || `oauth_${sessionData.email}`,
            email: sessionData.email,
            name: sessionData.name || sessionData.email,
            role: sessionData.role || "CLIENT",
            isActive: sessionData.isActive !== false,
            model: sessionData.model || null,
            picture: sessionData.picture,
            provider: sessionData.provider || "google"
          };
          console.log(`🔐 OAuth session found for: ${sessionData.email} (role: ${sessionData.role || "CLIENT"})`);
        }
      } catch (error) {
        console.error("Error parsing user session:", error);
        cookies.delete("user_session", { path: "/" });
      }
    }
  }
  
  // Route classification
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route);
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  // Allow public routes and auth routes
  if (isPublicRoute || isAuthRoute) {
    return resolve(event);
  }
  
  // Check if user is authenticated for protected routes
  if (isProtectedRoute) {
    if (!event.locals.user) {
      // Redirect unauthenticated users to login
      const redirectUrl = `/login?redirectTo=${encodeURIComponent(pathname)}`;
      console.log(`🔒 Redirecting unauthenticated user to: ${redirectUrl}`);
      throw redirect(302, redirectUrl);
    }
    
    // User is authenticated, allow access
    console.log(`✅ User ${event.locals.user.email} accessing ${pathname}`);
    return resolve(event);
  }
  
  // Handle root path - redirect to appropriate dashboard
  if (pathname === "/" && event.locals.user) {
    console.log(`🏠 Redirecting ${event.locals.user.email} to client portal`);
    throw redirect(302, "/client-portal");
  }
  
  // For all other routes, allow access for now
  return resolve(event);
};

export const handle: Handle = sequence(authHandle, customHandle);
