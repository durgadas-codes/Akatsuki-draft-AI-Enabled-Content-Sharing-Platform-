import cloudinary, { isCloudinaryConfigured } from "../config/cloud.config.js";

/**
 * Upload an image buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from Multer
 * @param {string} folder - Destination folder name
 * @returns {Promise<string>} Secure URL of uploaded image
 */
export const uploadImageToCloudinary = async (buffer, folder = "akatsuki_drafts") => {
  if (!buffer) return null;

  if (!isCloudinaryConfigured) {
    console.warn("[Cloudinary] Credentials not fully configured in environment. Skipping image upload.");
    return null;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Upload failed:", error.message);
          return reject(new Error(`Image upload failed: ${error.message}`));
        }
        resolve(result?.secure_url || null);
      }
    );
    stream.end(buffer);
  });
};
