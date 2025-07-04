// routes/projects.js
const express = require("express");
const {
  WorkProject,
  Customer,
  TimeEntry,
  Activity,
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
 * @route   GET /api/projects
 * @desc    Get all work projects
 * @access  Private
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search = "",
        status = "",
        customerId = "",
      } = req.query;
      const offset = (page - 1) * limit;

      const where = {};

      if (search) {
        where.name = { [Op.iLike]: `%${search}%` };
      }
      if (status) {
        where.status = status;
      }
      if (customerId) {
        where.customerId = customerId;
      }

      console.log("Fetching work projects with filters:", where);

      const { count, rows: projects } = await WorkProject.findAndCountAll({
        where,
        include: [
          {
            model: Customer,
            as: "customer",
            attributes: ["id", "name"],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["name", "ASC"]],
      });

      console.log(`Found ${projects.length} projects`);

      res.json({
        success: true,
        data: {
          projects,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalProjects: count,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching work projects:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Failed to fetch work projects",
          details: error.message,
        },
      });
    }
  })
);

/**
 * @route   POST /api/projects
 * @desc    Create new work project
 * @access  Private
 */
router.post(
  "/",
  validate(schemas.createProject),
  catchAsync(async (req, res) => {
    const project = await WorkProject.create(req.body);

    // Load with customer data
    await project.reload({
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name"],
        },
      ],
    });

    logger.info("Work project created", {
      userId: req.user.id,
      projectId: project.id,
      projectName: project.name,
      customerId: project.customerId,
    });

    res.status(201).json({
      success: true,
      message: "Work project created successfully",
      data: { project },
    });
  })
);

/**
 * @route   GET /api/projects/processes-activities
 * @desc    Get all processes and their activities
 * @access  Private
 */
router.get(
  "/processes-activities",
  catchAsync(async (req, res) => {
    try {
      console.log("Fetching processes and activities...");

      const processes = await Process.findAll({
        include: [
          {
            model: Activity,
            as: "activities",
            required: false,
            attributes: ["id", "name", "description"],
          },
        ],
        order: [
          ["name", "ASC"],
          [{ model: Activity, as: "activities" }, "name", "ASC"],
        ],
      });

      console.log(`Found ${processes.length} processes`);

      res.json({
        success: true,
        data: { processes },
      });
    } catch (error) {
      console.error("Error fetching processes and activities:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Failed to fetch processes and activities",
          details: error.message,
        },
      });
    }
  })
);
/**
 * @route   POST /api/projects/processes
 * @desc    Create new process
 * @access  Private
 */
router.post(
  "/processes",
  validate(schemas.createProcess),
  catchAsync(async (req, res) => {
    const process = await Process.create(req.body);

    logger.info("Process created", {
      userId: req.user.id,
      processId: process.id,
      processName: process.name,
    });

    res.status(201).json({
      success: true,
      message: "Process created successfully",
      data: { process },
    });
  })
);

/**
 * @route   GET /api/projects/processes
 * @desc    Get all processes
 * @access  Private
 */
router.get(
  "/processes",
  catchAsync(async (req, res) => {
    const { page = 1, limit = 50, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: processes } = await Process.findAndCountAll({
      where,
      include: [
        {
          model: Activity,
          as: "activities",
          attributes: ["id", "name", "description", "estimatedMinutes"],
          required: false,
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: {
        processes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalProcesses: count,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/projects/processes/:id
 * @desc    Update process
 * @access  Private
 */
router.put(
  "/processes/:id",
  validate(schemas.uuidParam, "params"),
  validate(schemas.updateProcess),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const process = await Process.findByPk(id);
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    await process.update(req.body);

    logger.info("Process updated", {
      userId: req.user.id,
      processId: id,
      updatedFields: Object.keys(req.body),
    });

    res.json({
      success: true,
      message: "Process updated successfully",
      data: { process },
    });
  })
);

/**
 * @route   POST /api/projects/processes/:processId/activities
 * @desc    Create new activity for a process
 * @access  Private
 */
router.post(
  "/processes/:processId/activities",
  validate(schemas.processIdParam, "params"),
  validate(schemas.createActivity),
  catchAsync(async (req, res) => {
    const { processId } = req.params;

    // Verify process exists
    const process = await Process.findByPk(processId);
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    const activity = await Activity.create({
      ...req.body,
      processId,
    });

    // Load with process data
    await activity.reload({
      include: [
        {
          model: Process,
          as: "process",
          attributes: ["id", "name"],
        },
      ],
    });

    logger.info("Activity created", {
      userId: req.user.id,
      activityId: activity.id,
      activityName: activity.name,
      processId,
    });

    res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: { activity },
    });
  })
);

/**
 * @route   GET /api/projects/activities
 * @desc    Get all activities
 * @access  Private
 */
router.get(
  "/activities",
  catchAsync(async (req, res) => {
    const { page = 1, limit = 50, search = "", processId = "" } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }
    if (processId) {
      where.processId = processId;
    }

    const { count, rows: activities } = await Activity.findAndCountAll({
      where,
      include: [
        {
          model: Process,
          as: "process",
          attributes: ["id", "name", "category"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalActivities: count,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/projects/activities/:id
 * @desc    Update activity
 * @access  Private
 */
router.put(
  "/activities/:id",
  validate(schemas.uuidParam, "params"),
  validate(schemas.updateActivity),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const activity = await Activity.findByPk(id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await activity.update(req.body);

    logger.info("Activity updated", {
      userId: req.user.id,
      activityId: id,
      updatedFields: Object.keys(req.body),
    });

    res.json({
      success: true,
      message: "Activity updated successfully",
      data: { activity },
    });
  })
);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get(
  "/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const project = await WorkProject.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.json({
      success: true,
      data: { project },
    });
  })
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private
 */
router.put(
  "/:id",
  validate(schemas.uuidParam, "params"),
  validate(schemas.updateProject),
  catchAsync(async (req, res) => {
    const project = await WorkProject.findByPk(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    await project.update(req.body);

    // Reload with customer data
    await project.reload({
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name"],
        },
      ],
    });

    logger.info("Work project updated", {
      userId: req.user.id,
      projectId: project.id,
      projectName: project.name,
    });

    res.json({
      success: true,
      message: "Project updated successfully",
      data: { project },
    });
  })
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private
 */
router.delete(
  "/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const project = await WorkProject.findByPk(req.params.id, {
      include: [
        {
          model: TimeEntry,
          as: "timeEntries",
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if project has time entries
    if (project.timeEntries && project.timeEntries.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete project with existing time entries",
      });
    }

    await project.destroy();

    logger.info("Work project deleted", {
      userId: req.user.id,
      projectId: project.id,
      projectName: project.name,
    });

    res.json({
      success: true,
      message: "Project deleted successfully",
    });
  })
);

module.exports = router;
