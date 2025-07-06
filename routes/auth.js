// routes/auth.js
const express = require("express");
const { User, DailyLoginTracker } = require("../models");
const { authenticate } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { catchAsync } = require("../middleware/errorHandler");
const config = require("../config");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  "/register",
  validate(schemas.register),
  catchAsync(async (req, res) => {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
    });

    // Generate tokens
    const { accessToken, refreshToken } = user.generateTokens();

    // Update last login
    await user.update({ lastLogin: new Date() });

    logger.info("User registered successfully", {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
        tokens: { accessToken, refreshToken },
      },
    });
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  "/login",
  validate(schemas.login),
  catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTimeRemaining = Math.ceil(
        (user.lockUntil - Date.now()) / (1000 * 60)
      );
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${lockTimeRemaining} minutes.`,
        lockTimeRemaining,
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account has been deactivated. Contact administrator.",
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();

      const remainingAttempts =
        config.security.maxLoginAttempts - (user.loginAttempts + 1);

      logger.warn("Failed login attempt", {
        email,
        ip: req.ip,
        attempts: user.loginAttempts + 1,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        attemptsRemaining: Math.max(0, remainingAttempts),
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Generate tokens
    const { accessToken, refreshToken } = user.generateTokens();

    // Update last login
    const loginTime = new Date();
    await user.update({ lastLogin: loginTime });

    // Track first daily login
    const { isFirstLogin, tracker } = await DailyLoginTracker.trackFirstLogin(
      user.id,
      loginTime,
      req.ip || req.connection.remoteAddress,
      req.get("User-Agent"),
      req.body.location || null // Optional location from client
    );

    logger.info("User logged in successfully", {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      isFirstLoginToday: isFirstLogin,
      dailyTrackerId: tracker.id,
    });

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
        tokens: { accessToken, refreshToken },
        dailyLogin: {
          isFirstLoginToday: isFirstLogin,
          firstLoginTime: tracker.firstLoginTime,
          loginDate: tracker.loginDate,
        },
      },
    });
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  "/me",
  authenticate,
  catchAsync(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  "/logout",
  authenticate,
  catchAsync(async (req, res) => {
    logger.info("User logged out", {
      userId: req.user.id,
      email: req.user.email,
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  })
);

module.exports = router;
