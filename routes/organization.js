// routes/organization.js - Clean organization management routes
const express = require("express");
const { Organization, Customer, UserOrganization, User } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser, requireAdmin } = require("../middleware/rbac");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

/**
 * @route   GET /api/organizations
 * @desc    Get all organizations for the current user
 * @access  Private
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    // Debug: Check if user exists and has organizations
    const userOrganizations = await UserOrganization.findAll({
      where: { userId },
      include: [
        {
          model: Organization,
          as: "organization",
        },
      ],
    });

    console.log(
      `User ${userId} has ${userOrganizations.length} organization associations`
    );

    // If no user-organization associations, return all organizations (for debugging)
    if (userOrganizations.length === 0) {
      const allOrganizations = await Organization.findAll({
        include: [
          {
            model: Customer,
            as: "clients",
            attributes: ["id", "name", "address", "workLocation"],
          },
        ],
        order: [["name", "ASC"]],
      });

      console.log(
        `Found ${allOrganizations.length} total organizations in database`
      );

      return res.json({
        success: true,
        data: {
          organizations: allOrganizations,
          debug: {
            message:
              "No user-organization associations found, returning all organizations",
            userOrganizationCount: userOrganizations.length,
            totalOrganizations: allOrganizations.length,
          },
        },
      });
    }

    // Original query for users with proper associations
    const organizations = await Organization.findAll({
      include: [
        {
          model: User,
          as: "users",
          where: { id: userId },
          through: { attributes: [] }, // Don't include junction table data
          attributes: [], // Don't include user data in response
        },
        {
          model: Customer,
          as: "clients",
          attributes: ["id", "name", "address", "workLocation"],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: { organizations },
    });
  })
);

/**
 * @route   GET /api/organizations/all
 * @desc    Get all organizations for the current user (alternative endpoint)
 * @access  Private
 */
router.get(
  "/all",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    const organizations = await Organization.findAll({
      include: [
        {
          model: User,
          as: "users",
          where: { id: userId },
          through: { attributes: [] }, // Don't include junction table data
          attributes: [], // Don't include user data in response
        },
        {
          model: Customer,
          as: "clients",
          attributes: ["id", "name", "address", "workLocation"],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: { organizations },
    });
  })
);

/**
 * @route   GET /api/organizations/:id
 * @desc    Get a specific organization with its customers
 * @access  Private
 */
router.get(
  "/:id",
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const organization = await Organization.findByPk(id, {
      include: [
        {
          model: Customer,
          as: "clients",
          attributes: [
            "id",
            "name",
            "address",
            "workLocation",
            "contactEmail",
            "contactPhone",
          ],
        },
      ],
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    res.json({
      success: true,
      data: { organization },
    });
  })
);

/**
 * @route   GET /api/organizations/:id/customers
 * @desc    Get all customers for a specific organization
 * @access  Private
 */
router.get(
  "/:id/customers",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const customers = await Customer.findAll({
      where: { organization_id: id },
      attributes: [
        "id",
        "name",
        "address",
        "workLocation",
        "contactEmail",
        "contactPhone",
      ],
      order: [["name", "ASC"]],
    });

    res.json({
      success: true,
      data: { customers },
    });
  })
);

/**
 * @route   POST /api/organizations
 * @desc    Create a new organization (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/",
  requireAdmin,
  validate(schemas.createOrganization),
  catchAsync(async (req, res) => {
    const { name, workLocation, address } = req.body;

    const organization = await Organization.create({
      name,
      workLocation,
      address,
    });

    logger.info("Organization created", {
      userId: req.user.id,
      organizationId: organization.id,
      organizationName: organization.name,
    });

    res.status(201).json({
      success: true,
      data: { organization },
      message: "Organization created successfully",
    });
  })
);

/**
 * @route   PUT /api/organizations/:id
 * @desc    Update an organization (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  requireAdmin,
  validate(schemas.uuidParam, "params"),
  validate(schemas.updateOrganization),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, workLocation, address } = req.body;

    const organization = await Organization.findByPk(id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    await organization.update({
      name: name || organization.name,
      workLocation:
        workLocation !== undefined ? workLocation : organization.workLocation,
      address: address !== undefined ? address : organization.address,
    });

    logger.info("Organization updated", {
      userId: req.user.id,
      organizationId: organization.id,
      organizationName: organization.name,
    });

    res.json({
      success: true,
      data: { organization },
      message: "Organization updated successfully",
    });
  })
);

/**
 * @route   DELETE /api/organizations/:id
 * @desc    Delete an organization (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  requireAdmin,
  validate(schemas.uuidParam, "params"),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const organization = await Organization.findByPk(id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if organization has customers
    const customerCount = await Customer.count({
      where: { organization_id: id },
    });

    if (customerCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete organization with existing customers. Please remove all customers first.",
      });
    }

    // Remove all user-organization associations
    await UserOrganization.destroy({
      where: { organizationId: id },
    });

    await organization.destroy();

    logger.info("Organization deleted", {
      userId: req.user.id,
      organizationId: id,
      organizationName: organization.name,
    });

    res.json({
      success: true,
      message: "Organization deleted successfully",
    });
  })
);

/**
 * @route   POST /api/organizations/:id/users
 * @desc    Add a user to an organization (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/:id/users",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Check if organization exists
    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if relationship already exists
    const existingRelation = await UserOrganization.findOne({
      where: { userId, organizationId: id },
    });

    if (existingRelation) {
      return res.status(400).json({
        success: false,
        message: "User is already assigned to this organization",
      });
    }

    // Create the relationship
    await UserOrganization.create({
      userId,
      organizationId: id,
    });

    logger.info(`User added to organization`, {
      adminUserId: req.user.id,
      userId,
      organizationId: id,
    });

    res.status(201).json({
      success: true,
      message: "User added to organization successfully",
    });
  })
);

/**
 * @route   DELETE /api/organizations/:id/users/:userId
 * @desc    Remove a user from an organization (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/:id/users/:userId",
  requireAdmin,
  catchAsync(async (req, res) => {
    const { id, userId } = req.params;

    const userOrg = await UserOrganization.findOne({
      where: { userId, organizationId: id },
    });

    if (!userOrg) {
      return res.status(404).json({
        success: false,
        message: "User is not assigned to this organization",
      });
    }

    await userOrg.destroy();

    logger.info(`User removed from organization`, {
      adminUserId: req.user.id,
      userId,
      organizationId: id,
    });

    res.json({
      success: true,
      message: "User removed from organization successfully",
    });
  })
);

module.exports = router;
