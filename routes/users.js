// routes/users.js
const express = require("express");
const { User } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser, requireAdmin } = require("../middleware/rbac");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/users/me
 * @desc    Get current user's profile
 * @access  Private
 */
router.get(
  "/me",
  requireUser,
  catchAsync(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });

    res.json({
      success: true,
      data: { user },
    });
  })
);

/**
 * @route   PUT /api/users/me
 * @desc    Update current user's profile
 * @access  Private
 */
router.put(
  "/me",
  requireUser,
  validate(schemas.updateUser),
  catchAsync(async (req, res) => {
    const allowedFields = ["name"];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    await req.user.update(updates);

    logger.info("Profile updated", {
      userId: req.user.id,
      updatedFields: Object.keys(updates),
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: req.user },
    });
  })
);

module.exports = router;
