// models/UserOrganization.js
module.exports = (sequelize, DataTypes) => {
  const UserOrganization = sequelize.define(
    "UserOrganization",
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
        field: "user_id",
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
    },
    {
      tableName: "user_organizations",
      indexes: [
        {
          unique: true,
          fields: ["user_id", "organization_id"],
          name: "unique_user_organization",
        },
      ],
    }
  );

  UserOrganization.associate = function (models) {
    UserOrganization.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    UserOrganization.belongsTo(models.Organization, {
      foreignKey: "organizationId",
      as: "organization",
    });
  };

  return UserOrganization;
};
