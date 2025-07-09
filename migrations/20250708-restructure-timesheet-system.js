"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // First, let's create a user_organizations junction table for many-to-many relationship
    await queryInterface.createTable("user_organizations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "user_id",
      },
      organizationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        onDelete: "CASCADE",
        field: "organization_id",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        field: "created_at",
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        field: "updated_at",
      },
    });

    // Add unique constraint to prevent duplicate user-organization relationships
    try {
      await queryInterface.addIndex(
        "user_organizations",
        ["user_id", "organization_id"],
        {
          unique: true,
          name: "unique_user_organization",
        }
      );
    } catch (error) {
      console.log("Index unique_user_organization might already exist");
    }

    // Update organizations table to ensure it has address field
    try {
      await queryInterface.addColumn("organizations", "address", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    } catch (error) {
      // Column might already exist
      console.log("Address column might already exist in organizations");
    }

    // Update customers table to ensure proper structure
    try {
      await queryInterface.addColumn("customers", "address", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    } catch (error) {
      // Column might already exist
    }

    // Remove customer_id from processes table to make processes independent
    try {
      await queryInterface.removeColumn("processes", "customer_id");
    } catch (error) {
      console.log("customer_id column might not exist in processes table");
    }

    // Update time_entries table structure
    try {
      // Add work_location_type column if it doesn't exist
      await queryInterface.addColumn("time_entries", "work_location_type", {
        type: Sequelize.ENUM("organization", "customer", "home"),
        allowNull: false,
        defaultValue: "organization",
      });
    } catch (error) {
      console.log("work_location_type column might already exist");
    }

    try {
      // Add work_location_address column if it doesn't exist
      await queryInterface.addColumn("time_entries", "work_location_address", {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    } catch (error) {
      console.log("work_location_address column might already exist");
    }

    // Remove old work place columns if they exist
    try {
      await queryInterface.removeColumn("time_entries", "work_place_type");
    } catch (error) {
      console.log("work_place_type column might not exist");
    }

    try {
      await queryInterface.removeColumn("time_entries", "work_place_address");
    } catch (error) {
      console.log("work_place_address column might not exist");
    }

    // Ensure all required columns exist in time_entries
    const timeEntriesColumns = await queryInterface.describeTable(
      "time_entries"
    );

    if (!timeEntriesColumns.date) {
      // Add date column as nullable first
      await queryInterface.addColumn("time_entries", "date", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });

      // Update existing records to set date from start_time
      await queryInterface.sequelize.query(`
        UPDATE time_entries 
        SET date = start_time::date 
        WHERE date IS NULL AND start_time IS NOT NULL
      `);

      // Update any remaining records with today's date
      await queryInterface.sequelize.query(`
        UPDATE time_entries 
        SET date = CURRENT_DATE 
        WHERE date IS NULL
      `);

      // Now make the column NOT NULL
      await queryInterface.changeColumn("time_entries", "date", {
        type: Sequelize.DATEONLY,
        allowNull: false,
      });
    }

    if (!timeEntriesColumns.notes) {
      await queryInterface.addColumn("time_entries", "notes", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // Create indexes for better performance
    try {
      await queryInterface.addIndex("time_entries", ["user_id", "date"], {
        name: "idx_time_entries_user_date",
      });
    } catch (error) {
      console.log("Index idx_time_entries_user_date might already exist");
    }

    try {
      await queryInterface.addIndex("time_entries", ["organization_id"], {
        name: "idx_time_entries_organization",
      });
    } catch (error) {
      console.log("Index idx_time_entries_organization might already exist");
    }

    try {
      await queryInterface.addIndex("time_entries", ["customer_id"], {
        name: "idx_time_entries_customer",
      });
    } catch (error) {
      console.log("Index idx_time_entries_customer might already exist");
    }

    console.log(
      "Timesheet system restructure migration completed successfully"
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    try {
      await queryInterface.removeIndex(
        "time_entries",
        "idx_time_entries_user_date"
      );
      await queryInterface.removeIndex(
        "time_entries",
        "idx_time_entries_organization"
      );
      await queryInterface.removeIndex(
        "time_entries",
        "idx_time_entries_customer"
      );
    } catch (error) {
      console.log("Some indexes might not exist");
    }

    // Remove new columns
    try {
      await queryInterface.removeColumn("time_entries", "work_location_type");
      await queryInterface.removeColumn(
        "time_entries",
        "work_location_address"
      );
      await queryInterface.removeColumn("time_entries", "date");
      await queryInterface.removeColumn("time_entries", "notes");
    } catch (error) {
      console.log("Some columns might not exist");
    }

    // Add back customer_id to processes
    try {
      await queryInterface.addColumn("processes", "customer_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "customers",
          key: "id",
        },
        field: "customer_id",
      });
    } catch (error) {
      console.log("Error adding back customer_id to processes");
    }

    // Drop user_organizations table
    await queryInterface.dropTable("user_organizations");

    console.log("Timesheet system restructure migration rolled back");
  },
};
