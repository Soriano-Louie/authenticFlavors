import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";
import { getPhilippineDateTimeString } from "../utils/timezone.js";
import { getActiveDiscount } from "../services/promotionService.js";

/**
 * GET /api/announcements/promotion?package_id=X&pax_count=N
 * Returns the live promotion (if any) that applies to a package at a guest
 * count, so the booking page can preview the discounted price. Public,
 * read-only. pax_count is optional; when omitted, coverage is any tier.
 */
export async function getActivePromotion(req, res, next) {
  try {
    const packageId = Number(req.query.package_id);
    if (!packageId || !Number.isInteger(packageId) || packageId <= 0) {
      return res.status(400).json({
        error: { message: "A valid package_id is required." },
      });
    }

    let paxCount = null;
    if (req.query.pax_count !== undefined && req.query.pax_count !== "") {
      paxCount = Number(req.query.pax_count);
      if (!Number.isInteger(paxCount) || paxCount <= 0) {
        return res.status(400).json({
          error: { message: "pax_count must be a positive integer." },
        });
      }
    }

    const discount = await getActiveDiscount(packageId, paxCount);
    if (!discount) {
      return res.json({ has_discount: false });
    }

    res.json({
      has_discount: true,
      type: discount.type,
      value: discount.value,
      scope: discount.scope,
      package_id: discount.package_id,
      pax_count: discount.pax_count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validates the discount fields submitted for an announcement. Throws nothing;
 * returns an error message string, or null when valid. Only checks shape —
 * cross-checks against the DB (e.g. the tier exists for the package) run in
 * the create/update handlers.
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
  // Both "package" and "all" scopes support an optional pax-count filter.
  // When present it narrows the promotion to that specific guest-count tier.
  const pax = body.discount_pax_count;
  if (pax !== undefined && pax !== null && pax !== "") {
    const paxCount = Number(pax);
    if (!Number.isInteger(paxCount) || paxCount <= 0) {
      return "Guest count tier must be a positive integer.";
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
              discount_type, discount_value, discount_scope, discount_package_id, discount_pax_count
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
              discount_type, discount_value, discount_scope, discount_package_id, discount_pax_count,
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
      discount_pax_count,
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

    // A published announcement must never start in the past.
    if ((status || "draft") === "published") {
      if (new Date(publish_date) < new Date(getPhilippineDateTimeString())) {
        return res.status(400).json({
          error: {
            message:
              "Publish date cannot be earlier than the current date and time.",
          },
        });
      }
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

    // When a guest-count tier is attached to a package-specific promotion,
    // make sure that tier actually exists in the package's price list.
    const isPackageScoped = hasDiscount && discount_scope === "package";
    const selectedPax =
      discount_pax_count !== undefined &&
      discount_pax_count !== null &&
      discount_pax_count !== ""
        ? Number(discount_pax_count)
        : null;
    if (isPackageScoped && selectedPax) {
      const [tierRows] = await pool.query(
        "SELECT pax_count FROM package_pricing WHERE package_id = ? AND pax_count = ?",
        [Number(discount_package_id), selectedPax],
      );
      if (tierRows.length === 0) {
        return res.status(400).json({
          error: {
            message:
              "The selected guest count tier is not available for this package.",
          },
        });
      }
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
         discount_type, discount_value, discount_scope, discount_package_id, discount_pax_count
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        // Persist pax_count for both "package" and "all" scopes — a pax filter
        // on "all" means "apply to every package that has this guest-count tier".
        hasDiscount && selectedPax ? selectedPax : null,
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
      discount_pax_count,
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
    const effectiveStatus = status || current.status;

    const discountFieldsPresent = [
      discount_type,
      discount_value,
      discount_scope,
      discount_package_id,
      discount_pax_count,
    ].some((v) => v !== undefined);

    let effectiveDiscountType = current.discount_type;
    let effectiveDiscountValue = current.discount_value;
    let effectiveDiscountScope = current.discount_scope;
    let effectiveDiscountPackageId = current.discount_package_id;
    let effectiveDiscountPaxCount = current.discount_pax_count;

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
        discount_pax_count: discount_pax_count ?? null,
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
      // Persist pax_count for both "package" and "all" scopes.
      effectiveDiscountPaxCount =
        hasDiscount &&
        discount_pax_count !== undefined &&
        discount_pax_count !== null &&
        discount_pax_count !== ""
          ? Number(discount_pax_count)
          : null;

      // When scope is "package" and a tier is attached, verify the tier
      // exists in the target package's price list before saving.
      const scopedToPackage =
        hasDiscount && String(discount_scope ?? "").trim() === "package";
      if (scopedToPackage && effectiveDiscountPaxCount != null) {
        const [tierRows] = await pool.query(
          "SELECT pax_count FROM package_pricing WHERE package_id = ? AND pax_count = ?",
          [effectiveDiscountPackageId, effectiveDiscountPaxCount],
        );
        if (tierRows.length === 0) {
          return res.status(400).json({
            error: {
              message:
                "The selected guest count tier is not available for this package.",
            },
          });
        }
      }
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

    // Publishing (draft -> published) is only allowed when the publish date is
    // not in the past — an announcement going live must be dated today or
    // later. Already-published announcements are exempt, since editing their
    // content legitimately keeps an older publish date.
    const isPublishing =
      effectiveStatus === "published" && current.status !== "published";
    if (isPublishing) {
      const effectivePublishDate = publish_date || current.publish_date;
      if (
        new Date(effectivePublishDate) <
        new Date(getPhilippineDateTimeString())
      ) {
        return res.status(400).json({
          error: {
            message:
              "Publish date cannot be earlier than the current date and time.",
          },
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
           discount_package_id = ?, discount_pax_count = ?
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
        effectiveDiscountPaxCount,
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
