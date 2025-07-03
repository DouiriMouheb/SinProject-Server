// config/index.js
require("dotenv").config();

const config = {
  // Database configuration
  database: {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "time_tracker",
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "password",
    dialect: "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  },

  // JWT configuration
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      "your-super-secret-jwt-key-change-in-production",
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
    issuer: process.env.JWT_ISSUER || "time-tracker",
    audience: process.env.JWT_AUDIENCE || "time-tracker-users",
  },

  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutTime: parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000, // 30 minutes
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    authMax: 5, // limit auth endpoints to 5 requests per windowMs
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
  },
};

// Validation for required environment variables
const requiredEnvVars = ["JWT_SECRET", "DB_NAME", "DB_USER", "DB_PASSWORD"];

if (config.server.env === "production") {
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  if (config.jwt.secret === "your-super-secret-jwt-key-change-in-production") {
    throw new Error("JWT_SECRET must be changed in production");
  }

  if (config.jwt.secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters long in production"
    );
  }
}

module.exports = config;
