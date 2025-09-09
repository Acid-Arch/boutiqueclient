/**
 * Client Account Filtering Service
 * Filters Instagram accounts for daily scraping based on client ownership and account type
 */

import { prisma } from '$lib/server/database.js';
import type { IgAccount } from '@prisma/client';

export interface ClientScrapingAccount {
  id: number;
  username: string;
  email: string | null;
  ownerId: number | null;
  accountType: string;
  visibility: string;
  isShared: boolean;
  currentStatus: string;
  lastLogin: Date | null;
  creationDate: Date | null;
}

export interface ClientAccountStats {
  totalClientAccounts: number;
  ownedClientAccounts: number;
  unownedClientAccounts: number;
  activeAccounts: number;
  eligibleForScraping: number;
}

/**
 * Get all CLIENT accounts that are eligible for daily scraping
 * This includes both owned and unowned CLIENT accounts (op.pl emails are unassigned company accounts)
 */
export async function getClientAccountsForScraping(): Promise<ClientScrapingAccount[]> {
  try {
    const accounts = await prisma.igAccount.findMany({
      where: {
        accountType: 'CLIENT', // Only CLIENT accounts (not ML_TREND_FINDER)
        // Include both owned and unowned accounts
        // Unowned accounts are company accounts with op.pl emails ready for client assignment
      },
      select: {
        id: true,
        instagramUsername: true, // Note: using actual column name
        emailAddress: true,      // Note: using actual column name
        ownerId: true,
        accountType: true,
        visibility: true,
        isShared: true,
        status: true,            // Note: using actual column name
        loginTimestamp: true,    // Note: using actual column name
        createdAt: true
      },
      orderBy: [
        { ownerId: 'asc' }, // Owned accounts first
        { instagramUsername: 'asc' }
      ]
    });

    return accounts.map((account: any) => ({
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: account.ownerId ? parseInt(account.ownerId) : null,
      accountType: account.accountType || 'CLIENT',
      visibility: account.visibility || 'PRIVATE',
      isShared: account.isShared || false,
      currentStatus: account.status || 'Unknown',
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    }));
  } catch (error) {
    console.error('Error fetching client accounts for scraping:', error);
    throw new Error(`Failed to fetch client accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get CLIENT accounts owned by a specific client
 */
export async function getClientOwnedAccounts(ownerId: string): Promise<ClientScrapingAccount[]> {
  try {
    const accounts = await prisma.igAccount.findMany({
      where: {
        accountType: 'CLIENT',
        ownerId: ownerId
      },
      select: {
        id: true,
        instagramUsername: true,
        emailAddress: true,
        ownerId: true,
        accountType: true,
        visibility: true,
        isShared: true,
        status: true,
        loginTimestamp: true,
        createdAt: true
      },
      orderBy: { instagramUsername: 'asc' }
    });

    return accounts.map((account: any) => ({
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: account.ownerId ? parseInt(account.ownerId) : null,
      accountType: account.accountType || 'CLIENT',
      visibility: account.visibility || 'PRIVATE',
      isShared: account.isShared || false,
      currentStatus: account.status || 'Unknown',
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    }));
  } catch (error) {
    console.error(`Error fetching accounts for owner ${ownerId}:`, error);
    throw new Error(`Failed to fetch accounts for owner: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get unassigned CLIENT accounts (company accounts with op.pl emails ready for assignment)
 */
export async function getUnassignedClientAccounts(): Promise<ClientScrapingAccount[]> {
  try {
    const accounts = await prisma.igAccount.findMany({
      where: {
        accountType: 'CLIENT',
        ownerId: null,
        emailAddress: {
          contains: '@op.pl' // These are company accounts ready for client assignment
        }
      },
      select: {
        id: true,
        instagramUsername: true,
        emailAddress: true,
        ownerId: true,
        accountType: true,
        visibility: true,
        isShared: true,
        status: true,
        loginTimestamp: true,
        createdAt: true
      },
      orderBy: { instagramUsername: 'asc' }
    });

    return accounts.map((account: any) => ({
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: null,
      accountType: account.accountType || 'CLIENT',
      visibility: account.visibility || 'PRIVATE',
      isShared: account.isShared || false,
      currentStatus: account.status || 'Unknown',
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    }));
  } catch (error) {
    console.error('Error fetching unassigned client accounts:', error);
    throw new Error(`Failed to fetch unassigned client accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get statistics about client accounts for dashboard reporting
 */
export async function getClientAccountStats(): Promise<ClientAccountStats> {
  try {
    const [totalStats, ownedStats, activeStats] = await Promise.all([
      // Total CLIENT accounts
      prisma.igAccount.count({
        where: { accountType: 'CLIENT' }
      }),
      
      // Owned CLIENT accounts
      prisma.igAccount.count({
        where: { 
          accountType: 'CLIENT',
          ownerId: { not: null }
        }
      }),
      
      // Active accounts (recently logged in or in ready states)
      prisma.igAccount.count({
        where: { 
          accountType: 'CLIENT',
          status: { in: ['Active', 'Online', 'Ready', 'Unused'] }
        }
      })
    ]);

    const unownedClientAccounts = totalStats - ownedStats;
    
    // All CLIENT accounts are eligible for scraping (owned + unowned company accounts)
    const eligibleForScraping = totalStats;

    return {
      totalClientAccounts: totalStats,
      ownedClientAccounts: ownedStats,
      unownedClientAccounts,
      activeAccounts: activeStats,
      eligibleForScraping
    };
  } catch (error) {
    console.error('Error fetching client account stats:', error);
    throw new Error(`Failed to fetch client account stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Filter accounts by scraping eligibility criteria
 * - Must be CLIENT type
 * - Should have valid username
 * - Should not be in suspended/banned state
 */
export function filterAccountsForScraping(accounts: ClientScrapingAccount[]): ClientScrapingAccount[] {
  return accounts.filter(account => {
    // Must have username
    if (!account.username || account.username.trim() === '') {
      return false;
    }

    // Skip accounts in problematic states
    const problematicStates = ['Suspended', 'Banned', 'Deleted', 'Error', 'Failed'];
    if (account.currentStatus && problematicStates.includes(account.currentStatus)) {
      return false;
    }

    // Must be CLIENT type (should already be filtered by query, but double-check)
    if (account.accountType !== 'CLIENT') {
      return false;
    }

    return true;
  });
}

/**
 * Group accounts by ownership for organized scraping
 */
export interface GroupedClientAccounts {
  ownedAccounts: {
    [ownerId: string]: ClientScrapingAccount[];
  };
  unownedAccounts: ClientScrapingAccount[];
}

export function groupAccountsByOwnership(accounts: ClientScrapingAccount[]): GroupedClientAccounts {
  const result: GroupedClientAccounts = {
    ownedAccounts: {},
    unownedAccounts: []
  };

  accounts.forEach(account => {
    if (account.ownerId) {
      const ownerIdStr = account.ownerId.toString();
      if (!result.ownedAccounts[ownerIdStr]) {
        result.ownedAccounts[ownerIdStr] = [];
      }
      result.ownedAccounts[ownerIdStr].push(account);
    } else {
      result.unownedAccounts.push(account);
    }
  });

  return result;
}

/**
 * Get sample accounts for testing (limit to small number for cost control)
 * Prioritize owned accounts first, then unassigned company accounts
 */
export async function getClientAccountSample(limit: number = 5): Promise<ClientScrapingAccount[]> {
  try {
    // Get a mix of owned and unowned accounts for testing
    const [ownedAccounts, unownedAccounts] = await Promise.all([
      prisma.igAccount.findMany({
        where: {
          accountType: 'CLIENT',
          ownerId: { not: null },
          status: { notIn: ['Suspended', 'Banned', 'Deleted', 'Error', 'Failed'] }
        },
        select: {
          id: true,
          instagramUsername: true,
          emailAddress: true,
          ownerId: true,
          accountType: true,
          visibility: true,
          isShared: true,
          status: true,
          loginTimestamp: true,
          createdAt: true
        },
        orderBy: { loginTimestamp: 'desc' },
        take: Math.ceil(limit / 2) // Half the sample from owned accounts
      }),
      
      prisma.igAccount.findMany({
        where: {
          accountType: 'CLIENT',
          ownerId: null,
          emailAddress: { contains: '@op.pl' },
          status: { notIn: ['Suspended', 'Banned', 'Deleted', 'Error', 'Failed'] }
        },
        select: {
          id: true,
          instagramUsername: true,
          emailAddress: true,
          ownerId: true,
          accountType: true,
          visibility: true,
          isShared: true,
          status: true,
          loginTimestamp: true,
          createdAt: true
        },
        orderBy: { instagramUsername: 'asc' },
        take: Math.floor(limit / 2) // Half from unassigned company accounts
      })
    ]);

    const allAccounts = [...ownedAccounts, ...unownedAccounts].slice(0, limit);
    
    return allAccounts.map(account => ({
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: account.ownerId ? parseInt(account.ownerId) : null,
      accountType: account.accountType || 'CLIENT',
      visibility: account.visibility || 'PRIVATE',
      isShared: account.isShared || false,
      currentStatus: account.status || 'Unknown',
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    }));
  } catch (error) {
    console.error('Error fetching client account sample:', error);
    throw new Error(`Failed to fetch account sample: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the ML trend finder account (therock) for specialized ML scraping
 */
export async function getMLTrendFinderAccount(): Promise<ClientScrapingAccount | null> {
  try {
    const account = await prisma.igAccount.findFirst({
      where: {
        accountType: 'ML_TREND_FINDER'
      },
      select: {
        id: true,
        instagramUsername: true,
        emailAddress: true,
        ownerId: true,
        accountType: true,
        visibility: true,
        isShared: true,
        status: true,
        loginTimestamp: true,
        createdAt: true
      }
    });

    if (!account) {
      return null;
    }

    return {
      id: account.id,
      username: account.instagramUsername,
      email: account.emailAddress,
      ownerId: account.ownerId ? parseInt(account.ownerId) : null,
      accountType: account.accountType || 'ML_TREND_FINDER',
      visibility: account.visibility || 'PRIVATE',
      isShared: account.isShared || false,
      currentStatus: account.status || 'Unknown',
      lastLogin: account.loginTimestamp,
      creationDate: account.createdAt
    };
  } catch (error) {
    console.error('Error fetching ML trend finder account:', error);
    throw new Error(`Failed to fetch ML trend finder account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}