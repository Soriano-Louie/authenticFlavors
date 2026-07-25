import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

/**
 * Uploads a file buffer to Cloudinary.
 * @param {Buffer} fileBuffer - The file buffer from multer
 * @param {string} folder - Cloudinary folder name (e.g. "receipts")
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadToCloudinary(fileBuffer, folder = "receipts") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `authentic_flavors/${folder}`,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        max_file_size: 5 * 1024 * 1024, // 5MB
      },
      (error, result) => {
        if (error) {
          reject(new Error(error.message || "Cloudinary upload failed"));
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      },
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Deletes an image from Cloudinary by public_id.
 * @param {string} publicId
 */
export async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete failed:", error.message);
  }
}
