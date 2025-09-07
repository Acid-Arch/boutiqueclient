/**
 * Model Access Management
 * 
 * This module handles the relationship between users and Instagram account models.
 * - Gmail users get access to accounts assigned to the "Dillion" model
 * - Hotmail/Live/Outlook users get access to accounts assigned to the "katie" model
 */

export interface UserModelAccess {
  userId: string;
  email: string;
  assignedModels: string[];
}

/**
 * Determines which models a user has access to based on their email and role
 */
export function getUserModelAccess(user: { id: string; email: string; role: string }): string[] {
  const assignedModels: string[] = [];
  
  // Gmail users get access to Dillion model accounts
  if (user.email && user.email.includes('@gmail.com')) {
    assignedModels.push('Dillion');
  }
  
  // Hotmail/Live/Outlook users get access to katie model accounts
  if (user.email && (
    user.email.includes('@hotmail.') || 
    user.email.includes('@live.') || 
    user.email.includes('@outlook.')
  )) {
    assignedModels.push('katie');
  }
  
  // Admin users get access to all models
  if (user.role === 'ADMIN') {
    assignedModels.push('Dillion', 'katie', 'Premium', 'Basic'); // Add other models as needed
  }
  
  return assignedModels;
}

/**
 * Checks if a user has access to a specific model
 */
export function userCanAccessModel(user: { id: string; email: string; role: string }, model: string): boolean {
  const userModels = getUserModelAccess(user);
  return userModels.includes(model);
}

/**
 * Gets the database query filter for Instagram accounts based on user's model access
 */
export function getAccountsFilterForUser(user: { id: string; email: string; role: string }) {
  const userModels = getUserModelAccess(user);
  const userId = parseInt(user.id) || null;
  
  // Return filter that includes:
  // 1. Accounts directly owned by the user (ownerId matches)
  // 2. Accounts assigned to models the user has access to
  
  return {
    OR: [
      // Direct ownership
      { ownerId: userId },
      // Model-based access
      ...(userModels.length > 0 ? [{ model: { in: userModels } }] : [])
    ]
  };
}

/**
 * Debug function to log user's model access
 */
export function logUserModelAccess(user: { id: string; email: string; role: string }) {
  const models = getUserModelAccess(user);
  console.log(`🔑 User ${user.email} has access to models: [${models.join(', ')}]`);
  return models;
}