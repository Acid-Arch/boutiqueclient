// Prisma client with fallback for deployment
// This handles the case where Prisma engines may not be available on certain platforms

import { PrismaClient } from '@prisma/client';

let prisma;

try {
  // Try to create Prisma client
  prisma = new PrismaClient({
    log: ['error'],
    errorFormat: 'minimal',
  });
  
  console.log('✅ Prisma client initialized successfully');
} catch (error) {
  console.warn('⚠️ Prisma client failed to initialize:', error.message);
  
  // Fallback to direct database queries
  // This is a mock object that provides the same interface but throws errors
  prisma = {
    $queryRaw: async () => {
      throw new Error('Prisma unavailable - using direct database connection');
    },
    $connect: async () => {
      console.log('Prisma connect attempted (fallback mode)');
    },
    $disconnect: async () => {
      console.log('Prisma disconnect attempted (fallback mode)');
    }
  };
}

export { prisma };