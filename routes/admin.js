// routes/admin.js
const express = require("express");
const { User } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/rbac");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(requireAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/users",
  catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      isActive = "",
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== "") {
      where.isActive = isActive === "true";
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers: count,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  })
);

/**
 * @route   POST /api/admin/users
 * @desc    Create new user (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/users",
  validate(schemas.register),
  catchAsync(async (req, res) => {
    const { name, email, password, role = "user" } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      isActive: true,
    });

    logger.info("User created by admin", {
      createdBy: req.user.id,
      createdUser: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/users/:id",
  validate(schemas.uuidParam, "params"),
  validate(schemas.updateUser),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent self-deactivation
    if (id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Update user
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    await user.update(updates);

    logger.info("User updated by admin", {
      updatedBy: req.user.id,
      targetUser: id,
      updatedFields: Object.keys(updates),
    });

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user },
    });
  })
);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/users/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // Check if deleting last admin
    if (user.role === "admin") {
      const adminCount = await User.count({
        where: {
          role: "admin",
          id: { [Op.ne]: id },
        },
      });

      if (adminCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last admin user",
        });
      }
    }

    await user.destroy();

    logger.info("User deleted by admin", {
      deletedBy: req.user.id,
      deletedUser: id,
      deletedUserEmail: user.email,
    });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  })
);

module.exports = router;
