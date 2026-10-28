/**
 * Consistent API Response Helper for Akatsuki's Draft
 */

export const sendResponse = (res, statusCode = 200, success = true, message = "", data = null, meta = undefined) => {
  const payload = {
    success,
    message,
  };

  if (data !== null && data !== undefined) {
    payload.data = data;
  }

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const sendSuccess = (res, message = "Success", data = null, statusCode = 200, meta = undefined) => {
  return sendResponse(res, statusCode, true, message, data, meta);
};

export const sendError = (res, message = "An error occurred", statusCode = 500, errors = null) => {
  const payload = {
    success: false,
    message,
  };

  if (errors !== null && errors !== undefined) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};
