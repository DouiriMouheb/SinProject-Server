// routes/customers.js
const express = require("express");
const { Op } = require("sequelize");
const { Customer, Organization, Project } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser } = require("../middleware/rbac");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser); // Changed to user access

/**
 * @route   GET /api/customers
 * @desc    Get all customers
 * @access  Private
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search = "", isActive = "true" } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }
    if (isActive !== "all") {
      where.isActive = isActive === "true";
    }

    const { count, rows: customers } = await Customer.findAndCountAll({
      where,
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name"],
        },
        {
          model: Project,
          as: "workProjects",
          attributes: ["id", "name", "status", "startDate", "endDate"],
          required: false, // Left join, so customers without projects are still included
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalCustomers: count,
        },
      },
    });
  })
);

/**
 * @route   POST /api/customers
 * @desc    Create new customer
 * @access  Private
 */
router.post(
  "/",
  validate(schemas.createCustomer),
  catchAsync(async (req, res) => {
    const customer = await Customer.create(req.body);

    logger.info("Customer created", {
      userId: req.user.id,
      customerId: customer.id,
      customerName: customer.name,
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: { customer },
    });
  })
);

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Private (Admin)
 */
router.get(
  "/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name"],
        },
        {
          model: Project,
          as: "workProjects",
          attributes: [
            "id",
            "name",
            "description",
            "status",
            "startDate",
            "endDate",
            "isActive",
          ],
          order: [["name", "ASC"]],
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      data: { customer },
    });
  })
);

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  validate(schemas.uuidParam, "params"),
  validate(schemas.createCustomer),
  catchAsync(async (req, res) => {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    await customer.update(req.body);

    logger.info("Customer updated", {
      userId: req.user.id,
      customerId: customer.id,
      customerName: customer.name,
    });

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: { customer },
    });
  })
);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete customer
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check if customer has active time entries
    const activeTimeEntries = await customer.countTimeEntries();
    if (activeTimeEntries > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete customer with existing time entries. Please remove time entries first.",
      });
    }

    await customer.destroy();

    logger.info("Customer deleted", {
      userId: req.user.id,
      customerId: customer.id,
      customerName: customer.name,
    });

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  })
);

module.exports = router;
