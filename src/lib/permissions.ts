import type { UserRole, AccountType, AccountVisibility } from '@prisma/client';
import type { SessionUser } from '$lib/server/auth-direct.js';

// Helper function to safely convert user ID to number
function getUserIdAsNumber(user: SessionUser): number {
  const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
  if (isNaN(userId) || userId <= 0) {
    throw new Error(`Invalid user ID: ${user.id}`);
  }
  return userId;
}
export const PERMISSIONS = {
  // Route Access Permissions
  canAccessAdminPortal: (role: UserRole) => role === 'ADMIN',
  canAccessClientPortal: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  
  // Data Modification Permissions
  canModifyAccounts: (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  canModifyDevices: (role: UserRole) => role === 'ADMIN',
  canModifyAutomation: (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  canModifyScraping: (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  
  // View Permissions
  canViewAccounts: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  canViewDevices: (role: UserRole) => role === 'ADMIN',
  canViewAutomation: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  canViewScraping: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  canViewAnalytics: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  
  // Administrative Permissions
  canManageUsers: (role: UserRole) => role === 'ADMIN',
  canManageSystem: (role: UserRole) => role === 'ADMIN',
  canExportData: (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  canImportData: (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  
  // Bulk Operations
  canPerformBulkOperations: (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  
  // Chat/AI Features
  canUseChatbot: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  
  // Account Ownership Permissions
  canViewOwnAccounts: (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  canViewMLAccounts: (role: UserRole) => role === 'ADMIN',
  canViewAllAccounts: (role: UserRole) => role === 'ADMIN',
  canManageAccountOwnership: (role: UserRole) => role === 'ADMIN',
  canAssignAccounts: (role: UserRole) => role === 'ADMIN',
  canViewUnassignedAccounts: (role: UserRole) => role === 'ADMIN'
};

// Helper functions for easier use in components and API routes
export const userCan = {
  accessAdminPortal: (user: SessionUser | null) => 
    user ? PERMISSIONS.canAccessAdminPortal(user.role as UserRole) : false,
    
  accessClientPortal: (user: SessionUser | null) => 
    user ? PERMISSIONS.canAccessClientPortal(user.role as UserRole) : false,
    
  modifyAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canModifyAccounts(user.role as UserRole) : false,
    
  modifyDevices: (user: SessionUser | null) => 
    user ? PERMISSIONS.canModifyDevices(user.role as UserRole) : false,
    
  modifyAutomation: (user: SessionUser | null) => 
    user ? PERMISSIONS.canModifyAutomation(user.role as UserRole) : false,
    
  modifyScraping: (user: SessionUser | null) => 
    user ? PERMISSIONS.canModifyScraping(user.role as UserRole) : false,
    
  viewAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewAccounts(user.role as UserRole) : false,
    
  viewDevices: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewDevices(user.role as UserRole) : false,
    
  viewAutomation: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewAutomation(user.role as UserRole) : false,
    
  viewScraping: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewScraping(user.role as UserRole) : false,
    
  viewAnalytics: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewAnalytics(user.role as UserRole) : false,
    
  manageUsers: (user: SessionUser | null) => 
    user ? PERMISSIONS.canManageUsers(user.role as UserRole) : false,
    
  manageSystem: (user: SessionUser | null) => 
    user ? PERMISSIONS.canManageSystem(user.role as UserRole) : false,
    
  exportData: (user: SessionUser | null) => 
    user ? PERMISSIONS.canExportData(user.role as UserRole) : false,
    
  importData: (user: SessionUser | null) => 
    user ? PERMISSIONS.canImportData(user.role as UserRole) : false,
    
  performBulkOperations: (user: SessionUser | null) => 
    user ? PERMISSIONS.canPerformBulkOperations(user.role as UserRole) : false,
    
  useChatbot: (user: SessionUser | null) => 
    user ? PERMISSIONS.canUseChatbot(user.role as UserRole) : false,
    
  // Account Ownership Helper Functions
  viewOwnAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewOwnAccounts(user.role as UserRole) : false,
    
  viewMLAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewMLAccounts(user.role as UserRole) : false,
    
  viewAllAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewAllAccounts(user.role as UserRole) : false,
    
  manageAccountOwnership: (user: SessionUser | null) => 
    user ? PERMISSIONS.canManageAccountOwnership(user.role as UserRole) : false,
    
  assignAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canAssignAccounts(user.role as UserRole) : false,
    
  viewUnassignedAccounts: (user: SessionUser | null) => 
    user ? PERMISSIONS.canViewUnassignedAccounts(user.role as UserRole) : false
};

// Route-specific permissions
export const routePermissions = {
  // Admin Portal routes (only ADMIN)
  '/admin-portal': (role: UserRole) => role === 'ADMIN',
  '/accounts': (role: UserRole) => role === 'ADMIN',
  '/devices': (role: UserRole) => role === 'ADMIN',
  '/automation': (role: UserRole) => role === 'ADMIN',
  '/scraping': (role: UserRole) => role === 'ADMIN',
  '/settings': (role: UserRole) => role === 'ADMIN',
  
  // Client Portal routes (ADMIN, CLIENT, VIEWER - NOT UNAUTHORIZED)
  '/client-portal': (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  
  // Unauthorized user route
  '/access-pending': (role: UserRole) => role === 'UNAUTHORIZED'
};

// API endpoint permissions
export const apiPermissions = {
  // GET requests - generally allowed for all authenticated users with portal access
  'GET:/api/accounts': (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  'GET:/api/devices': (role: UserRole) => role === 'ADMIN',
  'GET:/api/automation': (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  'GET:/api/scraping': (role: UserRole) => ['ADMIN', 'CLIENT', 'VIEWER'].includes(role),
  
  // POST/PUT/DELETE requests - modification permissions
  'POST:/api/accounts': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'PUT:/api/accounts': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'DELETE:/api/accounts': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  
  'POST:/api/devices': (role: UserRole) => role === 'ADMIN',
  'PUT:/api/devices': (role: UserRole) => role === 'ADMIN',
  'DELETE:/api/devices': (role: UserRole) => role === 'ADMIN',
  
  'POST:/api/automation': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'PUT:/api/automation': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'DELETE:/api/automation': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  
  'POST:/api/scraping': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'PUT:/api/scraping': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'DELETE:/api/scraping': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  
  // Export/Import permissions
  'POST:/api/export': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role),
  'POST:/api/import': (role: UserRole) => ['ADMIN', 'CLIENT'].includes(role)
};

// Helper function to check API permissions
export function checkApiPermission(method: string, endpoint: string, role: UserRole): boolean {
  const key = `${method}:${endpoint}` as keyof typeof apiPermissions;
  const permissionCheck = apiPermissions[key];
  return permissionCheck ? permissionCheck(role) : false;
}

// Helper function to check route permissions
export function checkRoutePermission(route: string, role: UserRole): boolean {
  // Check exact route match first
  if (routePermissions[route as keyof typeof routePermissions]) {
    return routePermissions[route as keyof typeof routePermissions](role);
  }
  
  // Check route prefixes for nested routes
  for (const [routePattern, permissionCheck] of Object.entries(routePermissions)) {
    if (route.startsWith(routePattern)) {
      return permissionCheck(role);
    }
  }
  
  // Default: allow access if no specific restriction found
  return true;
}

// Account ownership checking functions
export interface AccountWithOwnership {
  id: number;
  ownerId: number | null;
  accountType: AccountType;
  visibility: AccountVisibility;
  isShared: boolean;
}

export function canUserViewAccount(user: SessionUser | null, account: AccountWithOwnership): boolean {
  if (!user) return false;
  
  const role = user.role as UserRole;
  
  // Admins can view all accounts
  if (role === 'ADMIN') return true;
  
  // ML accounts are admin-only
  if (account.accountType === 'ML_TREND_FINDER') return false;
  
  // System accounts are admin-only
  if (account.accountType === 'SYSTEM') return false;
  
  // Check ownership for client accounts
  if (account.accountType === 'CLIENT') {
    // User owns the account
    const userId = getUserIdAsNumber(user);
    if (account.ownerId === userId) return true;
    
    // Account is shared and user has appropriate role
    if (account.isShared && account.visibility === 'SHARED' && ['CLIENT', 'VIEWER'].includes(role)) {
      return true;
    }
    
    // Account is public
    if (account.visibility === 'PUBLIC' && ['CLIENT', 'VIEWER'].includes(role)) {
      return true;
    }
  }
  
  return false;
}

export function canUserModifyAccount(user: SessionUser | null, account: AccountWithOwnership): boolean {
  if (!user) return false;
  
  const role = user.role as UserRole;
  
  // Admins can modify all accounts
  if (role === 'ADMIN') return true;
  
  // Only clients can modify (viewers cannot)
  if (role !== 'CLIENT') return false;
  
  // ML and system accounts are admin-only
  if (account.accountType === 'ML_TREND_FINDER' || account.accountType === 'SYSTEM') {
    return false;
  }
  
  // Client accounts: must own the account
  const userId = getUserIdAsNumber(user);
  if (account.accountType === 'CLIENT' && account.ownerId === userId) {
    return true;
  }
  
  return false;
}

export function getAccountsFilter(user: SessionUser | null): {
  includeAll: boolean;
  includeMLAccounts: boolean;
  ownerIdFilter?: number;
  accountTypeFilter?: AccountType[];
} {
  if (!user) {
    return { includeAll: false, includeMLAccounts: false };
  }
  
  const role = user.role as UserRole;
  
  if (role === 'ADMIN') {
    return { 
      includeAll: true, 
      includeMLAccounts: true 
    };
  }
  
  // Non-admin users: only their own accounts + shared/public accounts
  const userId = getUserIdAsNumber(user);
  return {
    includeAll: false,
    includeMLAccounts: false,
    ownerIdFilter: userId,
    accountTypeFilter: ['CLIENT'] // No ML or SYSTEM accounts
  };
}

// Helper to get user's effective permissions for UI
export function getUserPermissions(user: SessionUser | null) {
  if (!user) {
    return {
      canAccessAdminPortal: false,
      canAccessClientPortal: false,
      canModifyData: false,
      canViewData: false,
      canViewOwnAccounts: false,
      canViewMLAccounts: false,
      canViewAllAccounts: false,
      canManageAccountOwnership: false,
      role: null
    };
  }
  
  const role = user.role as UserRole;
  
  return {
    canAccessAdminPortal: PERMISSIONS.canAccessAdminPortal(role),
    canAccessClientPortal: PERMISSIONS.canAccessClientPortal(role),
    canModifyData: PERMISSIONS.canModifyAccounts(role) || PERMISSIONS.canModifyAutomation(role),
    canViewData: PERMISSIONS.canViewAccounts(role),
    canViewOwnAccounts: PERMISSIONS.canViewOwnAccounts(role),
    canViewMLAccounts: PERMISSIONS.canViewMLAccounts(role),
    canViewAllAccounts: PERMISSIONS.canViewAllAccounts(role),
    canManageAccountOwnership: PERMISSIONS.canManageAccountOwnership(role),
    role: role
  };
}