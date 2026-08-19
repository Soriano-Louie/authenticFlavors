import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";
import { getPhilippineDateTimeString } from "../utils/timezone.js";
import { getActiveDiscount } from "../services/promotionService.js";

/**
 * GET /api/announcements/promotion?package_id=X
 * Returns the live promotion (if any) that applies to a package, so the
 * booking page can preview the discounted price. Public, read-only.
 */
export async function getActivePromotion(req, res, next) {
  try {
    const packageId = Number(req.query.package_id);
    if (!packageId || !Number.isInteger(packageId) || packageId <= 0) {
      return res.status(400).json({
        error: { message: "A valid package_id is required." },
      });
    }

    const discount = await getActiveDiscount(packageId);
    if (!discount) {
      return res.json({ has_discount: false });
    }

    res.json({
      has_discount: true,
      type: discount.type,
      value: discount.value,
      scope: discount.scope,
      package_id: discount.package_id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validates the discount fields submitted for an announcement. Throws nothing;
 * returns an error message string, or null when valid.
 */
function validateDiscountFields(hasDiscount, body) {
  if (!hasDiscount) return null;
  if (
    body.discount_type !== "percentage" &&
    body.discount_type !== "fixed"
  ) {
    return "Discount type must be 'percentage' or 'fixed'.";
  }
  const value = Number(body.discount_value);
  if (!Number.isFinite(value) || value <= 0) {
    return "Discount value must be a positive number.";
  }
  if (body.discount_type === "percentage" && value > 100) {
    return "Percentage discount cannot exceed 100%.";
  }
  if (
    body.discount_scope !== "all" &&
    body.discount_scope !== "package"
  ) {
    return "Discount scope must be 'all' or 'package'.";
  }
  if (body.discount_scope === "package") {
    const pkgId = Number(body.discount_package_id);
    if (!pkgId || !Number.isInteger(pkgId) || pkgId <= 0) {
      return "Please choose a package for this discount.";
    }
  }
  return null;
}

/**
 * GET /api/announcements/public
 * Returns published, non-expired announcements for the public landing page.
 */
export async function getPublicAnnouncements(req, res, next) {
  try {
    // Compare against the Philippine time to avoid drifting with the MySQL
    // server's own timezone (publish_date is stored as PH wall-clock time).
    const nowPH = getPhilippineDateTimeString();
    const [announcements] = await pool.query(
      `SELECT id, title, content, publish_date, expiration_date, image_url, created_at,
              discount_type, discount_value, discount_scope, discount_package_id
       FROM announcements
       WHERE status = 'published'
         AND publish_date <= ?
         AND (expiration_date IS NULL OR expiration_date >= ?)
       ORDER BY publish_date DESC, created_at DESC`,
      [nowPH, nowPH],
    );

    res.json({ announcements });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/announcements
 * Returns all announcements (published and draft) for admin management.
 */
export async function getAdminAnnouncements(req, res, next) {
  try {
    const nowPH = getPhilippineDateTimeString();
    const [rows] = await pool.query(
      `SELECT id, title, content, status, publish_date, expiration_date,
              image_url, image_public_id, created_at, updated_at,
              discount_type, discount_value, discount_scope, discount_package_id,
              (status = 'published' AND expiration_date IS NOT NULL AND expiration_date < ?) AS is_expired
       FROM announcements
       ORDER BY created_at DESC`,
      [nowPH],
    );

    // MySQL booleans arrive as 0/1 — normalise to real booleans for the UI.
    const announcements = rows.map((a) => ({
      ...a,
      is_expired: a.is_expired === 1 || a.is_expired === true,
    }));

    res.json({ announcements });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/announcements
 * Creates a new announcement.
 */
export async function createAnnouncement(req, res, next) {
  try {
    const {
      title,
      content,
      status,
      publish_date,
      expiration_date,
      discount_type,
      discount_value,
      discount_scope,
      discount_package_id,
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: { message: "Title is required." } });
    }
    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ error: { message: "Content is required." } });
    }
    if (!publish_date) {
      return res
        .status(400)
        .json({ error: { message: "Publish date is required." } });
    }
    if (status && status !== "draft" && status !== "published") {
      return res
        .status(400)
        .json({ error: { message: "Status must be 'draft' or 'published'." } });
    }

    // A promotion is any announcement that carries discount fields. All four
    // fields must be consistent (type, value, scope and, when scoped to a
    // package, a valid package id); a fully-empty discount is a plain post.
    const hasDiscount =
      discount_type ||
      discount_value ||
      discount_scope ||
      discount_package_id;
    const discountError = validateDiscountFields(hasDiscount, req.body);
    if (discountError) {
      return res.status(400).json({ error: { message: discountError } });
    }

    // Validate expiration_date is after publish_date
    if (expiration_date) {
      // publish_date is required above, so it is safe to build this Date.
      const publishDateTime = new Date(publish_date);
      const expirationDateTime = new Date(expiration_date);
      if (expirationDateTime <= publishDateTime) {
        return res
          .status(400)
          .json({
            error: { message: "Expiration date must be after publish date." },
          });
      }
    }

    let imageUrl = null;
    let imagePublicId = null;

    // Handle image upload if file provided
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "announcements");
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }

    const [result] = await pool.query(
      `INSERT INTO announcements (
         title, content, status, publish_date, expiration_date,
         image_url, image_public_id,
         discount_type, discount_value, discount_scope, discount_package_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        content.trim(),
        status || "draft",
        publish_date,
        expiration_date || null,
        imageUrl,
        imagePublicId,
        hasDiscount ? String(discount_type).trim() || null : null,
        hasDiscount
          ? String(discount_value).trim() || null
          : null,
        hasDiscount ? String(discount_scope).trim() || null : null,
        hasDiscount && String(discount_scope).trim() === "package"
          ? Number(discount_package_id)
          : null,
      ],
    );

    const [created] = await pool.query(
      "SELECT * FROM announcements WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json({
      message: "Announcement created successfully.",
      announcement: created[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/announcements/:id
 * Updates an existing announcement.
 */
export async function updateAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      status,
      publish_date,
      expiration_date,
      remove_image,
      discount_type,
      discount_value,
      discount_scope,
      discount_package_id,
    } = req.body;

    // Check if announcement exists
    const [existing] = await pool.query(
      "SELECT * FROM announcements WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res
        .status(404)
        .json({ error: { message: "Announcement not found." } });
    }

    // Validation
    if (title !== undefined && !title.trim()) {
      return res
        .status(400)
        .json({ error: { message: "Title cannot be empty." } });
    }
    if (content !== undefined && !content.trim()) {
      return res
        .status(400)
        .json({ error: { message: "Content cannot be empty." } });
    }
    if (status && status !== "draft" && status !== "published") {
      return res
        .status(400)
        .json({ error: { message: "Status must be 'draft' or 'published'." } });
    }

    // Discount fields are optional on update. When any discount field is
    // present they are replaced as a group (all four must be consistent, and
    // an empty group clears the promotion); when none is present the existing
    // discount (if any) is preserved, so simple edits/status toggles are safe.
    const current = existing[0];
    const discountFieldsPresent = [
      discount_type,
      discount_value,
      discount_scope,
      discount_package_id,
    ].some((v) => v !== undefined);

    let effectiveDiscountType = current.discount_type;
    let effectiveDiscountValue = current.discount_value;
    let effectiveDiscountScope = current.discount_scope;
    let effectiveDiscountPackageId = current.discount_package_id;

    if (discountFieldsPresent) {
      const hasDiscount =
        discount_type ||
        discount_value ||
        discount_scope ||
        discount_package_id;
      const discountError = validateDiscountFields(hasDiscount, {
        ...req.body,
        discount_type: discount_type ?? null,
        discount_value: discount_value ?? null,
        discount_scope: discount_scope ?? null,
        discount_package_id: discount_package_id ?? null,
      });
      if (discountError) {
        return res.status(400).json({ error: { message: discountError } });
      }

      effectiveDiscountType = hasDiscount
        ? String(discount_type ?? "").trim() || null
        : null;
      effectiveDiscountValue = hasDiscount
        ? String(discount_value ?? "").trim() || null
        : null;
      effectiveDiscountScope = hasDiscount
        ? String(discount_scope ?? "").trim() || null
        : null;
      effectiveDiscountPackageId =
        hasDiscount && String(discount_scope ?? "").trim() === "package"
          ? Number(discount_package_id)
          : null;
    }

    // Validate expiration_date is after publish_date on EVERY update — even
    // when only one of the two dates is being changed. The effective publish
    // date is either the submitted one or the currently stored one, so a
    // request that only extends/clears an expiration still can't save an
    // expiry that precedes the (possibly unchanged) publish date.
    const effectiveExpirationDate =
      expiration_date !== undefined
        ? expiration_date || null
        : current.expiration_date;

    if (effectiveExpirationDate) {
      const effectivePublishDate = publish_date || current.publish_date;
      if (
        new Date(effectiveExpirationDate) <= new Date(effectivePublishDate)
      ) {
        return res.status(400).json({
          error: { message: "Expiration date must be after publish date." },
        });
      }
    }

    let imageUrl = current.image_url;
    let imagePublicId = current.image_public_id;

    // Handle image removal
    if (remove_image === "true" || remove_image === true) {
      if (current.image_public_id) {
        await deleteFromCloudinary(current.image_public_id);
      }
      imageUrl = null;
      imagePublicId = null;
    }

    // Handle new image upload
    if (req.file) {
      // Delete old image if exists
      if (current.image_public_id) {
        await deleteFromCloudinary(current.image_public_id);
      }
      const result = await uploadToCloudinary(req.file.buffer, "announcements");
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }

    await pool.query(
      `UPDATE announcements
       SET title = ?, content = ?, status = ?, publish_date = ?,
           expiration_date = ?, image_url = ?, image_public_id = ?,
           discount_type = ?, discount_value = ?, discount_scope = ?,
           discount_package_id = ?
       WHERE id = ?`,
      [
        (title || current.title).trim(),
        (content || current.content).trim(),
        status || current.status,
        publish_date || current.publish_date,
        expiration_date !== undefined
          ? expiration_date || null
          : current.expiration_date,
        imageUrl,
        imagePublicId,
        effectiveDiscountType,
        effectiveDiscountValue,
        effectiveDiscountScope,
        effectiveDiscountPackageId,
        id,
      ],
    );

    const [updated] = await pool.query(
      "SELECT * FROM announcements WHERE id = ?",
      [id],
    );

    res.json({
      message: "Announcement updated successfully.",
      announcement: updated[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/announcements/:id
 * Deletes an announcement permanently.
 */
export async function deleteAnnouncement(req, res, next) {
  try {
    const { id } = req.params;

    // Check if announcement exists and get image info for cleanup
    const [existing] = await pool.query(
      "SELECT id, image_public_id FROM announcements WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res
        .status(404)
        .json({ error: { message: "Announcement not found." } });
    }

    // Delete image from Cloudinary if exists
    if (existing[0].image_public_id) {
      await deleteFromCloudinary(existing[0].image_public_id);
    }

    await pool.query("DELETE FROM announcements WHERE id = ?", [id]);

    res.json({ message: "Announcement deleted successfully." });
  } catch (error) {
    next(error);
  }
}
