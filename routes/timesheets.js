// routes/timesheets.js - Clean timesheet entry management
const express = require("express");
const {
  TimeEntry,
  Organization,
  Customer,
  Process,
  Activity,
  User,
  UserOrganization,
} = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser } = require("../middleware/rbac");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

/**
 * @route   POST /api/timesheets/entries
 * @desc    Create a new timesheet entry
 * @access  Private
 */
router.post(
  "/entries",
  catchAsync(async (req, res) => {
    const {
      organizationId,
      customerId,
      processId,
      activityId,
      workLocationType,
      workLocationAddress,
      taskName,
      description,
      date,
      startTime,
      endTime,
      notes,
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (
      !organizationId ||
      !customerId ||
      !processId ||
      !activityId ||
      !workLocationtype ||
      !taskName ||
      !date ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All required fields must be provided: organizationId, customerId, processId, activityId, workLocationtype, taskName, date, startTime, endTime",
      });
    }

    // Check if user has access to the organization
    const userOrg = await UserOrganization.findOne({
      where: { userId, organizationId },
    });

    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this organization",
      });
    }

    // Verify all entities exist and are related correctly
    const [organization, customer, process, activity] = await Promise.all([
      Organization.findByPk(organizationId),
      Customer.findOne({ where: { id: customerId, organizationId } }),
      Process.findByPk(processId),
      Activity.findOne({ where: { id: activityId, processId } }),
    ]);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or doesn't belong to the organization",
      });
    }

    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found or doesn't belong to the process",
      });
    }

    // Parse date and time
    const entryDate = new Date(date);
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    // Validate times
    if (endDateTime <= startDateTime) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    // Calculate duration in minutes
    const durationMs = endDateTime - startDateTime;
    const duration = Math.round(durationMs / (1000 * 60));

    // Determine work location address based on type
    let finalWorkLocationAddress = workLocationAddress;
    if (!finalWorkLocationAddress) {
      switch (workLocationtype) {
        case "organization":
          finalWorkLocationAddress =
            organization.address || organization.workLocation;
          break;
        case "customer":
          finalWorkLocationAddress = customer.address || customer.workLocation;
          break;
        case "home":
          const user = await User.findByPk(userId);
          finalWorkLocationAddress = user.homeAddress;
          break;
      }
    }

    // Create timesheet entry
    const timeEntry = await TimeEntry.create({
      userId,
      organizationId,
      customerId,
      processId,
      activityId,
      workPlaceType: workLocationtype,
      workPlaceAddress: finalWorkLocationAddress,
      taskName,
      description,
      date: entryDate,
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      notes,
      isManual: true,
    });

    // Fetch the complete time entry with associations for response
    const completeTimeEntry = await TimeEntry.findByPk(timeEntry.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "address", "workLocation"],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "address", "workLocation"],
        },
        {
          model: Process,
          as: "process",
          attributes: ["id", "name", "description"],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    logger.info(
      `Timesheet entry created by user ${userId} for ${activity.name}`,
      {
        userId,
        organizationId,
        customerId,
        processId,
        activityId,
        duration,
      }
    );

    res.status(201).json({
      success: true,
      message: "Timesheet entry created successfully",
      data: { timeEntry: completeTimeEntry },
    });
  })
);

/**
 * @route   GET /api/timesheets/entries
 * @desc    Get user's timesheet entries
 * @access  Private
 */
router.get(
  "/entries",
  catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      organizationId,
      customerId,
      processId,
    } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    const where = { userId };

    // Date filtering
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.date[Op.lte] = new Date(endDate);
      }
    }

    // Additional filtering
    if (organizationId) where.organizationId = organizationId;
    if (customerId) where.customerId = customerId;
    if (processId) where.processId = processId;

    const { count, rows: entries } = await TimeEntry.findAndCountAll({
      where,
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name"],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name"],
        },
        {
          model: Process,
          as: "process",
          attributes: ["id", "name"],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["id", "name"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        ["date", "DESC"],
        ["startTime", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: {
        timeEntries: entries,
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
 * @route   GET /api/timesheets/entries/:id
 * @desc    Get a specific timesheet entry
 * @access  Private
 */
router.get(
  "/entries/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const timeEntry = await TimeEntry.findOne({
      where: { id, userId },
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "address", "workLocation"],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "address", "workLocation"],
        },
        {
          model: Process,
          as: "process",
          attributes: ["id", "name", "description"],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message: "Timesheet entry not found",
      });
    }

    res.json({
      success: true,
      data: { timeEntry },
    });
  })
);

