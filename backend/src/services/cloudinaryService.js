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
        folder: `authentic_flavors/${folder === "receipts" ? "private_receipts" : folder}`,
        ...(folder === "receipts" ? { type: "authenticated" } : {}),
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
    await cloudinary.uploader.destroy(publicId, publicId.startsWith("authentic_flavors/private_receipts/") ? { type: "authenticated", invalidate: true } : { invalidate: true });
  } catch (error) {
    console.error("Cloudinary delete failed:", error.message);
  }
}

export function privateReceiptUrl(payment) {
  const id = payment.receipt_public_id;
  if (typeof id === 'string' && id.startsWith('authentic_flavors/private_receipts/')) {
    const format = String(payment.receipt_url).match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1];
    if (!format) throw new Error('Invalid receipt format');
    return cloudinary.utils.private_download_url(id, format, { type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 60, attachment: false });
  }
  // Historical images: fetch only this application's Cloudinary account.
  const url = new URL(payment.receipt_url);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
      !url.pathname.startsWith(`/${env.cloudinaryCloudName}/image/upload/`)) throw new Error('Untrusted legacy receipt URL');
  return url.href;
}

export async function deleteOwnedReceipt(publicId) {
  // Legacy IDs may have been supplied by a client; never delete them implicitly.
  if (typeof publicId === 'string' && publicId.startsWith('authentic_flavors/private_receipts/')) {
    await deleteFromCloudinary(publicId);
  }
}
