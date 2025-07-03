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
      category: {
        type: DataTypes.STRING(100),
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "processes",
    }
  );

  // Associations
  Process.associate = function (models) {
    Process.hasMany(models.Activity, {
      foreignKey: "processId",
      as: "activities",
    });
  };

  return Process;
};
