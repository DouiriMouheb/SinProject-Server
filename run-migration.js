// run-migration.js
require("dotenv").config();
const { sequelize } = require("./models");

async function runMigration() {
  try {
    console.log("Starting database sync...");
    await sequelize.sync({ alter: true });
    console.log(
      "Database synced successfully! Daily login tracker table created."
    );
  } catch (error) {
    console.error("Error syncing database:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

runMigration();
