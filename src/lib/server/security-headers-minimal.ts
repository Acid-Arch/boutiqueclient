import type { Handle } from '@sveltejs/kit';

/**
 * Minimal security headers for HTTP deployment - CSP disabled
 */
export const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  
  // Only apply the most basic security headers to avoid CSP/SSL issues
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN'); // Changed from DENY to SAMEORIGIN
  
  return response;
};

export default securityHeaders;