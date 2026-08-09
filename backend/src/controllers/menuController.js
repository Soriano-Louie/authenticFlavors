import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";

// ─── Admin: Menu Categories CRUD ─────────────────────────────────────

export async function adminGetCategories(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM menu_categories ORDER BY display_order, category_name",
    );
    res.status(200).json({ categories: rows });
  } catch (error) {
    console.error("Error fetching menu categories:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch menu categories",
      },
    });
  }
}

export async function adminCreateCategory(req, res) {
  try {
    const { category_name, description, display_order, status } = req.body;

    if (!category_name || !category_name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Category name is required.",
        },
      });
    }

    // Prevent duplicate active category names (case-insensitive, trimmed)
    const [dupName] = await pool.query(
      "SELECT category_id FROM menu_categories WHERE LOWER(TRIM(category_name)) = LOWER(?) AND status = 'Active' LIMIT 1",
      [category_name.trim()],
    );
    if (dupName.length > 0) {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_CATEGORY",
          message: "A menu category with this name already exists.",
        },
      });
    }

    const [result] = await pool.query(
      "INSERT INTO menu_categories (category_name, description, display_order, status) VALUES (?, ?, ?, ?)",
      [
        category_name.trim(),
        description || null,
        display_order ? Number(display_order) : 0,
        status || "Active",
      ],
    );

    const [rows] = await pool.query(
      "SELECT * FROM menu_categories WHERE category_id = ?",
      [result.insertId],
    );

    res.status(201).json({ category: rows[0] });
  } catch (error) {
    console.error("Error creating menu category:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to create menu category.",
      },
    });
  }
}

export async function adminUpdateCategory(req, res) {
  try {
    const { id } = req.params;
    const { category_name, description, display_order, status } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM menu_categories WHERE category_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Category not found." },
      });
    }

    // Prevent renaming to a duplicate category name (case-insensitive, trimmed)
    if (category_name !== undefined && category_name.trim()) {
      const [dupName] = await pool.query(
        "SELECT category_id FROM menu_categories WHERE LOWER(TRIM(category_name)) = LOWER(?) AND category_id != ? LIMIT 1",
        [category_name.trim(), id],
      );
      if (dupName.length > 0) {
        return res.status(409).json({
          error: {
            code: "DUPLICATE_CATEGORY",
            message: "A menu category with this name already exists.",
          },
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (category_name !== undefined) {
      updateFields.push("category_name = ?");
      updateValues.push(category_name.trim() || existing[0].category_name);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      updateValues.push(description || null);
    }
    if (display_order !== undefined) {
      updateFields.push("display_order = ?");
      updateValues.push(Number(display_order));
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await pool.query(
        `UPDATE menu_categories SET ${updateFields.join(", ")} WHERE category_id = ?`,
        updateValues,
      );
    }

    const [rows] = await pool.query(
      "SELECT * FROM menu_categories WHERE category_id = ?",
      [id],
    );

    res.status(200).json({ category: rows[0] });
  } catch (error) {
    console.error("Error updating menu category:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to update menu category.",
      },
    });
  }
}

export async function adminDeleteCategory(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM menu_categories WHERE category_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Category not found." },
      });
    }

    await pool.query(
      "UPDATE menu_categories SET status = 'Inactive' WHERE category_id = ?",
      [id],
    );

    res.status(200).json({ message: "Category deleted successfully." });
  } catch (error) {
    console.error("Error deleting menu category:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to delete menu category.",
      },
    });
  }
}

// ─── Admin: Menu Items CRUD ──────────────────────────────────────────

export async function adminGetMenuItems(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT mi.*, mc.category_name 
       FROM menu_items mi 
       JOIN menu_categories mc ON mi.category_id = mc.category_id 
       ORDER BY mc.display_order, mc.category_name, mi.item_name`,
    );
    res.status(200).json({ items: rows });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch menu items",
      },
    });
  }
}

export async function adminCreateMenuItem(req, res) {
  try {
    const {
      category_id,
      item_name,
      description,
      additional_price,
      availability_status,
    } = req.body;

    if (!category_id || !item_name || !item_name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Category and item name are required.",
        },
      });
    }

    let imageUrl = null;

    // Upload image if provided
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, "menu_items");
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(500).json({
          error: { code: "UPLOAD_ERROR", message: "Failed to upload image." },
        });
      }
    }

    const [result] = await pool.query(
      "INSERT INTO menu_items (category_id, item_name, description, additional_price, availability_status, image) VALUES (?, ?, ?, ?, ?, ?)",
      [
        Number(category_id),
        item_name.trim(),
        description || null,
        additional_price ? Number(additional_price) : 0,
        availability_status || "Active",
        imageUrl,
      ],
    );

    const [rows] = await pool.query(
      "SELECT * FROM menu_items WHERE menu_item_id = ?",
      [result.insertId],
    );

    res.status(201).json({ item: rows[0] });
  } catch (error) {
    console.error("Error creating menu item:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to create menu item.",
      },
    });
  }
}

export async function adminUpdateMenuItem(req, res) {
  try {
    const { id } = req.params;
    const {
      category_id,
      item_name,
      description,
      additional_price,
      availability_status,
    } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM menu_items WHERE menu_item_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Menu item not found." },
      });
    }

    const currentItem = existing[0];
    let imageUrl = currentItem.image;

    // Handle image upload/replacement
    if (req.file) {
      try {
        if (currentItem.image && currentItem.image.includes("cloudinary")) {
          const urlParts = currentItem.image.split("/");
          const filename = urlParts[urlParts.length - 1]?.split(".")[0];
          if (filename) {
            const oldPublicId = `authentic_flavors/menu_items/${filename}`;
            await deleteFromCloudinary(oldPublicId).catch(() => {});
          }
        }
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "menu_items",
        );
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(500).json({
          error: { code: "UPLOAD_ERROR", message: "Failed to upload image." },
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (category_id !== undefined) {
      updateFields.push("category_id = ?");
      updateValues.push(Number(category_id));
    }
    if (item_name !== undefined) {
      updateFields.push("item_name = ?");
      updateValues.push(item_name.trim() || currentItem.item_name);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      updateValues.push(description || null);
    }
    if (additional_price !== undefined) {
      updateFields.push("additional_price = ?");
      updateValues.push(Number(additional_price));
    }
    if (availability_status !== undefined) {
      updateFields.push("availability_status = ?");
      updateValues.push(availability_status);
    }
    if (req.file) {
      updateFields.push("image = ?");
      updateValues.push(imageUrl);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await pool.query(
        `UPDATE menu_items SET ${updateFields.join(", ")} WHERE menu_item_id = ?`,
        updateValues,
      );
    }

    const [rows] = await pool.query(
      "SELECT * FROM menu_items WHERE menu_item_id = ?",
      [id],
    );

    res.status(200).json({ item: rows[0] });
  } catch (error) {
    console.error("Error updating menu item:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to update menu item.",
      },
    });
  }
}

export async function adminDeleteMenuItem(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM menu_items WHERE menu_item_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Menu item not found." },
      });
    }

    await pool.query(
      "UPDATE menu_items SET availability_status = 'Inactive' WHERE menu_item_id = ?",
      [id],
    );

    res.status(200).json({ message: "Menu item deleted successfully." });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to delete menu item.",
      },
    });
  }
}
