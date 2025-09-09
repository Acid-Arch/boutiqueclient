import { j as json } from './index-Djsj11qr.js';
import { getDeviceDetails } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const GET = async ({ params }) => {
  try {
    const { deviceId } = params;
    if (!deviceId) {
      return json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }
    const deviceDetails = await getDeviceDetails(deviceId);
    if (!deviceDetails.device) {
      return json(
        { error: "Device not found" },
        { status: 404 }
      );
    }
    return json(deviceDetails);
  } catch (error) {
    console.error("Failed to fetch device details:", error);
    return json(
      { error: "Failed to fetch device details" },
      { status: 500 }
    );
  }
};

export { GET };
//# sourceMappingURL=_server.ts-P_Mr0Bwp.js.map
