import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";

/**
 * GET /api/announcements/public
 * Returns published, non-expired announcements for the public landing page.
 */
export async function getPublicAnnouncements(req, res, next) {
  try {
    const [announcements] = await pool.query(
      `SELECT id, title, content, publish_date, expiration_date, image_url, created_at
       FROM announcements
       WHERE status = 'published'
         AND publish_date <= NOW()
         AND (expiration_date IS NULL OR expiration_date >= NOW())
       ORDER BY publish_date DESC, created_at DESC`,
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
    const [announcements] = await pool.query(
      `SELECT id, title, content, status, publish_date, expiration_date,
              image_url, image_public_id, created_at, updated_at
       FROM announcements
       ORDER BY created_at DESC`,
    );

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
    const { title, content, status, publish_date, expiration_date } = req.body;

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

    // Validate publish_date is not in the past
    const publishDateTime = new Date(publish_date);
    const currentDateTime = new Date();
    if (publishDateTime < currentDateTime) {
      return res
        .status(400)
        .json({ error: { message: "Publish date cannot be in the past." } });
    }

    // Validate expiration_date is after publish_date
    if (expiration_date) {
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
      `INSERT INTO announcements (title, content, status, publish_date, expiration_date, image_url, image_public_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        content.trim(),
        status || "draft",
        publish_date,
        expiration_date || null,
        imageUrl,
        imagePublicId,
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

    // Validate publish_date is not in the past
    if (publish_date) {
      const publishDateTime = new Date(publish_date);
      const currentDateTime = new Date();
      if (publishDateTime < currentDateTime) {
        return res
          .status(400)
          .json({ error: { message: "Publish date cannot be in the past." } });
      }
    }

    // Validate expiration_date is after publish_date
    if (expiration_date && publish_date) {
      const expirationDateTime = new Date(expiration_date);
      const publishDateTime = new Date(publish_date);
      if (expirationDateTime <= publishDateTime) {
        return res
          .status(400)
          .json({
            error: { message: "Expiration date must be after publish date." },
          });
      }
    }

    const current = existing[0];
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
           expiration_date = ?, image_url = ?, image_public_id = ?
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
