import { r as redirect } from './index-Djsj11qr.js';
import { g as get_request_store, m as merge_tracing, w as with_request_store } from './index-Bdw6HGPk.js';
import { d as dev } from './index-Dn7PghUK.js';
import { a as authHandle } from './auth-D00jg8WF.js';
import { A as AuthService } from './auth-direct-XClulT-4.js';
import { l as logger, L as LogLevel } from './logger-RU41djIi.js';
import { r as recordResponseTime, i as incrementErrorCount } from './metrics-CPwQmnJJ.js';
import { d as rateLimitMiddleware } from './rate-limiter-comprehensive-DZzPnbd1.js';
import './false-B2gHlHjM.js';
import './set-cookie-CLsaEPEn.js';
import './utils-Bg2Rux6K.js';
import './index2-BbWlCfnE.js';
import './index3-0vHBXF6s.js';
import 'clsx';
import 'cookie';
import './events-D7LqLiIZ.js';
import '@auth/core';
import '@auth/core/errors';
import 'bcrypt';
import 'pg';
import 'winston';
import 'pino';
import 'rate-limiter-flexible';

/** @import { Handle, RequestEvent, ResolveOptions } from '@sveltejs/kit' */
/** @import { MaybePromise } from 'types' */

/**
 * A helper function for sequencing multiple `handle` calls in a middleware-like manner.
 * The behavior for the `handle` options is as follows:
 * - `transformPageChunk` is applied in reverse order and merged
 * - `preload` is applied in forward order, the first option "wins" and no `preload` options after it are called
 * - `filterSerializedResponseHeaders` behaves the same as `preload`
 *
 * ```js
 * /// file: src/hooks.server.js
 * import { sequence } from '@sveltejs/kit/hooks';
 *
 * /// type: import('@sveltejs/kit').Handle
 * async function first({ event, resolve }) {
 * 	console.log('first pre-processing');
 * 	const result = await resolve(event, {
 * 		transformPageChunk: ({ html }) => {
 * 			// transforms are applied in reverse order
 * 			console.log('first transform');
 * 			return html;
 * 		},
 * 		preload: () => {
 * 			// this one wins as it's the first defined in the chain
 * 			console.log('first preload');
 * 			return true;
 * 		}
 * 	});
 * 	console.log('first post-processing');
 * 	return result;
 * }
 *
 * /// type: import('@sveltejs/kit').Handle
 * async function second({ event, resolve }) {
 * 	console.log('second pre-processing');
 * 	const result = await resolve(event, {
 * 		transformPageChunk: ({ html }) => {
 * 			console.log('second transform');
 * 			return html;
 * 		},
 * 		preload: () => {
 * 			console.log('second preload');
 * 			return true;
 * 		},
 * 		filterSerializedResponseHeaders: () => {
 * 			// this one wins as it's the first defined in the chain
 * 			console.log('second filterSerializedResponseHeaders');
 * 			return true;
 * 		}
 * 	});
 * 	console.log('second post-processing');
 * 	return result;
 * }
 *
 * export const handle = sequence(first, second);
 * ```
 *
 * The example above would print:
 *
 * ```
 * first pre-processing
 * first preload
 * second pre-processing
 * second filterSerializedResponseHeaders
 * second transform
 * first transform
 * second post-processing
 * first post-processing
 * ```
 *
 * @param {...Handle} handlers The chain of `handle` functions
 * @returns {Handle}
 */
