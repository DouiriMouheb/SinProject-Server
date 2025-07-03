// routes/timer.js
const express = require("express");
const {
  TimeEntry,
  WorkProject,
  Activity,
  Customer,
  Process,
} = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser } = require("../middleware/rbac");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

/**
 * @route   POST /api/timer/start
 * @desc    Start a new time entry
 * @access  Private
 */
router.post(
  "/start",
  validate(schemas.createTimeEntry),
  catchAsync(async (req, res) => {
    const { workProjectId, activityId, taskName, description } = req.body;
    const userId = req.user.id;

    // Check if user already has an active timer
    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        status: { [Op.in]: ["active", "paused"] },
      },
      include: [
        {
          model: WorkProject,
          as: "workProject",
          attributes: ["name"],
        },
      ],
    });

    if (activeTimer) {
      return res.status(400).json({
        success: false,
        message: `You already have an active timer running for project: ${activeTimer.workProject.name}`,
        data: { activeTimer },
      });
    }

    // Verify project and activity exist
    const project = await WorkProject.findByPk(workProjectId);
    const activity = await Activity.findByPk(activityId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Work project not found",
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Create new time entry
    const timeEntry = await TimeEntry.create({
      userId,
      workProjectId,
      activityId,
      taskName,
      description,
      startTime: new Date(),
      status: "active",
    });

    // Load related data
    await timeEntry.reload({
      include: [
        {
          model: WorkProject,
          as: "workProject",
          attributes: ["name"],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["name"],
        },
      ],
    });

    logger.info("Timer started", {
      userId,
      timeEntryId: timeEntry.id,
      projectName: timeEntry.workProject.name,
      activityName: timeEntry.activity.name,
    });

    res.status(201).json({
      success: true,
      message: "Timer started successfully",
      data: { timeEntry },
    });
  })
);

/**
 * @route   PUT /api/timer/stop
 * @desc    Stop active timer
 * @access  Private
 */
router.put(
  "/stop",
  catchAsync(async (req, res) => {
    const { description } = req.body;
    const userId = req.user.id;

    // Find active timer
    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        status: { [Op.in]: ["active", "paused"] },
      },
    });

    if (!activeTimer) {
      return res.status(400).json({
        success: false,
        message: "No active timer found",
      });
    }

    // Complete the timer
    await activeTimer.complete(description);

    logger.info("Timer stopped", {
      userId,
      timeEntryId: activeTimer.id,
      duration: activeTimer.durationMinutes,
    });

    res.json({
      success: true,
      message: "Timer stopped successfully",
      data: {
        timeEntry: {
          id: activeTimer.id,
          durationMinutes: activeTimer.durationMinutes,
          status: activeTimer.status,
          endTime: activeTimer.endTime,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/timer/pause
 * @desc    Pause active timer
 * @access  Private
 */
router.put(
  "/pause",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        status: "active",
      },
    });

    if (!activeTimer) {
      return res.status(400).json({
        success: false,
        message: "No active timer found",
      });
    }

    await activeTimer.pause();

    res.json({
      success: true,
      message: "Timer paused successfully",
      data: { timeEntry: activeTimer },
    });
  })
);

/**
 * @route   PUT /api/timer/resume
 * @desc    Resume paused timer
 * @access  Private
 */
router.put(
  "/resume",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    const pausedTimer = await TimeEntry.findOne({
      where: {
        userId,
        status: "paused",
      },
    });

    if (!pausedTimer) {
      return res.status(400).json({
        success: false,
        message: "No paused timer found",
      });
    }

    await pausedTimer.resume();

    res.json({
      success: true,
      message: "Timer resumed successfully",
      data: { timeEntry: pausedTimer },
    });
  })
);

/**
 * @route   GET /api/timer/active
 * @desc    Get current active timer
 * @access  Private
 */
router.get(
  "/active",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        status: { [Op.in]: ["active", "paused"] },
      },
      include: [
        {
          model: WorkProject,
          as: "workProject",
          attributes: ["name"],
          include: [
            {
              model: Customer,
              as: "customer",
              attributes: ["name"],
            },
          ],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["name"],
        },
      ],
    });

    res.json({
      success: true,
      data: { activeTimer },
    });
  })
);

/**
 * @route   GET /api/timer/entries
 * @desc    Get user's time entries
 * @access  Private
 */
router.get(
  "/entries",
  catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status = "completed",
      startDate,
      endDate,
    } = req.query;

    const userId = req.user.id;
    const offset = (page - 1) * limit;

    const where = { userId };

    if (status && status !== "all") {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime[Op.gte] = new Date(startDate);
      if (endDate) where.startTime[Op.lte] = new Date(endDate);
    }

    const { count, rows: timeEntries } = await TimeEntry.findAndCountAll({
      where,
      include: [
        {
          model: WorkProject,
          as: "workProject",
          attributes: ["name"],
          include: [
            {
              model: Customer,
              as: "customer",
              attributes: ["name"],
            },
          ],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["name"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["startTime", "DESC"]],
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        timeEntries,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalEntries: count,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/timer/entries/:id
 * @desc    Update time entry
 * @access  Private
 */
router.put(
  "/entries/:id",
  validate(schemas.uuidParam, "params"),
  validate(schemas.updateTimeEntry),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const timeEntry = await TimeEntry.findOne({
      where: { id, userId },
    });

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message: "Time entry not found",
      });
    }

    // Only allow editing completed entries
    if (timeEntry.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed time entries can be edited",
      });
    }

    await timeEntry.update(req.body);

    logger.info("Time entry updated", {
      userId,
      timeEntryId: id,
      updatedFields: Object.keys(req.body),
    });

    res.json({
      success: true,
      message: "Time entry updated successfully",
      data: { timeEntry },
    });
  })
);

module.exports = router;
