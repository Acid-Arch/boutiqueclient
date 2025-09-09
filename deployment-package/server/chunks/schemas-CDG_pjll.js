import { z } from 'zod';

const sanitizeString = (str) => str.trim().replace(/[<>]/g, "");
const LoginSchema = z.object({
  emailOrUsername: z.string().min(1, "Email or username is required").max(255, "Email or username too long").transform(sanitizeString),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password too long"),
  rememberMe: z.boolean().optional().default(false)
});
z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long").transform(sanitizeString),
  name: z.string().min(1, "Name is required").max(100, "Name too long").transform(sanitizeString),
  role: z.enum(["ADMIN", "CLIENT", "VIEWER", "UNAUTHORIZED"]).default("CLIENT")
});
const CreateAccountSchema = z.object({
  instagramUsername: z.string().min(1, "Instagram username is required").max(255, "Username too long").regex(/^[a-zA-Z0-9._]+$/, "Invalid username format").transform(sanitizeString),
  instagramPassword: z.string().min(1, "Instagram password is required").max(255, "Password too long"),
  emailAddress: z.string().email("Invalid email format").max(255, "Email too long").transform(sanitizeString),
  emailPassword: z.string().min(1, "Email password is required").max(255, "Email password too long"),
  accountType: z.enum(["CLIENT", "ML_TREND_FINDER", "SYSTEM"]).default("CLIENT"),
  visibility: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).default("PRIVATE"),
  ownerId: z.number().int().positive().optional(),
  notes: z.string().max(500, "Notes too long").optional().transform((val) => val ? sanitizeString(val) : void 0)
});
CreateAccountSchema.partial().extend({
  id: z.number().int().positive()
});
z.object({
  accountIds: z.array(z.number().int().positive()).min(1, "At least one account ID required").max(100, "Too many accounts selected"),
  operation: z.enum(["assign", "unassign", "delete", "update_status", "change_owner"]),
  data: z.record(z.string(), z.any()).optional()
});
const DeviceAssignmentSchema = z.object({
  accountId: z.number().int().positive(),
  deviceId: z.string().min(1, "Device ID required").max(255, "Device ID too long").transform(sanitizeString),
  cloneNumber: z.number().int().min(0).max(99, "Invalid clone number")
});
z.object({
  assignments: z.array(DeviceAssignmentSchema).min(1, "At least one assignment required").max(50, "Too many assignments")
});
const PaginationSchema = z.object({
  limit: z.string().optional().transform((val) => val ? Math.min(Math.max(parseInt(val) || 20, 1), 100) : 20),
  offset: z.string().optional().transform((val) => {
    const parsed = parseInt(val || "0");
    return isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }),
  page: z.string().optional().transform((val) => {
    const parsed = parseInt(val || "1");
    return isNaN(parsed) ? 1 : Math.max(parsed, 1);
  })
});
const AccountFilterSchema = z.object({
  status: z.string().optional(),
  search: z.string().max(255, "Search query too long").optional().transform((val) => val ? sanitizeString(val) : void 0),
  ownerId: z.string().optional().transform((val) => {
    if (!val) return void 0;
    if (val === "null") return null;
    const parsed = parseInt(val);
    return isNaN(parsed) ? void 0 : parsed;
  }),
  accountTypes: z.string().optional().transform((val) => val ? val.split(",").map((type) => type.trim()) : void 0),
  includeMLAccounts: z.string().optional().transform((val) => val === "true")
});
z.object({
  sessionType: z.enum(["DETAILED_ANALYSIS", "BASIC_SCRAPE", "BULK_UPDATE"]),
  targetAccounts: z.array(z.string().transform(sanitizeString)).min(1, "At least one target account required").max(100, "Too many target accounts"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  batchSize: z.number().int().min(1).max(20).default(5),
  costLimit: z.number().min(0).max(100).default(1),
  scheduledFor: z.date().optional()
});
z.object({
  url: z.string().url("Invalid webhook URL").max(255, "URL too long"),
  events: z.array(z.string()).min(1, "At least one event required"),
  secret: z.string().min(8, "Webhook secret must be at least 8 characters").optional()
});
z.object({
  filename: z.string().min(1, "Filename required").max(255, "Filename too long").regex(/^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$/, "Invalid filename format").transform(sanitizeString),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  // 10MB limit
  type: z.enum(["text/csv", "application/json", "text/plain"])
});
z.object({
  notifications: z.object({
    email: z.boolean().default(true),
    browser: z.boolean().default(true),
    webhook: z.boolean().default(false)
  }).optional(),
  preferences: z.object({
    theme: z.enum(["light", "dark", "auto"]).default("auto"),
    language: z.enum(["en", "es", "fr", "de"]).default("en"),
    timezone: z.string().max(50).default("UTC")
  }).optional(),
  security: z.object({
    twoFactorEnabled: z.boolean().default(false),
    sessionTimeout: z.number().int().min(300).max(86400).default(3600)
    // 5 minutes to 24 hours
  }).optional()
});
z.object({
  ipAddress: z.string().refine((val) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^:(?:[0-9a-fA-F]{1,4}:){1,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}::[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^2001:db8::[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(val) || ipv6Regex.test(val);
  }, "Invalid IP address format").transform(sanitizeString),
  description: z.string().max(255, "Description too long").optional().transform((val) => val ? sanitizeString(val) : void 0),
  userId: z.number().int().positive().optional()
});
z.object({
  format: z.enum(["csv", "json", "xlsx"]).default("csv"),
  includeFields: z.array(z.string()).optional(),
  filters: AccountFilterSchema.optional(),
  maxRecords: z.number().int().min(1).max(1e4).default(1e3)
});

export { AccountFilterSchema as A, LoginSchema as L, PaginationSchema as P };
//# sourceMappingURL=schemas-CDG_pjll.js.map
