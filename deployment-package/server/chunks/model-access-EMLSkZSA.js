function getUserModelAccess(user) {
  const assignedModels = [];
  if (user.email && user.email.includes("@gmail.com")) {
    assignedModels.push("Dillion");
  }
  if (user.email && (user.email.includes("@hotmail.") || user.email.includes("@live.") || user.email.includes("@outlook."))) {
    assignedModels.push("katie");
  }
  if (user.role === "ADMIN") {
    assignedModels.push("Dillion", "katie", "Premium", "Basic");
  }
  return assignedModels;
}
function getAccountsFilterForUser(user) {
  const userModels = getUserModelAccess(user);
  const userId = parseInt(user.id) || null;
  return {
    OR: [
      // Direct ownership
      { ownerId: userId },
      // Model-based access
      ...userModels.length > 0 ? [{ model: { in: userModels } }] : []
    ]
  };
}
function logUserModelAccess(user) {
  const models = getUserModelAccess(user);
  console.log(`🔑 User ${user.email} has access to models: [${models.join(", ")}]`);
  return models;
}

export { getAccountsFilterForUser as g, logUserModelAccess as l };
//# sourceMappingURL=model-access-EMLSkZSA.js.map
