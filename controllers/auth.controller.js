import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

/**
 * Register a new user
 * POST /api/auth/register or POST /auth/register
 * Enforces role: "user" — self-assigning admin role is strictly disallowed.
 */
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return sendError(res, "Name is required", 400);
    }

    if (name.trim().length < 2) {
      return sendError(res, "Name must be at least 2 characters long", 400);
    }

    if (!email || typeof email !== "string" || email.trim().length === 0) {
      return sendError(res, "Email is required", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return sendError(res, "Please provide a valid email address", 400);
    }

    if (!password || typeof password !== "string") {
      return sendError(res, "Password is required", 400);
    }

    if (password.length < 6) {
      return sendError(res, "Password must be at least 6 characters long", 400);
    }

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return sendError(
        res,
        "Email is already registered. Please login or use a different email.",
        400
      );
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user - enforce role as "user"
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "user", // Strict: never allow assigning admin via registration
    });

    const userProfile = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    return sendSuccess(
      res,
      "User registered successfully",
      { user: userProfile },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate user & issue JWT
 * POST /api/auth/login or POST /auth/login
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return sendError(res, "Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, "Invalid email or password", 401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return sendError(res, "Server authentication misconfiguration", 500);
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      jwtSecret,
      { expiresIn }
    );

    const userProfile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return sendSuccess(
      res,
      "User logged in successfully",
      {
        token,
        user: userProfile,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user's profile
 * GET /api/auth/me or GET /auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    return sendSuccess(
      res,
      "User profile retrieved successfully",
      { user: req.user },
      200
    );
  } catch (error) {
    next(error);
  }
};
