// models/index.js
const { Sequelize } = require("sequelize");
const config = require("../config");

const sequelize = new Sequelize(
  config.database.database,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    logging: config.database.logging,
    pool: config.database.pool,
    define: config.database.define,
  }
);

// Import models
const User = require("./User")(sequelize, Sequelize.DataTypes);
const Customer = require("./Customer")(sequelize, Sequelize.DataTypes);
const WorkProject = require("./WorkProject")(sequelize, Sequelize.DataTypes);
const Process = require("./Process")(sequelize, Sequelize.DataTypes);
const Activity = require("./Activity")(sequelize, Sequelize.DataTypes);
const TimeEntry = require("./TimeEntry")(sequelize, Sequelize.DataTypes);
const DailyLoginTracker = require("./DailyLoginTracker")(
  sequelize,
  Sequelize.DataTypes
);

// Define associations
const db = {
  sequelize,
  Sequelize,
  User,
  Customer,
  WorkProject,
  Process,
  Activity,
  TimeEntry,
  DailyLoginTracker,
};

// Set up associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
