import { j as json } from './index-Djsj11qr.js';
import { getAccountById, deleteAccount, checkUsernameExists, updateAccount } from './db-loader-D8HPWY1t.js';
import { A as ACCOUNT_STATUSES } from './status-BUw8K8Dp.js';

const GET = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({
        success: false,
        error: "Invalid account ID"
      }, { status: 400 });
    }
    const account = await getAccountById(id);
    if (!account) {
      return json({
        success: false,
        error: "Account not found"
      }, { status: 404 });
    }
    return json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error("Failed to get account:", error);
    return json({
      success: false,
      error: "Failed to retrieve account"
    }, { status: 500 });
  }
};
const PUT = async ({ params, request }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({
        success: false,
        error: "Invalid account ID"
      }, { status: 400 });
    }
    const existingAccount = await getAccountById(id);
    if (!existingAccount) {
      return json({
        success: false,
        error: "Account not found"
      }, { status: 404 });
    }
    const data = await request.json();
    const {
      recordId,
      instagramUsername,
      instagramPassword,
      emailAddress,
      emailPassword,
      status,
      imapStatus,
      assignedDeviceId,
      assignedCloneNumber,
      assignedPackageName
    } = data;
    const errors = {};
    if (instagramUsername !== void 0) {
      if (!instagramUsername) {
        errors.instagramUsername = "Instagram username is required";
      } else if (instagramUsername.length < 3) {
        errors.instagramUsername = "Instagram username must be at least 3 characters";
      } else {
        const usernameExists = await checkUsernameExists(instagramUsername, id);
        if (usernameExists) {
          errors.instagramUsername = "This Instagram username is already registered";
        }
      }
    }
    if (instagramPassword !== void 0) {
      if (!instagramPassword) {
        errors.instagramPassword = "Instagram password is required";
      } else if (instagramPassword.length < 6) {
        errors.instagramPassword = "Instagram password must be at least 6 characters";
      }
    }
    if (emailAddress !== void 0) {
      if (!emailAddress) {
        errors.emailAddress = "Email address is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
        errors.emailAddress = "Please enter a valid email address";
      }
    }
    if (emailPassword !== void 0) {
      if (!emailPassword) {
        errors.emailPassword = "Email password is required";
      } else if (emailPassword.length < 6) {
        errors.emailPassword = "Email password must be at least 6 characters";
      }
    }
    if (status !== void 0 && !ACCOUNT_STATUSES.includes(status)) {
      errors.status = "Please select a valid status";
    }
    if (imapStatus !== void 0 && !["On", "Off"].includes(imapStatus)) {
      errors.imapStatus = "IMAP status must be On or Off";
    }
    if (Object.keys(errors).length > 0) {
      return json({
        success: false,
        errors
      }, { status: 400 });
    }
    const updateData = {};
    if (recordId !== void 0) updateData.recordId = recordId;
    if (instagramUsername !== void 0) updateData.instagramUsername = instagramUsername;
    if (instagramPassword !== void 0) updateData.instagramPassword = instagramPassword;
    if (emailAddress !== void 0) updateData.emailAddress = emailAddress;
    if (emailPassword !== void 0) updateData.emailPassword = emailPassword;
    if (status !== void 0) updateData.status = status;
    if (imapStatus !== void 0) updateData.imapStatus = imapStatus;
    if (assignedDeviceId !== void 0) updateData.assignedDeviceId = assignedDeviceId;
    if (assignedCloneNumber !== void 0) updateData.assignedCloneNumber = assignedCloneNumber;
    if (assignedPackageName !== void 0) updateData.assignedPackageName = assignedPackageName;
    const updatedAccount = await updateAccount(id, updateData);
    return json({
      success: true,
      data: updatedAccount
    });
  } catch (error) {
    console.error("Failed to update account:", error);
    return json({
      success: false,
      error: "Failed to update account"
    }, { status: 500 });
  }
};
const DELETE = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({
        success: false,
        error: "Invalid account ID"
      }, { status: 400 });
    }
    const existingAccount = await getAccountById(id);
    if (!existingAccount) {
      return json({
        success: false,
        error: "Account not found"
      }, { status: 404 });
    }
    await deleteAccount(id);
    return json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return json({
      success: false,
      error: "Failed to delete account"
    }, { status: 500 });
  }
};
const PATCH = async ({ params, request }) => {
  return PUT({ params, request });
};

export { DELETE, GET, PATCH, PUT };
//# sourceMappingURL=_server.ts-CbWmsOQe.js.map
