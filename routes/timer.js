// routes/timer.js - FIXED VERSION with missing endpoints
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
 * @route   POST /api/timer/entries
 * @desc    Create manual time entry - MISSING ENDPOINT ADDED
 * @access  Private
 */
router.post(
  "/entries",
  validate(schemas.createManualTimeEntry), // New validation schema needed
  catchAsync(async (req, res) => {
    const {
      workProjectId,
      activityId,
      taskName,
      description,
      startTime,
      endTime,
      durationMinutes,
    } = req.body;
    const userId = req.user.id;

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

    // Validate time entries
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    // Create manual time entry
    const timeEntry = await TimeEntry.create({
      userId,
      workProjectId,
      activityId,
      taskName,
      description,
      startTime: start,
      endTime: end,
      durationMinutes:
        durationMinutes || Math.floor((end - start) / (1000 * 60)),
      status: "completed",
      isManual: true,
    });

    // Load related data
    await timeEntry.reload({
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

    logger.info("Manual time entry created", {
      userId,
      timeEntryId: timeEntry.id,
      projectName: timeEntry.workProject.name,
      activityName: timeEntry.activity.name,
      duration: timeEntry.durationMinutes,
    });

    res.status(201).json({
      success: true,
      message: "Manual time entry created successfully",
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
      workProjectId,
      activityId,
      customerId,
      search,
      sortBy = "startTime",
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.id;
    const offset = (page - 1) * limit;

    const where = { userId };

    // Status filter
    if (status && status !== "all") {
      where.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime[Op.gte] = new Date(startDate);
      if (endDate)
        where.startTime[Op.lte] = new Date(endDate + "T23:59:59.999Z");
    }

    // Project filter
    if (workProjectId) {
      where.workProjectId = workProjectId;
    }

    // Activity filter
    if (activityId) {
      where.activityId = activityId;
    }

    // Search filter
    if (search) {
      where[Op.or] = [
        { taskName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Include conditions for customer filter
    const includeConditions = [
      {
        model: WorkProject,
        as: "workProject",
        attributes: ["name"],
        include: [
          {
            model: Customer,
            as: "customer",
            attributes: ["name"],
            ...(customerId && { where: { id: customerId } }),
          },
        ],
        ...(customerId && { required: true }),
      },
      {
        model: Activity,
        as: "activity",
        attributes: ["name"],
      },
    ];

    // Sorting
    const orderClause = [];
    if (sortBy === "workProject") {
      orderClause.push([
        { model: WorkProject, as: "workProject" },
        "name",
        sortOrder.toUpperCase(),
      ]);
    } else if (sortBy === "activity") {
      orderClause.push([
        { model: Activity, as: "activity" },
        "name",
        sortOrder.toUpperCase(),
      ]);
    } else {
      orderClause.push([sortBy, sortOrder.toUpperCase()]);
    }

    const { count, rows: timeEntries } = await TimeEntry.findAndCountAll({
      where,
      include: includeConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: orderClause,
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

    // Reload with associations
    await timeEntry.reload({
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

/**
 * @route   DELETE /api/timer/entries/:id
 * @desc    Delete time entry - MISSING ENDPOINT ADDED
 * @access  Private
 */
router.delete(
  "/entries/:id",
  validate(schemas.uuidParam, "params"),
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

    // Only allow deleting completed entries
    if (timeEntry.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed time entries can be deleted",
      });
    }

    // Store info for logging before deletion
    const entryInfo = {
      taskName: timeEntry.taskName,
      durationMinutes: timeEntry.durationMinutes,
    };

    await timeEntry.destroy();

    logger.info("Time entry deleted", {
      userId,
      timeEntryId: id,
      taskName: entryInfo.taskName,
      duration: entryInfo.durationMinutes,
    });

    res.json({
      success: true,
      message: "Time entry deleted successfully",
    });
  })
);

module.exports = router;
