/**
 * IP Utilities for Public IP Whitelist System
 * Handles IP parsing, validation, and CIDR operations
 */

import { Address4, Address6 } from 'ip-address';

export interface ExtractedIP {
  ip: string;
  source: 'x-forwarded-for' | 'x-real-ip' | 'cf-connecting-ip' | 'remote-addr' | 'unknown';
  isPublic: boolean;
  version: 'ipv4' | 'ipv6';
}

/**
 * Extract the client's public IP from various headers
 * Priority: X-Forwarded-For (first IP) > X-Real-IP > CF-Connecting-IP > remote address
 */
export function extractPublicIP(request: Request): ExtractedIP | null {
  const headers = request.headers;
  
  // Check X-Forwarded-For header (proxy chain - take first IP)
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    const firstIP = ips[0];
    if (firstIP && isValidIP(firstIP)) {
      const parsed = parseIP(firstIP);
      if (parsed && parsed.isPublic) {
        return {
          ip: firstIP,
          source: 'x-forwarded-for',
          isPublic: true,
          version: parsed.version
        };
      }
    }
  }
  
  // Check X-Real-IP header
  const xRealIP = headers.get('x-real-ip');
  if (xRealIP && isValidIP(xRealIP)) {
    const parsed = parseIP(xRealIP);
    if (parsed && parsed.isPublic) {
      return {
        ip: xRealIP,
        source: 'x-real-ip',
        isPublic: true,
        version: parsed.version
      };
    }
  }
  
  // Check Cloudflare-specific header
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP && isValidIP(cfConnectingIP)) {
    const parsed = parseIP(cfConnectingIP);
    if (parsed && parsed.isPublic) {
      return {
        ip: cfConnectingIP,
        source: 'cf-connecting-ip',
        isPublic: true,
        version: parsed.version
      };
    }
  }
  
  // As last resort, try to get from connection info (usually not public)
  // This is more for debugging - in production this will typically be a proxy IP
  
  return null;
}

/**
 * Parse and validate an IP address
 */
export function parseIP(ip: string): { version: 'ipv4' | 'ipv6'; isPublic: boolean } | null {
  try {
    // Try IPv4 first
    if (Address4.isValid(ip)) {
      const ipv4 = new Address4(ip);
      return {
        version: 'ipv4',
        isPublic: !isPrivateIPv4(ipv4)
      };
    }
  } catch (e) {
    // Not IPv4, try IPv6
  }
  
  try {
    // Try IPv6
    if (Address6.isValid(ip)) {
      const ipv6 = new Address6(ip);
      return {
        version: 'ipv6',
        isPublic: !isPrivateIPv6(ipv6)
      };
    }
  } catch (e) {
    // Not a valid IP
  }
  
  return null;
}

/**
 * Check if an IP string is valid
 */
export function isValidIP(ip: string): boolean {
  return parseIP(ip) !== null;
}

/**
 * Check if IPv4 address is private/internal
 */
function isPrivateIPv4(addr: Address4): boolean {
  const octets = addr.toArray();
  
  // 10.0.0.0/8 (10.0.0.0 to 10.255.255.255)
  if (octets[0] === 10) return true;
  
  // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  
  // 192.168.0.0/16 (192.168.0.0 to 192.168.255.255)
  if (octets[0] === 192 && octets[1] === 168) return true;
  
  // 127.0.0.0/8 (localhost)
  if (octets[0] === 127) return true;
  
  // 169.254.0.0/16 (link-local)
  if (octets[0] === 169 && octets[1] === 254) return true;
  
  return false;
}

/**
 * Check if IPv6 address is private/internal
 */
function isPrivateIPv6(addr: Address6): boolean {
  const address = addr.address.toLowerCase();
  
  // ::1 (localhost)
  if (address === '::1') return true;
  
  // fc00::/7 (unique local addresses)
  if (address.startsWith('fc') || address.startsWith('fd')) return true;
  
  // fe80::/10 (link-local)
  if (address.startsWith('fe8') || address.startsWith('fe9') || 
      address.startsWith('fea') || address.startsWith('feb')) return true;
  
  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  if (address.startsWith('::ffff:')) {
    const ipv4Part = address.substring(7);
    try {
      if (Address4.isValid(ipv4Part)) {
        const ipv4 = new Address4(ipv4Part);
        return isPrivateIPv4(ipv4);
      }
    } catch (e) {
      // Invalid IPv4 part
    }
  }
  
  return false;
}

