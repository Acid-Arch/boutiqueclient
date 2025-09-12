/**
 * Model Access Management
 * 
 * This module handles the relationship between users and Instagram account models.
 * Users are assigned specific models in the database and get access to accounts with those models.
 */

export interface UserModelAccess {
  userId: string;
  email: string;
  assignedModels: string[];
}

/**
 * Determines which models a user has access to based on their database model assignment and role
 */
export function getUserModelAccess(user: { id: string; email: string; role: string; model?: string }): string[] {
  const assignedModels: string[] = [];
  
  // Use the user's assigned model from database
  if (user.model) {
    assignedModels.push(user.model);
    console.log(`🔑 Database model assignment: ${user.email} has model ${user.model}`);
  } else {
    console.log(`⚠️  No model assigned to user ${user.email}`);
  }
  
  // Admin users get access to all models
  if (user.role === 'ADMIN') {
    assignedModels.push('Dillion', 'katie', 'Premium', 'Basic');
    console.log(`🔑 Admin user ${user.email} gets access to all models`);
  }
  
  return assignedModels;
}

/**
 * Checks if a user has access to a specific model
 */
export function userCanAccessModel(user: { id: string; email: string; role: string; model?: string }, model: string): boolean {
  const userModels = getUserModelAccess(user);
  return userModels.includes(model);
}

/**
 * Gets the database query filter for Instagram accounts based on user's model access
 */
export function getAccountsFilterForUser(user: { id: string; email: string; role: string; model?: string }) {
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
export function logUserModelAccess(user: { id: string; email: string; role: string; model?: string }) {
  const models = getUserModelAccess(user);
  console.log(`🔑 User ${user.email} has access to models: [${models.join(", ")}]`);
  return models;
}
