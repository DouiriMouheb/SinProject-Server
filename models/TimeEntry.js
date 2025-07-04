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
      },
      workProjectId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "work_projects",
          key: "id",
        },
      },
      activityId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "activities",
          key: "id",
        },
      },
      taskName: {
        type: DataTypes.STRING(300),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 300],
        },
      },
      description: {
        type: DataTypes.TEXT,
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
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
      },
      isManual: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
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

    TimeEntry.belongsTo(models.WorkProject, {
      foreignKey: "workProjectId",
      as: "workProject",
    });

    TimeEntry.belongsTo(models.Activity, {
      foreignKey: "activityId",
      as: "activity",
    });
  };

  return TimeEntry;
};
