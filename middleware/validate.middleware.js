import mongoose from "mongoose";
import { sendError } from "../utils/apiResponse.js";

/**
 * Middleware factory to validate MongoDB ObjectId route parameters
 * @param {string} paramName - Name of parameter (e.g. 'id', 'postId')
 */
export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        `Invalid identifier format for '${paramName}': must be a 24-character hexadecimal MongoDB ObjectId`,
        400
      );
    }
    next();
  };
};
