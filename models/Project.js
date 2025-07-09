// models/Project.js
module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define(
    "Project",
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
        allowNull: true,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "customers",
          key: "id",
        },
        field: "customer_id",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        field: "is_active",
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "start_date",
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "end_date",
      },
      budget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Project budget amount",
      },
      status: {
        type: DataTypes.ENUM(
          "planning",
          "active",
          "on-hold",
          "completed",
          "cancelled"
        ),
        defaultValue: "planning",
        allowNull: false,
      },
    },
    {
      tableName: "projects",
      indexes: [
        {
          fields: ["customer_id"],
          name: "idx_projects_customer",
        },
        {
          fields: ["status"],
          name: "idx_projects_status",
        },
        {
          fields: ["is_active"],
          name: "idx_projects_active",
        },
      ],
    }
  );

  // Associations
  Project.associate = function (models) {
    // Project belongs to a Customer
    Project.belongsTo(models.Customer, {
      foreignKey: "customer_id",
      targetKey: "id",
      as: "customer",
    });

    // Project can have many TimeEntries
    Project.hasMany(models.TimeEntry, {
      foreignKey: "projectId",
      as: "timeEntries",
    });
  };

  return Project;
};
