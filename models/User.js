// models/User.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 100],
        },
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          len: [6, 255],
        },
      },
      role: {
        type: DataTypes.ENUM("user", "admin"),
        defaultValue: "user",
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_active", // Map to snake_case column in DB
      },
      lastLogin: {
        type: DataTypes.DATE,
        field: "last_login", // Map to snake_case column in DB
      },
      loginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "login_attempts", // Map to snake_case column in DB
      },
      lockUntil: {
        type: DataTypes.DATE,
        field: "lock_until", // Map to snake_case column in DB
      },
      passwordChangedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "password_changed_at", // Map to snake_case column in DB
      },
      homeAddress: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "home_address", // Map to snake_case column in DB
      },
    },
    {
      tableName: "users",
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) {
            const salt = await bcrypt.genSalt(config.security.bcryptRounds);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("password")) {
            const salt = await bcrypt.genSalt(config.security.bcryptRounds);
            user.password = await bcrypt.hash(user.password, salt);
            user.passwordChangedAt = new Date();
          }
        },
      },
    }
  );

  // Instance methods
  User.prototype.comparePassword = async function (candidatePassword) {
    if (!candidatePassword) return false;
    return await bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.generateTokens = function () {
    const payload = {
      id: this.id,
      email: this.email,
      role: this.role,
      name: this.name,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessTokenExpiry,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    const refreshToken = jwt.sign({ id: this.id }, config.jwt.secret, {
      expiresIn: config.jwt.refreshTokenExpiry,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    return { accessToken, refreshToken };
  };

  User.prototype.isLocked = function () {
    return !!(this.lockUntil && this.lockUntil > new Date());
  };

  User.prototype.incLoginAttempts = async function () {
    if (this.lockUntil && this.lockUntil < new Date()) {
      return this.update({
        loginAttempts: 1,
        lockUntil: null,
      });
    }

    const updates = { loginAttempts: this.loginAttempts + 1 };

    if (
      this.loginAttempts + 1 >= config.security.maxLoginAttempts &&
      !this.isLocked()
    ) {
      updates.lockUntil = new Date(Date.now() + config.security.lockoutTime);
    }

    return this.update(updates);
  };

  User.prototype.resetLoginAttempts = function () {
    return this.update({
      loginAttempts: 0,
      lockUntil: null,
    });
  };

  // Associations
  User.associate = function (models) {
    User.hasMany(models.TimeEntry, {
      foreignKey: "userId",
      as: "timeEntries",
    });

    User.hasMany(models.DailyLoginTracker, {
      foreignKey: "userId",
      as: "dailyLoginTrackers",
    });

    // Many-to-many relationship with Organizations
    User.belongsToMany(models.Organization, {
      through: models.UserOrganization,
      foreignKey: "userId",
      otherKey: "organizationId",
      as: "organizations",
    });

    User.hasMany(models.UserOrganization, {
      foreignKey: "userId",
      as: "userOrganizations",
    });
  };

  return User;
};
