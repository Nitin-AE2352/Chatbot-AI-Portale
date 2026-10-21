
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./src/config/db");
const connectDB = db;
const { pool } = db;

const authRoutes = require("./src/routes/authRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const chatRoutes = require("./src/routes/chatRoutes");
const htmlRoutes = require("./src/routes/htmlRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

const app = express();

// 1. CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigin =
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

      if (allowedOrigin) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 2. Request body parsing
app.use(express.json({ limit: "10mb" }));

// 3. Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  res.on("finish", () => {
    console.log(`Response status: ${res.statusCode}`);
  });

  next();
});

// 4. Home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Chatbot AI Portal Backend!",
    database: "Supabase PostgreSQL",
  });
});

// 5. Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running successfully",
  });
});

// 6. Database health
app.get("/api/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      success: true,
      message: "Supabase PostgreSQL is connected",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// 7. API routes — mount each route once
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/html", htmlRoutes);
app.use("/api/admin", adminRoutes);

// 8. Unknown route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 9. Error handler
app.use((err, req, res, next) => {
  console.error("API error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// 10. Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log("CORS enabled for local development frontend ports.");
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  }
}

startServer();
