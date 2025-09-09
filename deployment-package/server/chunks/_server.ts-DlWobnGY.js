import { j as json } from './index-Djsj11qr.js';
import { assignAccountToClone } from './db-loader-D8HPWY1t.js';
import './status-BUw8K8Dp.js';

const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { deviceId, cloneNumber, instagramUsername } = body;
    if (!deviceId || cloneNumber === void 0 || !instagramUsername) {
      return json(
        { error: "Missing required fields: deviceId, cloneNumber, instagramUsername" },
        { status: 400 }
      );
    }
    const success = await assignAccountToClone(deviceId, cloneNumber, instagramUsername);
    if (success) {
      return json({
        message: `Successfully assigned ${instagramUsername} to device ${deviceId} clone ${cloneNumber}`
      });
    } else {
      return json(
        { error: "Failed to assign account to clone. The clone may already be assigned or the account may not exist." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Failed to assign account to clone:", error);
    return json(
      { error: "An error occurred while assigning the account" },
      { status: 500 }
    );
  }
};

export { POST };
//# sourceMappingURL=_server.ts-DlWobnGY.js.map
