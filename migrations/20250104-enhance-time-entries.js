"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Example: Add columns or modify the time_entries table as needed for enhanced time entry structure
    // You can adjust this to your actual requirements
    await queryInterface.addColumn("time_entries", "duration", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Duration of the time entry in minutes",
    });
    await queryInterface.addColumn("time_entries", "notes", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Optional notes for the time entry",
    });
    // Add any other enhancements here
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("time_entries", "duration");
    await queryInterface.removeColumn("time_entries", "notes");
    // Remove any other enhancements here
  },
};
