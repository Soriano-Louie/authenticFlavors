import multer from "multer";

// Store file in memory so we can upload to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
      ),
      false,
    );
  }
};

// Profile photo upload — stricter: only JPG, JPEG, PNG
const profilePhotoFilter = (_req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPG, JPEG, and PNG images are allowed.",
      ),
      false,
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

export const uploadProfilePhoto = multer({
  storage,
  fileFilter: profilePhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Detect the real image format from the file signature (magic bytes) rather
// than trusting the client-supplied MIME type. Prevents spoofed payloads
// (e.g. an HTML/JS file renamed to .png) from being stored and served later.
function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "gif";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

function isMimeCompatible(realType, claimedMime) {
  if (realType === "jpeg") return claimedMime === "image/jpeg" || claimedMime === "image/jpg";
  if (realType === "png") return claimedMime === "image/png";
  if (realType === "gif") return claimedMime === "image/gif";
  if (realType === "webp") return claimedMime === "image/webp";
  return false;
}

// Run AFTER multer: verifies the uploaded bytes match the declared image type.
export function validateImageSignature(req, _res, next) {
  if (!req.file) {
    return next();
  }

  const realType = sniffImageType(req.file.buffer);
  if (!realType || !isMimeCompatible(realType, req.file.mimetype)) {
    const error = new Error(
      "Invalid file contents. Only real JPEG, PNG, GIF, or WebP images are allowed.",
    );
    error.status = 400;
    return next(error);
  }

  return next();
}
