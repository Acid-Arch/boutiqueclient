import { Address4, Address6 } from 'ip-address';

function extractPublicIP(request) {
  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    const firstIP = ips[0];
    if (firstIP && isValidIP(firstIP)) {
      const parsed = parseIP(firstIP);
      if (parsed && parsed.isPublic) {
        return {
          ip: firstIP,
          source: "x-forwarded-for",
          isPublic: true,
          version: parsed.version
        };
      }
    }
  }
  const xRealIP = headers.get("x-real-ip");
  if (xRealIP && isValidIP(xRealIP)) {
    const parsed = parseIP(xRealIP);
    if (parsed && parsed.isPublic) {
      return {
        ip: xRealIP,
        source: "x-real-ip",
        isPublic: true,
        version: parsed.version
      };
    }
  }
  const cfConnectingIP = headers.get("cf-connecting-ip");
  if (cfConnectingIP && isValidIP(cfConnectingIP)) {
    const parsed = parseIP(cfConnectingIP);
    if (parsed && parsed.isPublic) {
      return {
        ip: cfConnectingIP,
        source: "cf-connecting-ip",
        isPublic: true,
        version: parsed.version
      };
    }
  }
  return null;
}
function parseIP(ip) {
  try {
    if (Address4.isValid(ip)) {
      const ipv4 = new Address4(ip);
      return {
        version: "ipv4",
        isPublic: !isPrivateIPv4(ipv4)
      };
    }
  } catch (e) {
  }
  try {
    if (Address6.isValid(ip)) {
      const ipv6 = new Address6(ip);
      return {
        version: "ipv6",
        isPublic: !isPrivateIPv6(ipv6)
      };
    }
  } catch (e) {
  }
  return null;
}
function isValidIP(ip) {
  return parseIP(ip) !== null;
}
function isPrivateIPv4(addr) {
  const octets = addr.toArray();
  if (octets[0] === 10) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  return false;
}
function isPrivateIPv6(addr) {
  const address = addr.address.toLowerCase();
  if (address === "::1") return true;
  if (address.startsWith("fc") || address.startsWith("fd")) return true;
  if (address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb")) return true;
  if (address.startsWith("::ffff:")) {
    const ipv4Part = address.substring(7);
    try {
      if (Address4.isValid(ipv4Part)) {
        const ipv4 = new Address4(ipv4Part);
        return isPrivateIPv4(ipv4);
      }
    } catch (e) {
    }
  }
  return false;
}
function ipToCIDR(ip) {
  const parsed = parseIP(ip);
  if (!parsed) return null;
  if (parsed.version === "ipv4") {
    return `${ip}/32`;
  } else {
    return `${ip}/128`;
  }
}
function ipInCIDR(ip, cidr) {
  try {
    const parsed = parseIP(ip);
    if (!parsed) return false;
    if (parsed.version === "ipv4") {
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
function isValidCIDR(cidr) {
  try {
    if (Address4.isValid(cidr)) return true;
  } catch (e) {
  }
  try {
    if (Address6.isValid(cidr)) return true;
  } catch (e) {
  }
  return false;
}
function normalizeCIDR(cidr) {
  try {
    if (Address4.isValid(cidr)) {
      const ipv4 = new Address4(cidr);
      return ipv4.address;
    }
  } catch (e) {
  }
  try {
    if (Address6.isValid(cidr)) {
      const ipv6 = new Address6(cidr);
      return ipv6.address;
    }
  } catch (e) {
  }
  return null;
}
function getUserAgent(request) {
  return request.headers.get("user-agent");
}
function getIPWhitelistConfig() {
  return {
    enabled: process.env.IP_WHITELIST_ENABLED === "true",
    mode: process.env.IP_WHITELIST_MODE || "strict",
    adminBypass: process.env.IP_WHITELIST_BYPASS_ADMIN === "true",
    devBypass: process.env.IP_WHITELIST_DEV_BYPASS === "true" && process.env.NODE_ENV === "development",
    logAll: process.env.IP_WHITELIST_LOG_ALL === "true",
    cacheTTL: parseInt(process.env.IP_WHITELIST_CACHE_TTL || "300")
    // 5 minutes default
  };
}

export { ipToCIDR as a, getUserAgent as b, ipInCIDR as c, extractPublicIP as e, getIPWhitelistConfig as g, isValidCIDR as i, normalizeCIDR as n };
//# sourceMappingURL=ip-utils-B5dp7ZZG.js.map
