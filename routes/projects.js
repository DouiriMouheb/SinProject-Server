// routes/projects.js - Project management routes
const express = require("express");
const { Project, Customer, User, TimeEntry } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireAdmin, requireUser } = require("../middleware/rbac");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

/**
 * @route   GET /api/projects
 * @desc    Get all projects (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { customerId, status, isActive } = req.query;

    const where = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "organizationId"],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: { projects },
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
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: [
            "id",
            "name",
            "organizationId",
            "contactEmail",
            "contactPhone",
          ],
        },
        {
          model: TimeEntry,
          as: "timeEntries",
          attributes: ["id", "date", "duration", "taskName"],
          limit: 10,
          order: [["date", "DESC"]],
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
 * @route   GET /api/projects/customer/:customerId
 * @desc    Get projects for a specific customer
 * @access  Private
 */
router.get(
  "/customer/:customerId",
  catchAsync(async (req, res) => {
    const { customerId } = req.params;
    const { status, isActive } = req.query;

    // Verify customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const where = { customerId };
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name"],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: { projects },
    });
  })
);

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private (Admin)
 */
router.post(
  "/",
  requireAdmin,
  catchAsync(async (req, res) => {
    const {
      name,
      description,
      customerId,
      startDate,
      endDate,
      budget,
      status = "planning",
    } = req.body;

    // Validate required fields
    if (!name || !customerId) {
      return res.status(400).json({
        success: false,
        message: "Project name and customer ID are required",
      });
    }

    // Verify customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Validate dates if provided
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    const project = await Project.create({
      name,
      description,
      customerId,
      startDate,
      endDate,
      budget,
      status,
    });

    // Fetch complete project with associations
    const completeProject = await Project.findByPk(project.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "organizationId"],
        },
      ],
    });

    logger.info(`Project created: ${project.name}`, {
      adminUserId: req.user.id,
      projectId: project.id,
      customerId,
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: { project: completeProject },
    });
  })
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, description, startDate, endDate, budget, status, isActive } =
      req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Validate dates if provided
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (budget !== undefined) updates.budget = budget;
    if (status !== undefined) updates.status = status;
    if (isActive !== undefined) updates.isActive = isActive;

    await project.update(updates);

    // Fetch updated project with associations
    const updatedProject = await Project.findByPk(id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "organizationId"],
        },
      ],
    });

    logger.info(`Project updated: ${project.name}`, {
      adminUserId: req.user.id,
      projectId: id,
      updatedFields: Object.keys(updates),
    });

    res.json({
      success: true,
      message: "Project updated successfully",
      data: { project: updatedProject },
    });
  })
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [{ model: TimeEntry, as: "timeEntries" }],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if project has associated time entries
    if (project.timeEntries && project.timeEntries.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete project with existing time entries. Please remove or reassign time entries first.",
      });
    }

    await project.destroy();

    logger.info(`Project deleted: ${project.name}`, {
      adminUserId: req.user.id,
      projectId: id,
    });

    res.json({
      success: true,
      message: "Project deleted successfully",
    });
  })
);

/**
 * @route   GET /api/projects/:id/time-entries
 * @desc    Get time entries for a specific project
 * @access  Private
 */
router.get(
  "/:id/time-entries",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const where = { projectId: id };

    // Date filtering
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate);
      if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: timeEntries } = await TimeEntry.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [
        ["date", "DESC"],
        ["startTime", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: {
        timeEntries,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  })
);

/**
 * @route   GET /api/projects/:id/stats
 * @desc    Get project statistics
 * @access  Private
 */
router.get(
  "/:id/stats",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Get time entry statistics
    const timeEntries = await TimeEntry.findAll({
      where: { projectId: id },
      attributes: ["duration", "date", "userId"],
    });

    const totalHours =
      timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0) / 60; // Convert minutes to hours
    const uniqueUsers = new Set(timeEntries.map((entry) => entry.userId)).size;
    const totalEntries = timeEntries.length;

    // Calculate date range
    const dates = timeEntries.map((entry) => new Date(entry.date)).sort();
    const firstEntry = dates.length > 0 ? dates[0] : null;
    const lastEntry = dates.length > 0 ? dates[dates.length - 1] : null;

    res.json({
      success: true,
      data: {
        stats: {
          totalHours: Math.round(totalHours * 100) / 100,
          totalEntries,
          uniqueUsers,
          firstEntry,
          lastEntry,
          budget: project.budget,
          status: project.status,
        },
      },
    });
  })
);

module.exports = router;
