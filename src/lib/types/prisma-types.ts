// Manual Prisma types for NixOS compatibility
export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  VIEWER = 'VIEWER',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export enum AccountType {
  CLIENT = 'CLIENT',
  ML_TREND_FINDER = 'ML_TREND_FINDER',
  SYSTEM = 'SYSTEM'
}

export enum AccountVisibility {
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  PUBLIC = 'PUBLIC'
}

export interface User {
  id: number;
  email: string;
  username: string;
  passwordHash?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  avatar?: string | null;
  role: UserRole;
  subscription: string;
  accountsLimit: number;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}