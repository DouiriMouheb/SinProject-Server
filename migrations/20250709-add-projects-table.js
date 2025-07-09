"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create projects table
    await queryInterface.createTable("projects", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      customer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "customers",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      budget: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "planning",
          "active",
          "on-hold",
          "completed",
          "cancelled"
        ),
        defaultValue: "planning",
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex("projects", ["customer_id"], {
      name: "idx_projects_customer",
    });

    await queryInterface.addIndex("projects", ["status"], {
      name: "idx_projects_status",
    });

    await queryInterface.addIndex("projects", ["is_active"], {
      name: "idx_projects_active",
    });

    // Add project_id column to time_entries table
    try {
      await queryInterface.addColumn("time_entries", "project_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "projects",
          key: "id",
        },
        onDelete: "SET NULL",
      });

      // Add index for project_id in time_entries
      await queryInterface.addIndex("time_entries", ["project_id"], {
        name: "idx_time_entries_project",
      });
    } catch (error) {
      console.log("project_id column might already exist in time_entries");
    }

    console.log("Projects table and associations created successfully");
  },

  async down(queryInterface, Sequelize) {
    // Remove project_id column from time_entries
    try {
      await queryInterface.removeIndex(
        "time_entries",
        "idx_time_entries_project"
      );
      await queryInterface.removeColumn("time_entries", "project_id");
    } catch (error) {
      console.log("project_id column might not exist");
    }

    // Remove indexes
    try {
      await queryInterface.removeIndex("projects", "idx_projects_customer");
      await queryInterface.removeIndex("projects", "idx_projects_status");
      await queryInterface.removeIndex("projects", "idx_projects_active");
    } catch (error) {
      console.log("Some indexes might not exist");
    }

    // Drop projects table
    await queryInterface.dropTable("projects");

    console.log("Projects table and associations removed successfully");
  },
};
