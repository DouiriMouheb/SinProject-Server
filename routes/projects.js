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
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      customerId = "",
    } = req.query;
    const offset = (page - 1) * limit;

    const where = { isActive: true };

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }

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
    const processes = await Process.findAll({
      where: { isActive: true },
      include: [
        {
          model: Activity,
          as: "activities",
          where: { isActive: true },
          required: false,
          attributes: ["id", "name", "description", "estimatedMinutes"],
        },
      ],
      order: [
        ["name", "ASC"],
        [{ model: Activity, as: "activities" }, "name", "ASC"],
      ],
    });

    res.json({
      success: true,
      data: { processes },
    });
  })
);

module.exports = router;
