import { j as json } from './index-Djsj11qr.js';
import { getAvailableAccounts } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ url }) => {
  try {
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 50;
    const accounts = await getAvailableAccounts(limit);
    return json(accounts);
  } catch (error) {
    console.error("Failed to fetch available accounts:", error);
    return json(
      { error: "Failed to fetch available accounts" },
      { status: 500 }
    );
  }
};

export { GET };
//# sourceMappingURL=_server.ts-DSdGpbvp.js.map
