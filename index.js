import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import postRoutes from "./routes/post.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome & healthcheck
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Akatsuki's Draft — AI-Enabled Content Sharing Platform API is active",
    version: "1.0.0",
    docs: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Primary API Routes (Mount at /api/... and also at /... for exact task PDF specification compatibility)
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

app.use("/api/posts", postRoutes);
app.use("/posts", postRoutes);

app.use("/api/admin", adminRoutes);
app.use("/admin", adminRoutes);

app.use("/api/ai", aiRoutes);
app.use("/ai", aiRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection & Server initialization
const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test"));

if (!isTestEnv) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`[Akatsuki's Draft API] Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("[Fatal] Failed to connect to MongoDB Atlas on startup:", err.message);
    });
}

export default app;