/**
 * Convert single IP to CIDR notation
 * e.g., "203.0.113.42" -> "203.0.113.42/32"
 */
export function ipToCIDR(ip: string): string | null {
  const parsed = parseIP(ip);
  if (!parsed) return null;
  
  if (parsed.version === 'ipv4') {
    return `${ip}/32`;
  } else {
    return `${ip}/128`;
  }
}

/**
 * Check if an IP is within a CIDR range using Node.js built-in functions
 * This replaces the need for PostgreSQL GIST index queries in application logic
 */
export function ipInCIDR(ip: string, cidr: string): boolean {
  try {
    const parsed = parseIP(ip);
    if (!parsed) return false;
    
    if (parsed.version === 'ipv4') {
      const ipv4 = new Address4(ip);
      const cidrAddr = new Address4(cidr);
      return ipv4.isInSubnet(cidrAddr);
    } else {
      const ipv6 = new Address6(ip);
      const cidrAddr = new Address6(cidr);
      return ipv6.isInSubnet(cidrAddr);
    }
  } catch (e) {
    return false;
  }
}

/**
 * Validate CIDR notation
 */
export function isValidCIDR(cidr: string): boolean {
  try {
    // Try IPv4 CIDR
    if (Address4.isValid(cidr)) return true;
  } catch (e) {
    // Not IPv4 CIDR
  }
  
  try {
    // Try IPv6 CIDR
    if (Address6.isValid(cidr)) return true;
  } catch (e) {
    // Not IPv6 CIDR
  }
  
  return false;
}

/**
 * Normalize CIDR to ensure consistent storage format
 */
export function normalizeCIDR(cidr: string): string | null {
  try {
    // Try IPv4 first
    if (Address4.isValid(cidr)) {
      const ipv4 = new Address4(cidr);
      return ipv4.address;
    }
  } catch (e) {
    // Not IPv4
  }
  
  try {
    // Try IPv6
    if (Address6.isValid(cidr)) {
      const ipv6 = new Address6(cidr);
      return ipv6.address;
    }
  } catch (e) {
    // Not IPv6
  }
  
  return null;
}

/**
 * Convert IP range (start-end) to CIDR if possible
 * This is a simplified version - complex ranges may need multiple CIDR blocks
 */
export function rangeToCIDR(startIP: string, endIP: string): string[] {
  // This is a complex operation that would require a full CIDR library
  // For now, we'll store ranges as individual IPs converted to /32 or /128
  const cidrs: string[] = [];
  
  const startCIDR = ipToCIDR(startIP);
  const endCIDR = ipToCIDR(endIP);
  
  if (startCIDR) cidrs.push(startCIDR);
  if (endCIDR && endCIDR !== startCIDR) cidrs.push(endCIDR);
  
  return cidrs;
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}

/**
 * Environment configuration for IP whitelist system
 */
export interface IPWhitelistConfig {
  enabled: boolean;
  mode: 'strict' | 'permissive';
  adminBypass: boolean;
  devBypass: boolean;
  logAll: boolean;
  cacheTTL: number;
}

export function getIPWhitelistConfig(): IPWhitelistConfig {
  return {
    enabled: false, // DISABLED: IP whitelist validation disabled per user request
    mode: (process.env.IP_WHITELIST_MODE as 'strict' | 'permissive') || 'strict',
    adminBypass: process.env.IP_WHITELIST_BYPASS_ADMIN === 'true',
    devBypass: process.env.IP_WHITELIST_DEV_BYPASS === 'true' && process.env.NODE_ENV === 'development',
    logAll: process.env.IP_WHITELIST_LOG_ALL === 'true',
    cacheTTL: parseInt(process.env.IP_WHITELIST_CACHE_TTL || '300') // 5 minutes default
  };
}
