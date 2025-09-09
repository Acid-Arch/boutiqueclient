import { j as json } from './index-Djsj11qr.js';
import { unassignAccountFromClone } from './database-CKYbeswu.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './status-BUw8K8Dp.js';

const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { deviceId, cloneNumber } = body;
    if (!deviceId || cloneNumber === void 0) {
      return json(
        { error: "Missing required fields: deviceId, cloneNumber" },
        { status: 400 }
      );
    }
    const success = await unassignAccountFromClone(deviceId, cloneNumber);
    if (success) {
      return json({
        message: `Successfully unassigned account from device ${deviceId} clone ${cloneNumber}`
      });
    } else {
      return json(
        { error: "Failed to unassign account from clone. The clone may not have an assigned account." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Failed to unassign account from clone:", error);
    return json(
      { error: "An error occurred while unassigning the account" },
      { status: 500 }
    );
  }
};

export { POST };
//# sourceMappingURL=_server.ts-CENoidbe.js.map