function sequence(...handlers) {
	const length = handlers.length;
	if (!length) return ({ event, resolve }) => resolve(event);

	return ({ event, resolve }) => {
		const { state } = get_request_store();
		return apply_handle(0, event, {});

		/**
		 * @param {number} i
		 * @param {RequestEvent} event
		 * @param {ResolveOptions | undefined} parent_options
		 * @returns {MaybePromise<Response>}
		 */
		function apply_handle(i, event, parent_options) {
			const handle = handlers[i];

			return state.tracing.record_span({
				name: `sveltekit.handle.sequenced.${handle.name ? handle.name : i}`,
				attributes: {},
				fn: async (current) => {
					const traced_event = merge_tracing(event, current);
					return await with_request_store({ event: traced_event, state }, () =>
						handle({
							event: traced_event,
							resolve: (event, options) => {
								/** @type {ResolveOptions['transformPageChunk']} */
								const transformPageChunk = async ({ html, done }) => {
									if (options?.transformPageChunk) {
										html = (await options.transformPageChunk({ html, done })) ?? '';
									}

									if (parent_options?.transformPageChunk) {
										html = (await parent_options.transformPageChunk({ html, done })) ?? '';
									}

									return html;
								};

								/** @type {ResolveOptions['filterSerializedResponseHeaders']} */
								const filterSerializedResponseHeaders =
									parent_options?.filterSerializedResponseHeaders ??
									options?.filterSerializedResponseHeaders;

								/** @type {ResolveOptions['preload']} */
								const preload = parent_options?.preload ?? options?.preload;

								return i < length - 1
									? apply_handle(i + 1, event, {
											transformPageChunk,
											filterSerializedResponseHeaders,
											preload
										})
									: resolve(event, {
											transformPageChunk,
											filterSerializedResponseHeaders,
											preload
										});
							}
						})
					);
				}
			});
		}
	};
}

