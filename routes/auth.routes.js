import express from "express";
import { registerUser, loginUser, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Register a new user (role: "user")
router.post("/register", registerUser);

// Login user and obtain JWT
router.post("/login", loginUser);

// Get current user profile (requires valid JWT)
router.get("/me", authMiddleware, getMe);

export default router;
