import { j as json } from './index-Djsj11qr.js';
import { getAccounts, getAccountsCount, checkUsernameExists, createAccount } from './db-loader-D8HPWY1t.js';
import { v as validateAPIRequest } from './middleware-CRj8HrLf.js';
import { P as PaginationSchema, A as AccountFilterSchema } from './schemas-CDG_pjll.js';
import { A as ACCOUNT_STATUSES } from './status-BUw8K8Dp.js';
import 'zod';
import './db-security-logger-C-Isx1J6.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';

const GET = async (event) => {
  const validation = await validateAPIRequest(event, {
    paramsSchema: PaginationSchema.merge(AccountFilterSchema),
    requireAuth: true,
    rateLimit: {
      requests: 100,
      // 100 requests
      windowMs: 60 * 1e3
      // per minute
    }
  });
  if (!validation.success) {
    return validation.response;
  }
  const { limit, offset, status: statusFilter, search: searchQuery, ownerId, accountTypes, includeMLAccounts } = validation.params;
  try {
    const advancedFilters = {
      ownerId,
      accountTypes,
      includeMLAccounts
    };
    const { url } = event;
    const includeShared = url.searchParams.get("includeShared");
    if (includeShared !== null) {
      advancedFilters.includeShared = includeShared === "true";
    }
    const visibilityFilter = url.searchParams.get("visibilityFilter");
    if (visibilityFilter) {
      advancedFilters.visibilityFilter = visibilityFilter.split(",");
    }
    if (searchQuery) {
      advancedFilters.search = searchQuery;
    }
    if (statusFilter) {
      advancedFilters.statuses = [statusFilter];
    }
    const [accounts, totalCount] = await Promise.all([
      getAccounts(limit, offset, void 0, void 0, advancedFilters),
      getAccountsCount(void 0, void 0, advancedFilters)
    ]);
    return json({
      success: true,
      data: accounts,
      pagination: {
        limit,
        offset,
        hasMore: accounts.length === limit,
        total: totalCount
      },
      // Include applied filters in response for debugging
      appliedFilters: advancedFilters
    });
  } catch (error) {
    console.error("Failed to get accounts:", error);
    return json({
      success: false,
      error: "Failed to retrieve accounts"
    }, { status: 500 });
  }
};
const POST = async ({ request }) => {
  try {
    const data = await request.json();
    const {
      recordId,
      instagramUsername,
      instagramPassword,
      emailAddress,
      emailPassword,
      status = "Unused",
      imapStatus = "On",
      assignedDeviceId,
      assignedCloneNumber,
      assignedPackageName,
      // Account ownership fields
      ownerId,
      accountType = "CLIENT",
      visibility = "PRIVATE",
      isShared = false
    } = data;
    const errors = {};
    if (!instagramUsername) {
      errors.instagramUsername = "Instagram username is required";
    } else if (instagramUsername.length < 3) {
      errors.instagramUsername = "Instagram username must be at least 3 characters";
    }
    if (!instagramPassword) {
      errors.instagramPassword = "Instagram password is required";
    } else if (instagramPassword.length < 6) {
      errors.instagramPassword = "Instagram password must be at least 6 characters";
    }
    if (!emailAddress) {
      errors.emailAddress = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      errors.emailAddress = "Please enter a valid email address";
    }
    if (!emailPassword) {
      errors.emailPassword = "Email password is required";
    } else if (emailPassword.length < 6) {
      errors.emailPassword = "Email password must be at least 6 characters";
    }
    if (!ACCOUNT_STATUSES.includes(status)) {
      errors.status = "Please select a valid status";
    }
    if (imapStatus && !["On", "Off"].includes(imapStatus)) {
      errors.imapStatus = "IMAP status must be On or Off";
    }
    if (instagramUsername) {
      const usernameExists = await checkUsernameExists(instagramUsername);
      if (usernameExists) {
        errors.instagramUsername = "This Instagram username is already registered";
      }
    }
    if (Object.keys(errors).length > 0) {
      return json({
        success: false,
        errors
      }, { status: 400 });
    }
    const newAccount = await createAccount({
      recordId,
      instagramUsername,
      instagramPassword,
      emailAddress,
      emailPassword,
      status,
      imapStatus,
      assignedDeviceId,
      assignedCloneNumber,
      assignedPackageName,
      // Account ownership fields
      ownerId: ownerId || null,
      accountType,
      visibility,
      isShared
    });
    return json({
      success: true,
      data: newAccount
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create account:", error);
    return json({
      success: false,
      error: "Failed to create account"
    }, { status: 500 });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-C2xSW45e.js.map
