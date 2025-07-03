// middleware/rbac.js
const logger = require("../utils/logger");

const ROLES = {
  USER: "user",
  ADMIN: "admin",
};

/**
 * Middleware to check if user has required role
 */
const authorize = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required for this action.",
        });
      }

      const userRole = req.user.role;

      // Check if user has required role
      if (requiredRole === ROLES.ADMIN && userRole !== ROLES.ADMIN) {
        logger.warn("Access denied", {
          userId: req.user.id,
          userRole,
          requiredRole,
          endpoint: `${req.method} ${req.path}`,
        });

        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
        });
      }

      next();
    } catch (error) {
      logger.error("Authorization error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during authorization.",
      });
    }
  };
};

const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }
  next();
};

const requireAdmin = authorize(ROLES.ADMIN);

module.exports = {
  ROLES,
  authorize,
  requireUser,
  requireAdmin,
};
