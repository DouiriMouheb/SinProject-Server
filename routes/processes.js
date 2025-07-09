// routes/processes.js - Clean process and activity management
const express = require("express");
const { Process, Activity } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser, requireAdmin } = require("../middleware/rbac");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

/**
 * @route   GET /api/processes
 * @desc    Get all processes with their activities
 * @access  Private
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const { search, includeActivities = "true" } = req.query;

    const where = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    logger.info("Fetching processes", { includeActivities });

    try {
      const queryOptions = {
        where,
        order: [["name", "ASC"]],
      };

      // Only include activities if requested and not causing issues
      if (includeActivities === "true") {
        queryOptions.include = [
          {
            model: Activity,
            as: "activities",
            attributes: ["id", "name", "description"],
            required: false, // Left join to avoid issues with processes without activities
          },
        ];
        queryOptions.order.push([
          { model: Activity, as: "activities" },
          "name",
          "ASC",
        ]);
      }

      const processes = await Process.findAll(queryOptions);

      logger.info(`Found ${processes.length} processes`);

      res.json({
        success: true,
        data: { processes },
      });
    } catch (error) {
      logger.error("Error fetching processes:", error);

      // Fallback: try without activities if include fails
      if (
        error.message.includes("activities") ||
        error.message.includes("Activity")
      ) {
        logger.info("Retrying without activities due to association error");
        try {
          const processes = await Process.findAll({
            where,
            order: [["name", "ASC"]],
          });

          return res.json({
            success: true,
            data: { processes },
            warning: "Activities not included due to database schema issue",
          });
        } catch (fallbackError) {
          logger.error("Fallback query also failed:", fallbackError);
        }
      }

      throw error;
    }
  })
);

/**
 * @route   GET /api/processes/:id
 * @desc    Get a specific process with its activities
 * @access  Private
 */
router.get(
  "/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const process = await Process.findByPk(id, {
      include: [
        {
          model: Activity,
          as: "activities",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    res.json({
      success: true,
      data: { process },
    });
  })
);

/**
 * @route   GET /api/processes/:id/activities
 * @desc    Get all activities for a specific process
 * @access  Private
 */
router.get(
  "/:id/activities",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    // Check if process exists
    const process = await Process.findByPk(id);
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    const activities = await Activity.findAll({
      where: { processId: id },
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: { activities },
    });
  })
);

/**
 * @route   POST /api/processes
 * @desc    Create a new process (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Process name is required",
      });
    }

    const process = await Process.create({
      name,
      description,
    });

    logger.info(`Process created: ${process.name}`, {
      adminUserId: req.user.id,
      processId: process.id,
    });

    res.status(201).json({
      success: true,
      message: "Process created successfully",
      data: { process },
    });
  })
);

/**
 * @route   POST /api/processes/:id/activities
 * @desc    Create a new activity for a process (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/:id/activities",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Activity name is required",
      });
    }

    // Check if process exists
    const process = await Process.findByPk(id);
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    const activity = await Activity.create({
      processId: id,
      name,
      description,
    });

    logger.info(
      `Activity created: ${activity.name} for process: ${process.name}`,
      {
        adminUserId: req.user.id,
        processId: id,
        activityId: activity.id,
      }
    );

    res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: { activity },
    });
  })
);

/**
 * @route   PUT /api/processes/:id
 * @desc    Update a process (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const process = await Process.findByPk(id);
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    await process.update({
      name: name || process.name,
      description:
        description !== undefined ? description : process.description,
    });

    logger.info(`Process updated: ${process.name}`, {
      adminUserId: req.user.id,
      processId: id,
    });

    res.json({
      success: true,
      message: "Process updated successfully",
      data: { process },
    });
  })
);

/**
 * @route   DELETE /api/processes/:id
 * @desc    Delete a process (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const process = await Process.findByPk(id, {
      include: [{ model: Activity, as: "activities" }],
    });

    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    // Check if process has activities
    if (process.activities && process.activities.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete process that has activities. Delete activities first.",
      });
    }

    await process.destroy();

    logger.info(`Process deleted: ${process.name}`, {
      adminUserId: req.user.id,
      processId: id,
    });

    res.json({
      success: true,
      message: "Process deleted successfully",
    });
  })
);

module.exports = router;
