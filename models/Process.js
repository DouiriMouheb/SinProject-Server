// models/Process.js
module.exports = (sequelize, DataTypes) => {
  const Process = sequelize.define(
    "Process",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
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
      tableName: "processes",
    }
  );

  // Associations
  Process.associate = function (models) {
    Process.hasMany(models.Activity, {
      foreignKey: "process_id",
      sourceKey: "id",
      as: "activities",
    });

    Process.hasMany(models.TimeEntry, {
      foreignKey: "processId",
      as: "timeEntries",
    });
  };

  return Process;
};
