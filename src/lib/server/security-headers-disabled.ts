import type { Handle } from '@sveltejs/kit';

/**
 * DISABLED security headers for HTTP deployment testing
 * This completely removes all security headers to resolve CSP/SSL issues
 */
export const securityHeaders: Handle = async ({ event, resolve }) => {
  return resolve(event);
};

export const securityMiddleware = securityHeaders;

export function getSecurityHeaders(): Record<string, string> {
  return {};
}

export function isSecuritySensitiveRoute(pathname: string): boolean {
  return false;
}

export default securityHeaders;