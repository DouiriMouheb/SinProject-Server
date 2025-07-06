// migrations/create-daily-login-tracker.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("daily_login_trackers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      login_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: "The date of the first login (YYYY-MM-DD format)",
      },
      first_login_time: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "Timestamp of the first login for this date",
      },
      day_end_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when user ended their day (optional)",
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: "IP address of the first login",
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "User agent string from the first login",
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "Optional location info (office, remote, etc.)",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Optional notes about the day",
      },
      total_working_hours: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: "Calculated working hours if day end time is set",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes
    await queryInterface.addIndex("daily_login_trackers", {
      fields: ["user_id", "login_date"],
      unique: true,
      name: "unique_user_date",
    });

    await queryInterface.addIndex("daily_login_trackers", {
      fields: ["login_date"],
      name: "idx_login_date",
    });

    await queryInterface.addIndex("daily_login_trackers", {
      fields: ["user_id"],
      name: "idx_user_id",
    });

    await queryInterface.addIndex("daily_login_trackers", {
      fields: ["first_login_time"],
      name: "idx_first_login_time",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("daily_login_trackers");
  },
};
