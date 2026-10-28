import { sendError } from "../utils/apiResponse.js";

/**
 * Admin Role Middleware
 * Ensures the authenticated user holds the "admin" role.
 * Must be used after authMiddleware.
 */
export const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return sendError(res, "Authentication required prior to role verification", 401);
  }

  if (req.user.role !== "admin") {
    return sendError(
      res,
      "Access forbidden: Admin privileges are required to perform this action",
      403
    );
  }

  next();
};

export default adminMiddleware;
