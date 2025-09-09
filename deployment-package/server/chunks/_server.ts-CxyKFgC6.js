import { j as json } from './index-Djsj11qr.js';
import { query } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async () => {
  try {
    console.log("Testing database connection...");
    console.log("Test 1: Simple SELECT 1");
    const test1 = await query("SELECT 1 as test");
    console.log("Test 1 result:", test1.rows);
    console.log("Test 2: Show tables");
    const test2 = await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'scraping%'");
    console.log("Test 2 result:", test2.rows);
    console.log("Test 3: Count scraping_sessions");
    const test3 = await query("SELECT COUNT(*) as count FROM scraping_sessions");
    console.log("Test 3 result:", test3.rows);
    return json({
      success: true,
      tests: {
        simple: test1.rows,
        tables: test2.rows,
        count: test3.rows
      }
    });
  } catch (error) {
    console.error("Database test error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : void 0
    }, { status: 500 });
  }
};

export { GET };
//# sourceMappingURL=_server.ts-CxyKFgC6.js.map
