import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { sendError } from "../utils/apiResponse.js";

/**
 * JWT Authentication Middleware
 * Validates the Authorization Bearer token and attaches the authenticated user to req.user.
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "Authentication required: No Bearer token provided", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return sendError(res, "Authentication required: Invalid token format", 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[Auth Middleware] JWT_SECRET is not configured in environment");
      return sendError(res, "Authentication service misconfigured", 500);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === "TokenExpiredError") {
        return sendError(res, "Token has expired. Please log in again.", 401);
      }
      return sendError(res, "Invalid or malformed token", 401);
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return sendError(res, "User associated with this token no longer exists", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[Auth Middleware Error]:", error.message);
    return sendError(res, "Authentication failed", 401);
  }
};

/**
 * Optional Authentication Middleware
 * If a valid Bearer token is provided, attaches req.user.
 * If not provided or invalid, proceeds without failing.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    const secret = process.env.JWT_SECRET;
    if (!secret) return next();

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId).select("-password");
    if (user) {
      req.user = user;
    }
  } catch {
    // Silently continue unauthenticated
  }
  next();
};

export default authMiddleware;

