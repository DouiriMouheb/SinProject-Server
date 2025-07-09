// models/DailyLoginTracker.js
module.exports = (sequelize, DataTypes) => {
  const DailyLoginTracker = sequelize.define(
    "DailyLoginTracker",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        field: "user_id", // Map to snake_case column in DB
      },
      loginDate: {
        type: DataTypes.DATEONLY, // Only stores date without time
        allowNull: false,
        comment: "The date of the first login (YYYY-MM-DD format)",
        field: "login_date", // Map to snake_case column in DB
      },
      firstLoginTime: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "Timestamp of the first login for this date",
        field: "first_login_time", // Map to snake_case column in DB
      },
      dayEndTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Timestamp when user ended their day (optional)",
        field: "day_end_time", // Map to snake_case column in DB
      },
      ipAddress: {
        type: DataTypes.STRING(45), // IPv6 max length
        allowNull: true,
        comment: "IP address of the first login",
        field: "ip_address", // Map to snake_case column in DB
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "User agent string from the first login",
        field: "user_agent", // Map to snake_case column in DB
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: "Optional location info (office, remote, etc.)",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Optional notes about the day",
      },
      totalWorkingHours: {
        type: DataTypes.DECIMAL(5, 2), // Max 999.99 hours
        allowNull: true,
        comment: "Calculated working hours if day end time is set",
        field: "total_working_hours", // Map to snake_case column in DB
      },
    },
    {
      tableName: "daily_login_trackers",
      indexes: [
        {
          unique: true,
          fields: ["user_id", "login_date"],
          name: "unique_user_date",
        },
        {
          fields: ["login_date"],
          name: "idx_login_date",
        },
        {
          fields: ["user_id"],
          name: "idx_user_id",
        },
        {
          fields: ["first_login_time"],
          name: "idx_first_login_time",
        },
      ],
      hooks: {
        beforeSave: (tracker) => {
          // Auto-calculate working hours if both start and end times are set
          if (tracker.firstLoginTime && tracker.dayEndTime) {
            const diffMs =
              new Date(tracker.dayEndTime) - new Date(tracker.firstLoginTime);
            const diffHours = diffMs / (1000 * 60 * 60);
            tracker.totalWorkingHours = Math.max(0, diffHours.toFixed(2));
          } else {
            tracker.totalWorkingHours = null;
          }
        },
      },
    }
  );

  // Associations
  DailyLoginTracker.associate = (models) => {
    DailyLoginTracker.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
    });
  };

  // Instance methods
  DailyLoginTracker.prototype.endDay = async function (
    endTime = new Date(),
    notes = null
  ) {
    this.dayEndTime = endTime;
    if (notes) {
      this.notes = notes;
    }
    return await this.save();
  };

  DailyLoginTracker.prototype.getWorkingHoursFormatted = function () {
    if (!this.totalWorkingHours) return "N/A";
    const hours = Math.floor(this.totalWorkingHours);
    const minutes = Math.round((this.totalWorkingHours - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  // Static methods
  DailyLoginTracker.trackFirstLogin = async function (
    userId,
    loginTime,
    ipAddress,
    userAgent,
    location = null
  ) {
    const loginDate = new Date(loginTime).toISOString().split("T")[0]; // YYYY-MM-DD format

    // Check if there's already a record for this user and date
    const existingTracker = await this.findOne({
      where: {
        userId,
        loginDate,
      },
    });

    if (existingTracker) {
      // Already tracked for today, return existing record
      return {
        isFirstLogin: false,
        tracker: existingTracker,
      };
    }

    // Create new tracker for first login of the day
    const tracker = await this.create({
      userId,
      loginDate,
      firstLoginTime: loginTime,
      ipAddress,
      userAgent,
      location,
    });

    return {
      isFirstLogin: true,
      tracker,
    };
  };

  DailyLoginTracker.getUserDayHistory = async function (userId, options = {}) {
    const {
      startDate,
      endDate,
      limit = 30,
      offset = 0,
      includeUser = false,
    } = options;

    const where = { userId };
    if (startDate && endDate) {
      where.loginDate = {
        [sequelize.Op.between]: [startDate, endDate],
      };
    } else if (startDate) {
      where.loginDate = {
        [sequelize.Op.gte]: startDate,
      };
    } else if (endDate) {
      where.loginDate = {
        [sequelize.Op.lte]: endDate,
      };
    }

    const include = [];
    if (includeUser) {
      include.push({
        model: sequelize.models.User,
        as: "user",
        attributes: ["id", "name", "email"],
      });
    }

    return await this.findAndCountAll({
      where,
      include,
      order: [["loginDate", "DESC"]],
      limit,
      offset,
    });
  };

  DailyLoginTracker.getTodayTracker = async function (
    userId,
    date = new Date()
  ) {
    const loginDate = date.toISOString().split("T")[0];
    return await this.findOne({
      where: {
        userId,
        loginDate,
      },
    });
  };

  return DailyLoginTracker;
};