const PERMISSIONS = {
  // Route Access Permissions
  canAccessAdminPortal: (role) => role === "ADMIN",
  canAccessClientPortal: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  // Data Modification Permissions
  canModifyAccounts: (role) => ["ADMIN", "CLIENT"].includes(role),
  canModifyDevices: (role) => role === "ADMIN",
  canModifyAutomation: (role) => ["ADMIN", "CLIENT"].includes(role),
  canModifyScraping: (role) => ["ADMIN", "CLIENT"].includes(role),
  // View Permissions
  canViewAccounts: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  canViewDevices: (role) => role === "ADMIN",
  canViewAutomation: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  canViewScraping: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  canViewAnalytics: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  // Administrative Permissions
  canManageUsers: (role) => role === "ADMIN",
  canManageSystem: (role) => role === "ADMIN",
  canExportData: (role) => ["ADMIN", "CLIENT"].includes(role),
  canImportData: (role) => ["ADMIN", "CLIENT"].includes(role),
  // Bulk Operations
  canPerformBulkOperations: (role) => ["ADMIN", "CLIENT"].includes(role),
  // Chat/AI Features
  canUseChatbot: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  // Account Ownership Permissions
  canViewOwnAccounts: (role) => ["ADMIN", "CLIENT", "VIEWER"].includes(role),
  canViewMLAccounts: (role) => role === "ADMIN",
  canViewAllAccounts: (role) => role === "ADMIN",
  canManageAccountOwnership: (role) => role === "ADMIN",
  canAssignAccounts: (role) => role === "ADMIN",
  canViewUnassignedAccounts: (role) => role === "ADMIN"
};
const userCan = {
  accessAdminPortal: (user) => user ? PERMISSIONS.canAccessAdminPortal(user.role) : false,
  accessClientPortal: (user) => user ? PERMISSIONS.canAccessClientPortal(user.role) : false,
  modifyAccounts: (user) => user ? PERMISSIONS.canModifyAccounts(user.role) : false,
  modifyDevices: (user) => user ? PERMISSIONS.canModifyDevices(user.role) : false,
  modifyAutomation: (user) => user ? PERMISSIONS.canModifyAutomation(user.role) : false,
  modifyScraping: (user) => user ? PERMISSIONS.canModifyScraping(user.role) : false,
  viewAccounts: (user) => user ? PERMISSIONS.canViewAccounts(user.role) : false,
  viewDevices: (user) => user ? PERMISSIONS.canViewDevices(user.role) : false,
  viewAutomation: (user) => user ? PERMISSIONS.canViewAutomation(user.role) : false,
  viewScraping: (user) => user ? PERMISSIONS.canViewScraping(user.role) : false,
  viewAnalytics: (user) => user ? PERMISSIONS.canViewAnalytics(user.role) : false,
  manageUsers: (user) => user ? PERMISSIONS.canManageUsers(user.role) : false,
  manageSystem: (user) => user ? PERMISSIONS.canManageSystem(user.role) : false,
  exportData: (user) => user ? PERMISSIONS.canExportData(user.role) : false,
  importData: (user) => user ? PERMISSIONS.canImportData(user.role) : false,
  performBulkOperations: (user) => user ? PERMISSIONS.canPerformBulkOperations(user.role) : false,
  useChatbot: (user) => user ? PERMISSIONS.canUseChatbot(user.role) : false,
  // Account Ownership Helper Functions
  viewOwnAccounts: (user) => user ? PERMISSIONS.canViewOwnAccounts(user.role) : false,
  viewMLAccounts: (user) => user ? PERMISSIONS.canViewMLAccounts(user.role) : false,
  viewAllAccounts: (user) => user ? PERMISSIONS.canViewAllAccounts(user.role) : false,
  manageAccountOwnership: (user) => user ? PERMISSIONS.canManageAccountOwnership(user.role) : false,
  assignAccounts: (user) => user ? PERMISSIONS.canAssignAccounts(user.role) : false,
  viewUnassignedAccounts: (user) => user ? PERMISSIONS.canViewUnassignedAccounts(user.role) : false
};
function getClientIP(request) {
  const headers = request.headers;
  return headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0] || headers.get("x-real-ip") || headers.get("x-client-ip") || "unknown";
}
function getUserAgent(request) {
  return request.headers.get("user-agent") || "unknown";
}
function shouldLogRoute(pathname) {
  const skipPatterns = [
    "/favicon.ico",
    "/robots.txt",
    "/_app/",
    "/static/",
    "/assets/",
    "/__health",
    "/__status"
  ];
  return !skipPatterns.some((pattern) => pathname.startsWith(pattern));
}
function getLogLevel(statusCode) {
  if (statusCode >= 500) return LogLevel.ERROR;
  if (statusCode >= 400) return LogLevel.WARN;
  if (statusCode >= 300) return LogLevel.INFO;
  return LogLevel.DEBUG;
}
const requestLoggingHandle = async ({ event, resolve }) => {
  const { request, url } = event;
  if (!shouldLogRoute(url.pathname)) {
    return resolve(event);
  }
  const startTime = Date.now();
  const requestId = logger.generateRequestId();
  const ip = getClientIP(request);
  const userAgent = getUserAgent(request);
  event.locals.requestId = requestId;
  logger.logAPI(LogLevel.DEBUG, "Incoming request", {
    requestId,
    method: request.method,
    url: url.pathname + url.search,
    statusCode: 0,
    duration: 0,
    ip,
    userAgent,
    userId: event.locals.user?.id
  });
  let response;
  let error;
  try {
    response = await resolve(event);
  } catch (err) {
    error = err;
    logger.logAPI(LogLevel.ERROR, "Request failed with error", {
      requestId,
      method: request.method,
      url: url.pathname + url.search,
      statusCode: 500,
      duration: Date.now() - startTime,
      ip,
      userAgent,
      userId: event.locals.user?.id,
      error
    });
    throw err;
  }
  const duration = Date.now() - startTime;
  const statusCode = response.status;
  recordResponseTime(
    url.pathname,
    request.method,
    statusCode,
    duration,
    event.locals.user?.id
  );
  if (statusCode >= 400) {
    incrementErrorCount(
      statusCode >= 500 ? "server_error" : "client_error",
      url.pathname,
      event.locals.user?.id
    );
  }
  const logLevel = getLogLevel(statusCode);
  logger.logAPI(logLevel, "Request completed", {
    requestId,
    method: request.method,
    url: url.pathname + url.search,
    statusCode,
    duration,
    ip,
    userAgent,
    userId: event.locals.user?.id
  });
  if (duration > 5e3) {
    logger.logPerformance(LogLevel.WARN, "Slow request detected", {
      metric: "response_time",
      value: duration,
      unit: "ms",
      threshold: 5e3,
      component: "api",
      userId: event.locals.user?.id
    });
  }
  if (url.pathname.startsWith("/api/auth/")) {
    const isSuccess = statusCode < 400;
    logger.logAuth(
      isSuccess ? LogLevel.INFO : LogLevel.WARN,
      `Authentication ${request.method} ${isSuccess ? "succeeded" : "failed"}`,
      {
        userId: event.locals.user?.id,
        email: event.locals.user?.email,
        ip,
        userAgent,
        action: `${request.method}_${url.pathname.split("/").pop()}`,
        success: isSuccess,
        reason: isSuccess ? void 0 : `HTTP ${statusCode}`
      }
    );
  }
  response.headers.set("X-Request-ID", requestId);
  return response;
};
const SECURITY_HEADERS = {
  // Content Security Policy - very important for XSS protection
  "Content-Security-Policy": (
    // Production CSP (relaxed for HTTP deployment testing)
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "connect-src 'self' ws: wss: https:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  ),
  // Prevent clickjacking attacks
  "X-Frame-Options": "DENY",
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Enable XSS filtering in browsers
  "X-XSS-Protection": "1; mode=block",
  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Prevent exposure of sensitive APIs to unauthorized origins (relaxed for HTTP testing)
  // 'Cross-Origin-Embedder-Policy': 'credentialless',
  // 'Cross-Origin-Opener-Policy': 'same-origin',
  // 'Cross-Origin-Resource-Policy': 'same-origin',
  // Control access to geolocation, camera, microphone, etc.
  "Permissions-Policy": [
    "geolocation=()",
    "microphone=()",
    "camera=()",
    "magnetometer=()",
    "gyroscope=()",
    "speaker=()",
    "vibrate=()",
    "fullscreen=(self)",
    "payment=()"
  ].join(", ")
};
const HTTPS_HEADERS = {
  // HTTP Strict Transport Security
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload"
};
function generateCSPNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
function applySecurityHeaders(response, event, options = {}) {
  const {
    enableCSP = true,
    enableHSTS = !dev,
    customHeaders = {}
  } = options;
  const headers = new Headers(response.headers);
  const nonce = generateCSPNonce();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === "Content-Security-Policy" && !enableCSP) {
      continue;
    }
    let headerValue = value;
    if (name === "Content-Security-Policy") {
      headerValue = value.replace(/\{NONCE\}/g, nonce);
    }
    headers.set(name, headerValue);
  }
  if (enableHSTS && !dev) {
    for (const [name, value] of Object.entries(HTTPS_HEADERS)) {
      headers.set(name, value);
    }
  }
  for (const [name, value] of Object.entries(customHeaders)) {
    headers.set(name, value);
  }
  event.locals.cspNonce = nonce;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
