// models/Organization.js
module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define(
    "Organization",
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
      workLocation: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "work_location", // Map to snake_case column in DB
      },
      address: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: "organizations",
    }
  );

  Organization.associate = function (models) {
    Organization.hasMany(models.Customer, {
      foreignKey: "organizationId",
      as: "clients",
    });

    // Many-to-many relationship with Users
    Organization.belongsToMany(models.User, {
      through: models.UserOrganization,
      foreignKey: "organizationId",
      otherKey: "userId",
      as: "users",
    });

    Organization.hasMany(models.UserOrganization, {
      foreignKey: "organizationId",
      as: "userOrganizations",
    });

    Organization.hasMany(models.TimeEntry, {
      foreignKey: "organizationId",
      as: "timeEntries",
    });
  };

  return Organization;
};
