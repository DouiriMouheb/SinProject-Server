// routes/dailyLogin.js - Daily login tracking routes
const express = require("express");
const { DailyLoginTracker, User } = require("../models");
const { authenticate } = require("../middleware/auth");
const { requireUser, requireManager } = require("../middleware/rbac");
const { catchAsync } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUser);

/**
 * @route   GET /api/daily-login/today
 * @desc    Get today's login tracker for current user
 * @access  Private
 */
router.get(
  "/today",
  catchAsync(async (req, res) => {
    const userId = req.user.id;
    const today = new Date();

    const tracker = await DailyLoginTracker.getTodayTracker(userId, today);

    res.json({
      success: true,
      data: {
        tracker,
        hasStartedDay: !!tracker,
        canEndDay: tracker && !tracker.dayEndTime,
      },
    });
  })
);

/**
 * @route   GET /api/daily-login/user/:userId/today
 * @desc    Get today's login tracker for specific user (managers/admins only)
 * @access  Private (Manager/Admin)
 */
router.get(
  "/user/:userId/today",
  requireManager,
  catchAsync(async (req, res) => {
    const { userId } = req.params;
    const today = new Date();

    // Verify user exists
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const tracker = await DailyLoginTracker.getTodayTracker(userId, today);

    res.json({
      success: true,
      data: {
        tracker,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        hasStartedDay: !!tracker,
        canEndDay: tracker && !tracker.dayEndTime,
      },
    });
  })
);

/**
 * @route   POST /api/daily-login/end-day
 * @desc    End the current day for the user
 * @access  Private
 */
router.post(
  "/end-day",
  catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { notes, location } = req.body;
    const endTime = new Date();

    // Get today's tracker
    const tracker = await DailyLoginTracker.getTodayTracker(userId);

    if (!tracker) {
      return res.status(400).json({
        success: false,
        message:
          "No login recorded for today. Cannot end day without starting it.",
      });
    }

    if (tracker.dayEndTime) {
      return res.status(400).json({
        success: false,
        message: "Day has already been ended.",
        data: {
          endTime: tracker.dayEndTime,
          totalHours: tracker.getWorkingHoursFormatted(),
        },
      });
    }

    // Update tracker with end time
    await tracker.endDay(endTime, notes);

    // Update location if provided
    if (location) {
      tracker.location = location;
      await tracker.save();
    }

    // Reload to get calculated working hours
    await tracker.reload();

    logger.info("User ended day", {
      userId,
      trackerId: tracker.id,
      startTime: tracker.firstLoginTime,
      endTime: tracker.dayEndTime,
      totalHours: tracker.totalWorkingHours,
    });

    res.json({
      success: true,
      message: "Day ended successfully",
      data: {
        tracker,
        workingHours: tracker.getWorkingHoursFormatted(),
        totalHours: tracker.totalWorkingHours,
      },
    });
  })
);

/**
 * @route   GET /api/daily-login/history
 * @desc    Get login history for current user
 * @access  Private
 */
router.get(
  "/history",
  catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 30, startDate, endDate } = req.query;

    const offset = (page - 1) * limit;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const { count, rows: trackers } = await DailyLoginTracker.getUserDayHistory(
      userId,
      options
    );

    // Calculate summary statistics
    const completedDays = trackers.filter((t) => t.dayEndTime).length;
    const totalHours = trackers
      .filter((t) => t.totalWorkingHours)
      .reduce((sum, t) => sum + parseFloat(t.totalWorkingHours || 0), 0);
    const avgHours =
      completedDays > 0 ? (totalHours / completedDays).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        trackers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
        },
        summary: {
          totalDays: count,
          completedDays,
          totalWorkingHours: totalHours.toFixed(2),
          averageHoursPerDay: avgHours,
        },
      },
    });
  })
);

/**
 * @route   GET /api/daily-login/users/:userId/history
 * @desc    Get login history for specific user (managers/admins only)
 * @access  Private (Manager/Admin)
 */
