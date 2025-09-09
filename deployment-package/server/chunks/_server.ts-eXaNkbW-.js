import { j as json } from './index-Djsj11qr.js';

const GET = async () => {
  try {
    return json({
      success: true,
      environment: {
        DATABASE_URL: process.env.DATABASE_URL || "not set",
        NODE_ENV: process.env.NODE_ENV || "not set",
        DATABASE_URL_masked: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ":***@") : "not set"
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

export { GET };
//# sourceMappingURL=_server.ts-eXaNkbW-.js.map
