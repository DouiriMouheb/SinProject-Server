// models/WorkProject.js
module.exports = (sequelize, DataTypes) => {
  const WorkProject = sequelize.define(
    "WorkProject",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "customers",
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
      status: {
        type: DataTypes.ENUM("active", "on_hold", "completed", "cancelled"),
        defaultValue: "active",
      },
      startDate: {
        type: DataTypes.DATE,
      },
      endDate: {
        type: DataTypes.DATE,
      },
      budget: {
        type: DataTypes.DECIMAL(10, 2),
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "work_projects",
    }
  );

  // Associations
  WorkProject.associate = function (models) {
    WorkProject.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer",
    });

    WorkProject.hasMany(models.TimeEntry, {
      foreignKey: "workProjectId",
      as: "timeEntries",
    });
  };

  return WorkProject;
};
