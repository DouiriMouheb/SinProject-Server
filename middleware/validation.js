// middleware/validation.js - UPDATED with manual time entry schema
const Joi = require("joi");
const logger = require("../utils/logger");

// Common validation patterns
const patterns = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  password:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
};

// Common field validations
const commonFields = {
  uuid: Joi.string().pattern(patterns.uuid).messages({
    "string.pattern.base": "Invalid ID format",
  }),

  email: Joi.string().email().lowercase().trim().messages({
    "string.email": "Please provide a valid email address",
  }),

  password: Joi.string().min(8).pattern(patterns.password).messages({
    "string.min": "Password must be at least 8 characters long",
    "string.pattern.base":
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  }),

  name: Joi.string().trim().min(2).max(100).messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 100 characters",
  }),

  role: Joi.string().valid("user", "admin").messages({
    "any.only": "Role must be user or admin",
  }),
};

// Validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    name: commonFields.name.required(),
    email: commonFields.email.required(),
    password: commonFields.password.required(),
    role: commonFields.role.default("user"),
  }),

  login: Joi.object({
    email: commonFields.email.required(),
    password: Joi.string().required(),
  }),

  // User schemas
  updateUser: Joi.object({
    name: commonFields.name,
    email: commonFields.email,
    role: commonFields.role,
    isActive: Joi.boolean(),
  }).min(1),

  // Time entry schemas
  createTimeEntry: Joi.object({
    workProjectId: commonFields.uuid.required(),
    activityId: commonFields.uuid.required(),
    taskName: Joi.string().trim().min(2).max(300).required(),
    description: Joi.string().trim().max(1000),
  }),

  // NEW: Manual time entry schema
  createManualTimeEntry: Joi.object({
    workProjectId: commonFields.uuid.required(),
    activityId: commonFields.uuid.required(),
    taskName: Joi.string().trim().min(2).max(300).required(),
    description: Joi.string().trim().max(1000),
    startTime: Joi.date().required().messages({
      "date.base": "Start time must be a valid date",
      "any.required": "Start time is required",
    }),
    endTime: Joi.date().required().greater(Joi.ref("startTime")).messages({
      "date.base": "End time must be a valid date",
      "any.required": "End time is required",
      "date.greater": "End time must be after start time",
    }),
    isManual: Joi.boolean().default(true),
  }),

  updateTimeEntry: Joi.object({
    taskName: Joi.string().trim().min(2).max(300),
    description: Joi.string().trim().max(1000),
    startTime: Joi.date(),
    endTime: Joi.date(),
  })
    .min(1)
    .custom((value, helpers) => {
      // Validate that endTime is after startTime if both are provided
      if (
        value.startTime &&
        value.endTime &&
        new Date(value.endTime) <= new Date(value.startTime)
      ) {
        return helpers.message("End time must be after start time");
      }
      return value;
    }),

  // Customer schemas
  createCustomer: Joi.object({
    name: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(1000),
    contactEmail: commonFields.email,
    contactPhone: Joi.string().trim().max(50),
    address: Joi.string().trim().max(500),
  }),

  // Project schemas
  createProject: Joi.object({
    customerId: commonFields.uuid.required(),
    name: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(1000),

    startDate: Joi.date(),
    endDate: Joi.date().greater(Joi.ref("startDate")).messages({
      "date.greater": "End date must be after start date",
    }),
    budget: Joi.number().min(0),
  }),

  updateProject: Joi.object({
    name: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(1000),

    startDate: Joi.date(),
    endDate: Joi.date().greater(Joi.ref("startDate")).messages({
      "date.greater": "End date must be after start date",
    }),
    budget: Joi.number().min(0),
  }),

  // UUID param validation
  uuidParam: Joi.object({
    id: commonFields.uuid.required(),
  }),

  // Process ID param validation
  processIdParam: Joi.object({
    processId: commonFields.uuid.required(),
  }),

  // User ID param validation
  userIdParam: Joi.object({
    userId: commonFields.uuid.required(),
  }),
  // Process schemas
  createProcess: Joi.object({
    name: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(1000),
    category: Joi.string().trim().max(100),
    isActive: Joi.boolean().default(true),
  }),

  updateProcess: Joi.object({
    name: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(1000),
    category: Joi.string().trim().max(100),
    isActive: Joi.boolean(),
  }).min(1),

  // Activity schemas
  createActivity: Joi.object({
    name: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(1000),
    estimatedMinutes: Joi.number().min(0),
    isActive: Joi.boolean().default(true),
  }),

  updateActivity: Joi.object({
    name: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(1000),
    estimatedMinutes: Joi.number().min(0),
    isActive: Joi.boolean(),
  }).min(1),
};

/**
 * Validation middleware factory
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    try {
      let dataToValidate;

      switch (source) {
        case "body":
          dataToValidate = req.body;
          break;
        case "query":
          dataToValidate = req.query;
          break;
        case "params":
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
      });

      if (error) {
        const errorMessages = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        }));

        logger.warn("Validation error", {
          endpoint: `${req.method} ${req.path}`,
          errors: errorMessages,
          user: req.user?.email || "anonymous",
        });

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errorMessages,
        });
      }

      // Replace the original data with validated and sanitized data
      switch (source) {
        case "body":
          req.body = value;
          break;
        case "query":
          req.query = value;
          break;
        case "params":
          req.params = value;
          break;
      }

      next();
    } catch (error) {
      logger.error("Validation middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during validation",
      });
    }
  };
};

module.exports = {
  schemas,
  validate,
  patterns,
  commonFields,
};
