// routes/timer.js - FIXED VERSION with missing endpoints
const express = require("express");
const {
  TimeEntry,
  WorkProject,
  Activity,
  Customer,
  Process,
  User,
} = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser, requireManager } = require("../middleware/rbac");
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

    // Check if user already has an active timer (endTime is null)
    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        endTime: null,
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
      endTime: null, // null indicates active timer
      isManual: false,
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

    // Find active timer (endTime is null)
    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        endTime: null,
      },
    });

    if (!activeTimer) {
      return res.status(400).json({
        success: false,
        message: "No active timer found",
      });
    }

    // Complete the timer
    const now = new Date();

    await activeTimer.update({
      endTime: now,
      description: description || activeTimer.description,
    });

    logger.info("Timer stopped", {
      userId,
      timeEntryId: activeTimer.id,
    });

    res.json({
      success: true,
      message: "Timer stopped successfully",
      data: {
        timeEntry: {
          id: activeTimer.id,
          endTime: activeTimer.endTime,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/timer/pause
 * @desc    Pause active timer (Not available without status field)
 * @access  Private
 */
router.put(
  "/pause",
  catchAsync(async (req, res) => {
    res.status(400).json({
      success: false,
      message: "Pause functionality not available in simplified timer mode",
    });
  })
);

/**
 * @route   PUT /api/timer/resume
 * @desc    Resume paused timer (Not available without status field)
 * @access  Private
 */
router.put(
  "/resume",
  catchAsync(async (req, res) => {
    res.status(400).json({
      success: false,
      message: "Resume functionality not available in simplified timer mode",
    });
  })
);

/**
 * @route   GET /api/timer/active
 * @desc    Get current active timer (optimized)
 * @access  Private
 */
router.get(
  "/active",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    // Optimized query with selective attributes
    const activeTimer = await TimeEntry.findOne({
      where: {
        userId,
        endTime: null, // Active timer has no end time
      },
      attributes: [
        "id",
        "taskName",
        "description",
        "startTime",
        "workProjectId",
        "activityId",
      ],
      include: [
        {
          model: WorkProject,
          as: "workProject",
          attributes: ["id", "name"],
          include: [
            {
              model: Customer,
              as: "customer",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["id", "name"],
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

    // Completion filter - replace status with endTime logic
    if (status && status !== "all") {
      if (status === "completed") {
        where.endTime = { [Op.ne]: null }; // Completed entries have endTime
      } else if (status === "active") {
        where.endTime = null; // Active entries have no endTime
      }
      // Note: "paused" status not available without status field
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

    // Only allow editing completed entries (entries with endTime)
    if (!timeEntry.endTime) {
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

    // Only allow deleting completed entries (entries with endTime)
    if (!timeEntry.endTime) {
      return res.status(400).json({
        success: false,
        message: "Only completed time entries can be deleted",
      });
    }

    // Store info for logging before deletion
    const entryInfo = {
      taskName: timeEntry.taskName,
    };

    await timeEntry.destroy();

    logger.info("Time entry deleted", {
      userId,
      timeEntryId: id,
      taskName: entryInfo.taskName,
    });

    res.json({
      success: true,
      message: "Time entry deleted successfully",
    });
  })
);

/**
 * @route   GET /api/timer/entries/user/:userId
 * @desc    Get time entries for specific user (Admin/Manager only)
 * @access  Private (Admin/Manager)
 */
router.get(
  "/entries/user/:userId",
  requireManager,
  validate(schemas.userIdParam, "params"),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 100, // Higher default limit for reports
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

    const userId = req.params.userId;
    const offset = (page - 1) * limit;

    const where = { userId };

    // Completion filter
    if (status && status !== "all") {
      if (status === "completed") {
        where.endTime = { [Op.ne]: null };
      } else if (status === "active") {
        where.endTime = null;
      }
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

    // Include conditions
    const includeConditions = [
      {
        model: User,
        as: "user",
        attributes: ["name", "email"],
      },
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
    } else if (sortBy === "customer") {
      orderClause.push([
        { model: WorkProject, as: "workProject" },
        { model: Customer, as: "customer" },
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

    const { rows: entries, count } = await TimeEntry.findAndCountAll({
      where,
      include: includeConditions,
      order: orderClause,
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    logger.info("Time entries retrieved for user", {
      requestingUserId: req.user.id,
      targetUserId: userId,
      count: entries.length,
    });

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      totalEntries: count,
      limit: parseInt(limit),
    };

    res.json({
      success: true,
      data: {
        entries,
        pagination,
      },
    });
  })
);

/**
 * @route   GET /api/timer/users/:userId/entries
 * @desc    Get time entries for specific user (Admin/Manager only) - Alternative endpoint
 * @access  Private (Admin/Manager)
 */
router.get(
  "/users/:userId/entries",
  requireManager,
  validate(schemas.userIdParam, "params"),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 100, // Higher default limit for reports
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

    const userId = req.params.userId;
    const offset = (page - 1) * limit;

    const where = { userId };

    // Completion filter
    if (status && status !== "all") {
      if (status === "completed") {
        where.endTime = { [Op.ne]: null };
      } else if (status === "active") {
        where.endTime = null;
      }
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

    // Include conditions
    const includeConditions = [
      {
        model: User,
        as: "user",
        attributes: ["name", "email"],
      },
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
    } else if (sortBy === "customer") {
      orderClause.push([
        { model: WorkProject, as: "workProject" },
        { model: Customer, as: "customer" },
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

    const { rows: entries, count } = await TimeEntry.findAndCountAll({
      where,
      include: includeConditions,
      order: orderClause,
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    logger.info("Time entries retrieved for user (alternative endpoint)", {
      requestingUserId: req.user.id,
      targetUserId: userId,
      count: entries.length,
    });

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      totalEntries: count,
      limit: parseInt(limit),
    };

    res.json({
      success: true,
      data: {
        entries,
        pagination,
      },
    });
  })
);

module.exports = router;
