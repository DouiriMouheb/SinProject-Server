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