function validateIncomingHeaders(event) {
  const threats = [];
  const warnings = [];
  const headers = event.request.headers;
  const userAgent = headers.get("user-agent") || "";
  const suspiciousUAPatterns = [
    /curl/i,
    /wget/i,
    /python/i,
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i
  ];
  if (!event.url.pathname.startsWith("/api/") && !event.locals.user) {
    for (const pattern of suspiciousUAPatterns) {
      if (pattern.test(userAgent)) {
        warnings.push(`Suspicious User-Agent detected: ${userAgent.substring(0, 50)}`);
        break;
      }
    }
  }
  for (const [name, value] of headers.entries()) {
    if (value.includes("\r\n") || value.includes("\n") || value.includes("\r")) {
      threats.push(`Header injection detected in ${name}`);
    }
    if (value.length > 8192) {
      threats.push(`Excessively long header: ${name}`);
    }
  }
  const referer = headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const currentHost = event.url.hostname;
      if (refererUrl.hostname !== currentHost && (event.url.pathname.includes("/admin") || event.url.pathname.includes("/settings") || event.request.method !== "GET")) {
        warnings.push(`External referer on sensitive endpoint: ${refererUrl.hostname}`);
      }
    } catch {
      warnings.push("Invalid referer URL format");
    }
  }
  if (event.url.pathname.startsWith("/api/") && event.request.method !== "GET") {
    const contentType = headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      warnings.push("API request missing proper Content-Type header");
    }
  }
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    if (ips.length > 10) {
      threats.push("Too many IPs in X-Forwarded-For header");
    }
    for (const ip of ips) {
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip)) {
        warnings.push("Private IP detected in X-Forwarded-For");
      }
    }
  }
  const valid = threats.length === 0;
  if (threats.length > 0 || warnings.length > 0) {
    logger.logSecurity(
      threats.length > 0 ? LogLevel.WARN : LogLevel.INFO,
      `Security header validation: ${threats.length} threats, ${warnings.length} warnings`,
      {
        eventType: "header_security_check",
        severity: threats.length > 0 ? "high" : "low",
        ip: event.getClientAddress(),
        userAgent,
        details: {
          url: event.url.pathname,
          method: event.request.method,
          threats,
          warnings,
          headerCount: Array.from(headers.keys()).length
        }
      }
    );
  }
  return { valid, threats, warnings };
}
function getCORSHeaders(event) {
  const origin = event.request.headers.get("origin");
  const allowedOrigins = [];
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    // 24 hours
    "Vary": "Origin"
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}
function handleCORSPreflight(event) {
  if (event.request.method === "OPTIONS") {
    const corsHeaders = getCORSHeaders(event);
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return null;
}
const securityMiddleware = async ({ event, resolve }) => {
  const corsResponse = handleCORSPreflight(event);
  if (corsResponse) {
    return corsResponse;
  }
  const headerValidation = validateIncomingHeaders(event);
  if (!headerValidation.valid) {
    logger.logSecurity(LogLevel.ERROR, "Request blocked due to security threats", {
      eventType: "request_blocked",
      severity: "critical",
      ip: event.getClientAddress(),
      userAgent: event.request.headers.get("user-agent"),
      details: {
        url: event.url.pathname,
        method: event.request.method,
        threats: headerValidation.threats
      }
    });
    return new Response("Forbidden", {
      status: 403,
      headers: {
        "Content-Type": "text/plain",
        "X-Security-Block": "header-threats"
      }
    });
  }
  const response = await resolve(event);
  return applySecurityHeaders(response, event);
};
const ADMIN_ONLY_ROUTES = ["/admin-portal", "/accounts", "/devices", "/scraping", "/settings"];
const CLIENT_PORTAL_ROUTES = ["/client-portal"];
const UNAUTHORIZED_ROUTES = ["/access-pending"];
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/api/auth", "/api/test-login"];
const PUBLIC_ROUTES = ["/unauthorized"];
const rateLimitHandle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;
  const isBasicPageLoad = pathname === "/" || pathname === "/login" || pathname.startsWith("/client-portal");
  if (!isBasicPageLoad && (pathname.startsWith("/api/") || event.request.method !== "GET")) {
    const rateLimitResponse = await rateLimitMiddleware(event);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }
  return resolve(event);
};
const customAuthHandle = async ({ event, resolve }) => {
  const { cookies, url, request } = event;
  const sessionCookie = cookies.get("session");
  if (sessionCookie) {
    try {
      if (typeof sessionCookie !== "string" || sessionCookie.length > 256) {
        throw new Error("Invalid session cookie format");
      }
      const parts = sessionCookie.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid session cookie structure");
      }
      const [userIdStr, sessionToken] = parts;
      if (!userIdStr || !sessionToken || userIdStr.length > 50 || sessionToken.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(userIdStr) || !/^[a-zA-Z0-9_-]+$/.test(sessionToken)) {
        throw new Error("Invalid session cookie content");
      }
      if (AuthService.isValidSessionToken(sessionToken)) {
        const user = await AuthService.getUserById(userIdStr);
        if (user && user.isActive) {
          event.locals.user = user;
        } else {
          cookies.delete("session", { path: "/", secure: !dev, httpOnly: true, sameSite: "lax" });
        }
      } else {
        throw new Error("Invalid session token");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn("Invalid session cookie detected, clearing:", errorMessage);
      cookies.delete("session", { path: "/", secure: !dev, httpOnly: true, sameSite: "lax" });
    }
  }
  if (!event.locals.user && event.locals.auth) {
    try {
      const authSession = await event.locals.auth();
      if (authSession?.user?.email) {
        const customUser = {
          id: authSession.user.id || `oauth_${authSession.user.email}`,
          email: authSession.user.email,
          name: authSession.user.name || authSession.user.email,
          role: "CLIENT",
          // Default role for OAuth users
          isActive: true,
          company: null,
          avatar: authSession.user.image,
          subscription: "Professional",
          lastLoginAt: /* @__PURE__ */ new Date()
        };
        event.locals.user = customUser;
        console.log(`🔐 Auth.js session found for: ${authSession.user.email}`);
      }
    } catch (error) {
      console.error("Error checking Auth.js session:", error);
    }
  }
  const pathname = url.pathname;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isUnauthorizedRoute = UNAUTHORIZED_ROUTES.some((route) => pathname.startsWith(route));
  const isOAuthRoute = pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/oauth/");
  const isApiRoute = pathname.startsWith("/api/");
  const isAdminRoute = ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route));
  const isClientPortalRoute = CLIENT_PORTAL_ROUTES.some((route) => pathname.startsWith(route));
  if (isOAuthRoute || isPublicRoute || isUnauthorizedRoute) {
    return resolve(event);
  }
  if (!event.locals.user) {
    if (isAuthRoute) {
      return resolve(event);
    }
    const redirectUrl = `/login?redirectTo=${encodeURIComponent(pathname)}`;
    throw redirect(302, redirectUrl);
  }
  if (isAuthRoute && event.locals.user) {
    if (userCan.accessAdminPortal(event.locals.user)) {
      throw redirect(302, "/admin-portal");
    } else if (userCan.accessClientPortal(event.locals.user)) {
      throw redirect(302, "/client-portal");
    } else if (event.locals.user.role === "UNAUTHORIZED") {
      throw redirect(302, "/access-pending");
    }
    throw redirect(302, "/login");
  }
  if (!event.locals.user) {
    return resolve(event);
  }
  const userRole = event.locals.user.role;
  if (userRole === "UNAUTHORIZED" && !isUnauthorizedRoute) {
    throw redirect(302, "/access-pending");
  }
  if (isAdminRoute && !userCan.accessAdminPortal(event.locals.user)) {
    const isProfilePage = pathname.startsWith("/scraping/profile/");
    if (isProfilePage && (userRole === "CLIENT" || userRole === "VIEWER")) ;
    else {
      throw redirect(302, `/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }
  if (isClientPortalRoute && !userCan.accessClientPortal(event.locals.user)) {
    throw redirect(302, `/unauthorized?from=${encodeURIComponent(pathname)}`);
  }
  if (isApiRoute) {
    const method = event.request.method;
    const apiPath = pathname;
    if (userRole === "UNAUTHORIZED") {
      return new Response(
        JSON.stringify({
          error: "Access pending: Your account requires administrator approval",
          code: "ACCESS_PENDING"
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    if (["POST", "PUT", "DELETE"].includes(method)) {
      if (userRole === "VIEWER") {
        return new Response(
          JSON.stringify({
            error: "Forbidden: Viewers cannot perform modification operations",
            code: "INSUFFICIENT_PERMISSIONS"
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      if (apiPath.startsWith("/api/devices") && userRole !== "ADMIN") {
        return new Response(
          JSON.stringify({
            error: "Forbidden: Only administrators can manage devices",
            code: "ADMIN_REQUIRED"
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    if (apiPath.startsWith("/api/devices") && userRole !== "ADMIN") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: Only administrators can access device information",
          code: "ADMIN_REQUIRED"
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
  return resolve(event);
};
const handleError = async ({ error, event, status, message }) => {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = event.locals.user?.id;
  const requestId = event.locals.requestId;
  const ip = event.getClientAddress();
  const userAgent = event.request.headers.get("user-agent");
  logger.logSystem(LogLevel.ERROR, `Server error: ${message}`, {
    component: "server-error-handler",
    event: "server_error",
    details: {
      errorId,
      status,
      message,
      url: event.url.pathname,
      method: event.request.method,
      userId,
      requestId,
      ip,
      userAgent,
      stack: void 0
    },
    error: error instanceof Error ? error : void 0
  });
  if (status >= 500) {
    logger.logSecurity(LogLevel.ERROR, `Critical server error: ${message}`, {
      eventType: "server_error",
      severity: "high",
      userId,
      ip,
      userAgent,
      details: {
        errorId,
        status,
        url: event.url.pathname,
        method: event.request.method
      }
    });
  }
  return {
    id: errorId,
    message: "An internal error occurred",
    ...dev
  };
};
const handle = sequence(requestLoggingHandle, securityMiddleware, rateLimitHandle, authHandle, customAuthHandle);

export { handle, handleError };
//# sourceMappingURL=hooks.server-CB6X72BE.js.map
