// Minimal prisma.js for build compatibility
// Uses postgres-direct client instead of Prisma
import pgDirect from './postgres-direct.js';

// Export a prisma-like object that uses our direct PostgreSQL client
export const prisma = {
  // Mock $connect method
  async $connect() {
    return await pgDirect.testConnection();
  },
  
  // Mock $disconnect method
  async $disconnect() {
    return true;
  },
  
  // Health check method
  async $queryRaw(query: any) {
    return await pgDirect.query(query);
  }
};

export default prisma;