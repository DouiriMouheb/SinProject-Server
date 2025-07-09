// models/TimeEntry.js
module.exports = (sequelize, DataTypes) => {
  const TimeEntry = sequelize.define(
    "TimeEntry",
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
        field: "user_id",
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        field: "organization_id",
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: true, // Made nullable to allow existing data
        references: {
          model: "customers",
          key: "id",
        },
        field: "customer_id",
      },
      processId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "processes",
          key: "id",
        },
        field: "process_id",
      },
      activityId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "activities",
          key: "id",
        },
        field: "activity_id",
      },
      projectId: {
        type: DataTypes.UUID,
        allowNull: true, // Projects are optional
        references: {
          model: "projects",
          key: "id",
        },
        field: "project_id",
      },
      workPlaceType: {
        type: DataTypes.ENUM("organization", "customer", "home"),
        allowNull: false,
        field: "work_location_type",
      },
      workPlaceAddress: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "work_location_address",
      },
      taskName: {
        type: DataTypes.STRING(300),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 300],
        },
        field: "task_name",
      },
      description: {
        type: DataTypes.TEXT,
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "start_time",
      },
      endTime: {
        type: DataTypes.DATE,
        validate: {
          isAfterStart(value) {
            if (value && this.startTime && value <= this.startTime) {
              throw new Error("End time must be after start time");
            }
          },
        },
        field: "end_time",
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Duration in minutes",
      },
      notes: {
        type: DataTypes.TEXT,
      },
      isManual: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_manual",
      },
      breaks: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
    },
    {
      tableName: "time_entries",
    }
  );

  // Instance methods
  TimeEntry.prototype.complete = function (description) {
    const now = new Date();
    this.endTime = now;

    if (description) {
      this.description = description;
    }

    return this.save();
  };

  TimeEntry.prototype.addBreak = function (reason = "Break") {
    const breaks = this.breaks || [];
    breaks.push({
      startTime: new Date(),
      reason,
    });
    this.breaks = breaks;
    return this.save();
  };

  TimeEntry.prototype.endBreak = function () {
    const breaks = this.breaks || [];
    const lastBreak = breaks[breaks.length - 1];
    if (lastBreak && !lastBreak.endTime) {
      lastBreak.endTime = new Date();
      this.breaks = breaks;
    }
    return this.save();
  };

  // Associations
  TimeEntry.associate = function (models) {
    TimeEntry.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    TimeEntry.belongsTo(models.Organization, {
      foreignKey: "organizationId",
      as: "organization",
    });

    TimeEntry.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer",
    });

    TimeEntry.belongsTo(models.Process, {
      foreignKey: "processId",
      as: "process",
    });

    TimeEntry.belongsTo(models.Activity, {
      foreignKey: "activityId",
      as: "activity",
    });

    TimeEntry.belongsTo(models.Project, {
      foreignKey: "projectId",
      as: "workProject", // Match client-side expectation
    });
  };

  return TimeEntry;
};
