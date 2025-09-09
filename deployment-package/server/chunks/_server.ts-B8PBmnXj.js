import { j as json } from './index-Djsj11qr.js';
import { getDeviceSummaries, getDeviceStats, updateCloneStatus } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ url }) => {
  try {
    const includeStats = url.searchParams.get("includeStats") === "true";
    const devices = await getDeviceSummaries();
    if (includeStats) {
      const stats = await getDeviceStats();
      return json({ devices, stats });
    }
    return json(devices);
  } catch (error) {
    console.error("Failed to fetch devices:", error);
    return json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
};
const PUT = async ({ request }) => {
  try {
    const body = await request.json();
    const { deviceId, cloneNumber, status } = body;
    if (!deviceId || cloneNumber === void 0 || !status) {
      return json(
        { error: "Missing required fields: deviceId, cloneNumber, status" },
        { status: 400 }
      );
    }
    const success = await updateCloneStatus(deviceId, cloneNumber, status);
    if (success) {
      return json({ message: "Clone status updated successfully" });
    } else {
      return json(
        { error: "Failed to update clone status" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to update clone status:", error);
    return json(
      { error: "Failed to update clone status" },
      { status: 500 }
    );
  }
};

export { GET, PUT };
//# sourceMappingURL=_server.ts-B8PBmnXj.js.map