/**
 * @route   PUT /api/timesheets/entries/:id
 * @desc    Update a timesheet entry
 * @access  Private
 */
router.put(
  "/entries/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const {
      taskName,
      description,
      date,
      startTime,
      endTime,
      notes,
      workLocationtype,
      workLocationAddress,
    } = req.body;
    const userId = req.user.id;

    // Find the time entry
    const timeEntry = await TimeEntry.findOne({
      where: { id, userId },
    });

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message:
          "Timesheet entry not found or you don't have permission to update it",
      });
    }

    const updates = {};

    // Basic field updates
    if (taskName) updates.taskName = taskName;
    if (description !== undefined) updates.description = description;
    if (notes !== undefined) updates.notes = notes;
    if (workLocationtype) updates.workPlaceType = workLocationtype;
    if (workLocationAddress !== undefined)
      updates.workPlaceAddress = workLocationAddress;

    // Handle date and time updates
    if (date && startTime && endTime) {
      const entryDate = new Date(date);
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);

      // Validate times
      if (endDateTime <= startDateTime) {
        return res.status(400).json({
          success: false,
          message: "End time must be after start time",
        });
      }

      // Calculate duration in minutes
      const durationMs = endDateTime - startDateTime;
      const duration = Math.round(durationMs / (1000 * 60));

      updates.date = entryDate;
      updates.startTime = startDateTime;
      updates.endTime = endDateTime;
      updates.duration = duration;
    }

    // Update the time entry
    await timeEntry.update(updates);

    // Fetch updated entry with associations
    const updatedEntry = await TimeEntry.findByPk(timeEntry.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "address", "workLocation"],
        },
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "address", "workLocation"],
        },
        {
          model: Process,
          as: "process",
          attributes: ["id", "name", "description"],
        },
        {
          model: Activity,
          as: "activity",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    logger.info(`Timesheet entry ${id} updated by user ${userId}`);

    res.json({
      success: true,
      message: "Timesheet entry updated successfully",
      data: { timeEntry: updatedEntry },
    });
  })
);

/**
 * @route   DELETE /api/timesheets/entries/:id
 * @desc    Delete a timesheet entry
 * @access  Private
 */
router.delete(
  "/entries/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the time entry
    const timeEntry = await TimeEntry.findOne({
      where: { id, userId },
    });

    if (!timeEntry) {
      return res.status(404).json({
        success: false,
        message:
          "Timesheet entry not found or you don't have permission to delete it",
      });
    }

    // Delete the time entry
    await timeEntry.destroy();

    logger.info(`Timesheet entry ${id} deleted by user ${userId}`);

    res.json({
      success: true,
      message: "Timesheet entry deleted successfully",
    });
  })
);

/**
 * @route   GET /api/timesheets/work-locations
 * @desc    Get available work locations for a timesheet entry
 * @access  Private
 */
router.get(
  "/work-locations",
  catchAsync(async (req, res) => {
    const { organizationId, customerId } = req.query;
    const userId = req.user.id;

    const workLocations = [];

    // Get user's home address
    const user = await User.findByPk(userId, {
      attributes: ["homeAddress"],
    });

    if (user.homeAddress) {
      workLocations.push({
        type: "home",
        address: user.homeAddress,
        label: "Home",
        value: "home",
      });
    }

    // Get organization work location if organizationId is provided
    if (organizationId) {
      const organization = await Organization.findByPk(organizationId);
      if (organization && (organization.address || organization.workLocation)) {
        workLocations.push({
          type: "organization",
          address: organization.address || organization.workLocation,
          label: `${organization.name} Office`,
          value: "organization",
        });
      }
    }

    // Get customer work location if customerId is provided
    if (customerId) {
      const customer = await Customer.findByPk(customerId);
      if (customer && (customer.address || customer.workLocation)) {
        workLocations.push({
          type: "customer",
          address: customer.address || customer.workLocation,
          label: `${customer.name} Location`,
          value: "customer",
        });
      }
    }

    res.json({
      success: true,
      data: { workLocations },
    });
  })
);

module.exports = router;
