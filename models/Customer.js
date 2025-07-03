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
      description: {
        type: DataTypes.TEXT,
      },
      contactEmail: {
        type: DataTypes.STRING(255),
        validate: {
          isEmail: true,
        },
      },
      contactPhone: {
        type: DataTypes.STRING(50),
      },
      address: {
        type: DataTypes.TEXT,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "customers",
    }
  );

  // Associations
  Customer.associate = function (models) {
    Customer.hasMany(models.WorkProject, {
      foreignKey: "customerId",
      as: "workProjects",
    });
  };

  return Customer;
};
