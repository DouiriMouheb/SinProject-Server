// models/Customer.js
module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    "Customer",
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
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        field: "organization_id",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: [0, 1000],
        },
      },
      contactEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true,
        },
        field: "contact_email",
      },
      contactPhone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "contact_phone",
      },
      address: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      workLocation: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "work_location",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        field: "is_active",
      },
    },
    {
      tableName: "customers",
    }
  );

  Customer.associate = function (models) {
    // Customer belongs to an Organization
    Customer.belongsTo(models.Organization, {
      foreignKey: "organization_id",
      targetKey: "id",
      as: "organization",
    });

    // Customer has many TimeEntries
    Customer.hasMany(models.TimeEntry, {
      foreignKey: "customerId",
      as: "timeEntries",
    });

    // Customer has many Projects
    Customer.hasMany(models.Project, {
      foreignKey: "customer_id",
      sourceKey: "id",
      as: "workProjects", // Match the client-side expectation
    });
  };

  return Customer;
};
