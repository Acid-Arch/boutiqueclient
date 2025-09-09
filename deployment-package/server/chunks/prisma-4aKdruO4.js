import { PrismaClient } from '@prisma/client';

let prisma;
try {
  prisma = new PrismaClient({
    log: ["error"],
    errorFormat: "minimal"
  });
  console.log("✅ Prisma client initialized successfully");
} catch (error) {
  console.warn("⚠️ Prisma client failed to initialize:", error.message);
  prisma = {
    $queryRaw: async () => {
      throw new Error("Prisma unavailable - using direct database connection");
    },
    $connect: async () => {
      console.log("Prisma connect attempted (fallback mode)");
    },
    $disconnect: async () => {
      console.log("Prisma disconnect attempted (fallback mode)");
    }
  };
}

export { prisma as p };
//# sourceMappingURL=prisma-4aKdruO4.js.map
