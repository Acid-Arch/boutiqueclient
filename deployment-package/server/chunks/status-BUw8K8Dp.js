const ACCOUNT_STATUSES = [
  "Unused",
  "Assigned",
  "Logged In",
  "Banned",
  "Login Error",
  "Password Error",
  "Login In Progress",
  "Critical Error"
];
const CLONE_STATUSES = [
  "Available",
  "Assigned",
  "Logged In",
  "Login Error",
  "Maintenance",
  "Broken"
];
const DEVICE_STATUSES = [
  "Available",
  "Logged In",
  "Maintenance",
  "Broken"
];
const CLONE_HEALTH = [
  "Working",
  "Broken",
  "Unknown"
];
function getStatusClass(status) {
  const statusClassMap = {
    "Unused": "status-unused",
    "Assigned": "status-assigned",
    "Logged In": "status-logged-in",
    "Login Error": "status-login-error",
    "Password Error": "status-password-error",
    "Banned": "status-banned",
    "Login In Progress": "status-login-in-progress",
    "Critical Error": "status-critical-error"
  };
  return statusClassMap[status] || "status-unused";
}
function getCloneStatusClass(status) {
  const statusClassMap = {
    "Available": "status-unused",
    "Assigned": "status-assigned",
    "Logged In": "status-logged-in",
    "Login Error": "status-login-error",
    "Maintenance": "status-password-error",
    "Broken": "status-banned"
  };
  return statusClassMap[status] || "status-unused";
}
function getDeviceStatusClass(status) {
  const statusClassMap = {
    "Available": "status-unused",
    "Logged In": "status-logged-in",
    "Maintenance": "status-password-error",
    "Broken": "status-banned"
  };
  return statusClassMap[status] || "status-unused";
}

export { ACCOUNT_STATUSES as A, CLONE_HEALTH as C, DEVICE_STATUSES as D, CLONE_STATUSES as a, getDeviceStatusClass as b, getStatusClass as c, getCloneStatusClass as g };
//# sourceMappingURL=status-BUw8K8Dp.js.map
