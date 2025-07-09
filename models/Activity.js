// models/Activity.js
module.exports = (sequelize, DataTypes) => {
  const Activity = sequelize.define(
    "Activity",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      processId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "process_id",
        references: {
          model: "processes",
          key: "id",
        },
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 200],
        },
      },
      description: {
        type: DataTypes.TEXT,
      },
    },
    {
      tableName: "activities",
    }
  );

  // Associations
  Activity.associate = function (models) {
    Activity.belongsTo(models.Process, {
      foreignKey: "process_id",
      targetKey: "id",
      as: "process",
    });

    Activity.hasMany(models.TimeEntry, {
      foreignKey: "activityId",
      as: "timeEntries",
    });
  };

  return Activity;
};
