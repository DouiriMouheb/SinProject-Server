const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config();

const config = require("./config");
const logger = require("./utils/logger");
const {
  globalErrorHandler,
  handleNotFound,
} = require("./middleware/errorHandler");
const { sequelize } = require("./models");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
const timerRoutes = require("./routes/timer");
const customerRoutes = require("./routes/customers");
const projectRoutes = require("./routes/projects");
const dailyLoginRoutes = require("./routes/dailyLogin");

const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: config.server.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

// Logging middleware
if (config.server.env !== "test") {
  app.use(morgan("combined", { stream: logger.stream }));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Time Tracker API is running",
    timestamp: new Date().toISOString(),
    environment: config.server.env,
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/timer", timerRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/daily-login", dailyLoginRoutes);

// 404 handler
app.use(handleNotFound);

// Global error handler
app.use(globalErrorHandler);

// Database connection and server startup
const PORT = config.server.port;

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info("Database connection established successfully");

    // Sync database models (in development)
    if (config.server.env === "development") {
      await sequelize.sync({ alter: true });
      logger.info("Database models synchronized");
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(
        `Server running on port ${PORT} in ${config.server.env} mode`
      );
      logger.info(`Frontend URL: ${config.server.frontendUrl}`);
    });
  } catch (error) {
    logger.error("Unable to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await sequelize.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await sequelize.close();
  process.exit(0);
});

startServer();

module.exports = app;
