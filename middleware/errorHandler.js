// middleware/errorHandler.js
const logger = require("../utils/logger");

/**
 * Custom error class for operational errors
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle Sequelize validation errors
 */
const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map((error) => ({
    field: error.path,
    message: error.message,
  }));

  const message = "Validation failed";
  return { message, errors, statusCode: 400 };
};

/**
 * Handle Sequelize unique constraint errors
 */
const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0]?.path || "field";
  const message = `${field} already exists`;
  return { message, statusCode: 400 };
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => ({
  message: "Invalid token. Please log in again!",
  statusCode: 401,
});

const handleJWTExpiredError = () => ({
  message: "Your token has expired! Please log in again.",
  statusCode: 401,
});

/**
 * Send error response in development
 */
const sendErrorDev = (err, req, res) => {
  logger.error("Development Error", {
    error: err,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      user: req.user?.email || "anonymous",
    },
    stack: err.stack,
  });

  return res.status(err.statusCode || 500).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, req, res) => {
  logger.error("Production Error", {
    message: err.message,
    statusCode: err.statusCode,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.email || "anonymous",
    stack: err.stack,
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }

  // Programming or other unknown error: don't leak error details
  return res.status(500).json({
    success: false,
    message: "Something went wrong!",
  });
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific errors
    if (err.name === "SequelizeValidationError") {
      const handledError = handleSequelizeValidationError(err);
      error = new AppError(handledError.message, handledError.statusCode);
      error.errors = handledError.errors;
    }

    if (err.name === "SequelizeUniqueConstraintError") {
      const handledError = handleSequelizeUniqueConstraintError(err);
      error = new AppError(handledError.message, handledError.statusCode);
    }

    if (err.name === "JsonWebTokenError") {
      const handledError = handleJWTError();
      error = new AppError(handledError.message, handledError.statusCode);
    }

    if (err.name === "TokenExpiredError") {
      const handledError = handleJWTExpiredError();
      error = new AppError(handledError.message, handledError.statusCode);
    }

    sendErrorProd(error, req, res);
  }
};

/**
 * Async error handler wrapper
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Handle unhandled routes
 */
const handleNotFound = (req, res, next) => {
  const err = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    404
  );
  next(err);
};

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleNotFound,
};
