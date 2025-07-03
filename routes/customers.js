// routes/customers.js
const express = require("express");
const { Customer, WorkProject } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser } = require("../middleware/rbac");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

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
          model: WorkProject,
          as: "workProjects",
          attributes: ["id", "name", "status"],
          where: { isActive: true },
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
 * @access  Private
 */
router.get(
  "/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        {
          model: WorkProject,
          as: "workProjects",
          attributes: ["id", "name", "status", "startDate", "endDate"],
          where: { isActive: true },
          required: false,
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

module.exports = router;
