import multer from "multer";
import { sendError } from "../utils/apiResponse.js";

/**
 * 404 Route Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  return sendError(
    res,
    `Resource not found: cannot ${req.method} ${req.originalUrl}`,
    404
  );
};

/**
 * Centralized Application Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  // If response headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[Error] [${req.method} ${req.url}] ${err.name}: ${err.message}`);

  // Handle Multer errors (file size limit, invalid file type)
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(res, "File size exceeds the 5MB limit", 400);
    }
    return sendError(res, err.message || "File upload error", 400);
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue ? err.keyValue[field] : "";
    return sendError(
      res,
      `A record with this ${field} ('${value}') already exists.`,
      400
    );
  }

  // Handle Mongoose Validation Error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, messages.join(", "), 400, messages);
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === "CastError") {
    return sendError(
      res,
      `Invalid format for field '${err.path}': value '${err.value}' is not valid`,
      400
    );
  }

  // Handle JSON parsing error in request body
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return sendError(res, "Invalid JSON payload in request body", 400);
  }

  // Handle custom status codes attached to errors
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  return sendError(res, message, statusCode);
};