router.get(
  "/users/:userId/history",
  requireManager,
  catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 30, startDate, endDate } = req.query;

    const offset = (page - 1) * limit;

    // Verify user exists
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeUser: true,
    };

    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const { count, rows: trackers } = await DailyLoginTracker.getUserDayHistory(
      userId,
      options
    );

    // Calculate summary statistics
    const completedDays = trackers.filter((t) => t.dayEndTime).length;
    const totalHours = trackers
      .filter((t) => t.totalWorkingHours)
      .reduce((sum, t) => sum + parseFloat(t.totalWorkingHours || 0), 0);
    const avgHours =
      completedDays > 0 ? (totalHours / completedDays).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        user,
        trackers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
        },
        summary: {
          totalDays: count,
          completedDays,
          totalWorkingHours: totalHours.toFixed(2),
          averageHoursPerDay: avgHours,
        },
      },
    });
  })
);

/**
 * @route   GET /api/daily-login/team-overview
 * @desc    Get daily login overview for all team members (managers/admins only)
 * @access  Private (Manager/Admin)
 */
router.get(
  "/team-overview",
  requireManager,
  catchAsync(async (req, res) => {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const loginDate = targetDate.toISOString().split("T")[0];

    // Get all users with their today's tracker (if any)
    const users = await User.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "email", "role"],
      include: [
        {
          model: DailyLoginTracker,
          as: "dailyLoginTrackers",
          where: { loginDate },
          required: false, // LEFT JOIN to include users without login today
          attributes: [
            "id",
            "loginDate",
            "firstLoginTime",
            "dayEndTime",
            "totalWorkingHours",
            "location",
          ],
        },
      ],
    });

    // Format the response
    const teamOverview = users.map((user) => {
      const todayTracker = user.dailyLoginTrackers[0] || null;
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        todayStatus: {
          hasStartedDay: !!todayTracker,
          hasEndedDay: todayTracker?.dayEndTime ? true : false,
          firstLoginTime: todayTracker?.firstLoginTime || null,
          dayEndTime: todayTracker?.dayEndTime || null,
          workingHours: todayTracker?.totalWorkingHours || null,
          location: todayTracker?.location || null,
        },
      };
    });

    // Calculate summary
    const totalUsers = teamOverview.length;
    const usersStarted = teamOverview.filter(
      (u) => u.todayStatus.hasStartedDay
    ).length;
    const usersEnded = teamOverview.filter(
      (u) => u.todayStatus.hasEndedDay
    ).length;
    const usersActive = usersStarted - usersEnded;

    res.json({
      success: true,
      data: {
        date: loginDate,
        teamOverview,
        summary: {
          totalUsers,
          usersStartedToday: usersStarted,
          usersEndedToday: usersEnded,
          usersCurrentlyActive: usersActive,
        },
      },
    });
  })
);

/**
 * @route   PUT /api/daily-login/tracker/:trackerId
 * @desc    Update a specific tracker (notes, location, etc.)
 * @access  Private
 */
router.put(
  "/tracker/:trackerId",
  catchAsync(async (req, res) => {
    const { trackerId } = req.params;
    const { notes, location } = req.body;
    const userId = req.user.id;

    const tracker = await DailyLoginTracker.findOne({
      where: {
        id: trackerId,
        userId, // Ensure user can only update their own trackers
      },
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: "Tracker not found or you don't have permission to update it",
      });
    }

    // Update allowed fields
    const updates = {};
    if (notes !== undefined) updates.notes = notes;
    if (location !== undefined) updates.location = location;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    await tracker.update(updates);
    await tracker.reload();

    logger.info("Daily tracker updated", {
      userId,
      trackerId: tracker.id,
      updates,
    });

    res.json({
      success: true,
      message: "Tracker updated successfully",
      data: { tracker },
    });
  })
);

module.exports = router;
