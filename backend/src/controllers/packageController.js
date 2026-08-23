import { pool } from "../db/pool.js";
import {
  getEventsHostedCount,
  getHappyGuestsCount,
  getAverageRating,
} from "../services/statisticsService.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";
import { ACTIVE_BOOKING_STATUSES } from "../services/availabilityService.js";

export async function getPackages(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE status = 'Active' ORDER BY package_name",
    );

    let packagesWithPricing = [];

    if (rows.length > 0) {
      const ids = rows.map((pkg) => pkg.package_id);
      const placeholders = ids.map(() => "?").join(",");

      // Batch-fetch pricing and inclusions for ALL packages in two queries
      // instead of two queries per package (avoids the N+1 problem).
      const [pricingRows] = await pool.query(
        `SELECT package_id, pax_count, price FROM package_pricing
         WHERE package_id IN (${placeholders}) ORDER BY pax_count`,
        ids,
      );

      const [inclusionRows] = await pool.query(
        `SELECT pmi.package_id, pmi.inclusion_id, pmi.menu_item_id, pmi.display_order, mi.item_name, mi.category_id, mc.category_name
         FROM package_menu_inclusions pmi
         JOIN menu_items mi ON pmi.menu_item_id = mi.menu_item_id
         JOIN menu_categories mc ON mi.category_id = mc.category_id
         WHERE pmi.package_id IN (${placeholders})
         ORDER BY pmi.display_order, mc.display_order, mc.category_name, mi.item_name`,
        ids,
      );

      const pricingByPackage = new Map();
      for (const row of pricingRows) {
        const list = pricingByPackage.get(row.package_id);
        if (list) list.push({ pax_count: row.pax_count, price: row.price });
        else pricingByPackage.set(row.package_id, [{ pax_count: row.pax_count, price: row.price }]);
      }

      const inclusionsByPackage = new Map();
      for (const row of inclusionRows) {
        const entry = {
          inclusion_id: row.inclusion_id,
          menu_item_id: row.menu_item_id,
          display_order: row.display_order,
          item_name: row.item_name,
          category_id: row.category_id,
          category_name: row.category_name,
        };
        const list = inclusionsByPackage.get(row.package_id);
        if (list) list.push(entry);
        else inclusionsByPackage.set(row.package_id, [entry]);
      }

      // Count valid bookings per package to identify "Most Picked" packages.
      // Only accepted/completed bookings count as real selections; pending,
      // cancelled, and rejected bookings are excluded.
      const [bookingCountRows] = await pool.query(
        `SELECT package_id, COUNT(*) AS selection_count
         FROM bookings
         WHERE booking_status IN ('Confirmed', 'Reserved', 'Completed')
           AND package_id IN (${placeholders})
         GROUP BY package_id`,
        ids,
      );

      const selectionCountByPackage = new Map();
      let maxSelections = 0;
      let mostPickedPackageId = null;
      for (const row of bookingCountRows) {
        selectionCountByPackage.set(row.package_id, row.selection_count);
        if (row.selection_count > maxSelections) {
          maxSelections = row.selection_count;
          mostPickedPackageId = row.package_id;
        } else if (
          row.selection_count === maxSelections &&
          maxSelections > 0 &&
          (mostPickedPackageId === null ||
            row.package_id < mostPickedPackageId)
        ) {
          // Ties are broken deterministically: lowest package_id wins, so the
          // "most picked" highlight never flips arbitrarily between packages.
          mostPickedPackageId = row.package_id;
        }
      }

      packagesWithPricing = rows.map((pkg) => {
        const selectionCount =
          selectionCountByPackage.get(pkg.package_id) ?? 0;
        return {
          ...pkg,
          pricing: pricingByPackage.get(pkg.package_id) ?? [],
          menu_inclusions: inclusionsByPackage.get(pkg.package_id) ?? [],
          selection_count: selectionCount,
          is_most_picked:
            maxSelections > 0 && pkg.package_id === mostPickedPackageId,
        };
      });
    }

    res.status(200).json({ packages: packagesWithPricing });
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch packages" },
    });
  }
}

export async function getPackageById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ? AND status = 'Active'",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Package not found" },
      });
    }

    // Fetch pricing for this package
    const [pricingRows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [id],
    );

    const [inclusionRows] = await pool.query(
      `SELECT pmi.inclusion_id, pmi.menu_item_id, pmi.display_order, mi.item_name, mi.category_id, mc.category_name
       FROM package_menu_inclusions pmi
       JOIN menu_items mi ON pmi.menu_item_id = mi.menu_item_id
       JOIN menu_categories mc ON mi.category_id = mc.category_id
       WHERE pmi.package_id = ? ORDER BY pmi.display_order, mc.display_order, mc.category_name, mi.item_name`,
      [id],
    );

    const packageData = rows[0];
    packageData.pricing = pricingRows;
    packageData.menu_inclusions = inclusionRows;

    res.status(200).json({ package: packageData });
  } catch (error) {
    console.error("Error fetching package:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch package" },
    });
  }
}

export async function getPackagePricing(req, res) {
  try {
    const { packageId } = req.params;
    const [rows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [packageId],
    );
    res.status(200).json({ pricing: rows });
  } catch (error) {
    console.error("Error fetching package pricing:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch package pricing",
      },
    });
  }
}

export async function getMenuCategories(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM menu_categories WHERE status = 'Active' ORDER BY display_order, category_name",
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

export async function getMenuItems(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT mi.*, mc.category_name 
       FROM menu_items mi 
       JOIN menu_categories mc ON mi.category_id = mc.category_id 
       WHERE mi.availability_status = 'Active' AND mc.status = 'Active'
       ORDER BY mc.display_order, mc.category_name, mi.item_name`,
    );
    res.status(200).json({ items: rows });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch menu items" },
    });
  }
}

export async function getMenuItemsByCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const [rows] = await pool.query(
      `SELECT mi.* FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.category_id
       WHERE mi.category_id = ?
         AND mi.availability_status = 'Active'
         AND mc.status = 'Active'
       ORDER BY mi.item_name`,
      [categoryId],
    );
    res.status(200).json({ items: rows });
  } catch (error) {
    console.error("Error fetching menu items by category:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch menu items" },
    });
  }
}

export async function getEventTypes(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM event_types WHERE status = 'Active' ORDER BY type_name",
    );
    res.status(200).json({ eventTypes: rows });
  } catch (error) {
    console.error("Error fetching event types:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch event types" },
    });
  }
}

export async function getVenueSetups(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM venue_setups WHERE status = 'Active' ORDER BY setup_name",
    );
    res.status(200).json({ venueSetups: rows });
  } catch (error) {
    console.error("Error fetching venue setups:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch venue setups",
      },
    });
  }
}

// ─── Admin: Get All Packages (including inactive) ───────────────────
export async function getAllPackages(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM packages ORDER BY package_name",
    );

    const packagesWithPricing = await Promise.all(
      rows.map(async (pkg) => {
        const [pricingRows] = await pool.query(
          "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
          [pkg.package_id],
        );
        const [inclusionRows] = await pool.query(
          `SELECT pmi.inclusion_id, pmi.menu_item_id, pmi.display_order, mi.item_name, mi.category_id, mc.category_name
           FROM package_menu_inclusions pmi
           JOIN menu_items mi ON pmi.menu_item_id = mi.menu_item_id
           JOIN menu_categories mc ON mi.category_id = mc.category_id
           WHERE pmi.package_id = ? ORDER BY pmi.display_order, mc.display_order, mc.category_name, mi.item_name`,
          [pkg.package_id],
        );
        return {
          ...pkg,
          pricing: pricingRows,
          menu_inclusions: inclusionRows,
        };
      }),
    );

    res.status(200).json({ packages: packagesWithPricing });
  } catch (error) {
    console.error("Error fetching all packages:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch packages" },
    });
  }
}

// ─── Admin: Create Package ──────────────────────────────────────────
export async function createPackage(req, res) {
  try {
    const { package_name, description, max_pax, pricing, menu_inclusions } =
      req.body;

    // Validate required fields
    if (!package_name || !package_name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Package name is required.",
        },
      });
    }
    if (!max_pax || isNaN(Number(max_pax)) || Number(max_pax) < 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Valid max pax is required.",
        },
      });
    }
    if (Number(max_pax) > 70) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Maximum pax cannot exceed 70 (venue capacity).",
        },
      });
    }

    // Prevent duplicate active package names (case-insensitive, trimmed)
    const [dupName] = await pool.query(
      "SELECT package_id FROM packages WHERE LOWER(TRIM(package_name)) = LOWER(?) AND status = 'Active' LIMIT 1",
      [package_name.trim()],
    );
    if (dupName.length > 0) {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_PACKAGE",
          message: "A package with this name already exists.",
        },
      });
    }

    let imageUrl = null;
    let imagePublicId = null;

    // Upload image if provided
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "packages",
        );
        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(500).json({
          error: { code: "UPLOAD_ERROR", message: "Failed to upload image." },
        });
      }
    }

    // Insert package (image_public_id is stored so the exact file can be
    // deleted from Cloudinary later instead of guessing from the URL).
    let result;
    try {
      [result] = await pool.query(
        "INSERT INTO packages (package_name, description, max_pax, image, image_public_id, status) VALUES (?, ?, ?, ?, ?, 'Active')",
        [
          package_name.trim(),
          description || null,
          Number(max_pax),
          imageUrl,
          imagePublicId,
        ],
      );
    } catch (insertError) {
      // The image was uploaded before the row was saved — delete it so it
      // doesn't become an orphaned file if the insert fails.
      if (imagePublicId) {
        await deleteFromCloudinary(imagePublicId).catch(() => {});
      }
      throw insertError;
    }

    const packageId = result.insertId;

    // Insert pricing tiers if provided
    if (pricing) {
      let pricingArray;
      try {
        pricingArray =
          typeof pricing === "string" ? JSON.parse(pricing) : pricing;
      } catch {
        pricingArray = [];
      }

      if (Array.isArray(pricingArray) && pricingArray.length > 0) {
        for (const tier of pricingArray) {
          if (tier.pax_count && tier.price) {
            await pool.query(
              "INSERT INTO package_pricing (package_id, pax_count, price) VALUES (?, ?, ?)",
              [packageId, Number(tier.pax_count), Number(tier.price)],
            );
          }
        }
      }
    }

    // Insert menu inclusions if provided
    if (menu_inclusions) {
      let inclusionsArray;
      try {
        inclusionsArray =
          typeof menu_inclusions === "string"
            ? JSON.parse(menu_inclusions)
            : menu_inclusions;
      } catch {
        inclusionsArray = [];
      }

      if (Array.isArray(inclusionsArray) && inclusionsArray.length > 0) {
        // Normalize to support both plain numbers [1,2,3] and objects
        // [{ menu_item_id: 1 }, ...] so the API is tolerant to any caller.
        const normalizedIds = inclusionsArray
          .map((inc) =>
            typeof inc === "object" && inc !== null
              ? Number(inc.menu_item_id)
              : Number(inc),
          )
          .filter((mid) => !Number.isNaN(mid));

        for (let i = 0; i < normalizedIds.length; i++) {
          await pool.query(
            "INSERT INTO package_menu_inclusions (package_id, menu_item_id, display_order) VALUES (?, ?, ?)",
            [packageId, normalizedIds[i], i],
          );
        }
      }
    }

    // Fetch the created package with pricing and inclusions
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [packageId],
    );
    const [pricingRows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [packageId],
    );
    const [inclusionRows] = await pool.query(
      `SELECT pmi.inclusion_id, pmi.menu_item_id, pmi.display_order, mi.item_name, mi.category_id, mc.category_name
       FROM package_menu_inclusions pmi
       JOIN menu_items mi ON pmi.menu_item_id = mi.menu_item_id
       JOIN menu_categories mc ON mi.category_id = mc.category_id
       WHERE pmi.package_id = ? ORDER BY pmi.display_order, mc.display_order, mc.category_name, mi.item_name`,
      [packageId],
    );

    const newPackage = rows[0];
    newPackage.pricing = pricingRows;
    newPackage.menu_inclusions = inclusionRows;

    res.status(201).json({ package: newPackage });
  } catch (error) {
    console.error("Error creating package:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to create package." },
    });
  }
}

// ─── Admin: Update Package ──────────────────────────────────────────
export async function updatePackage(req, res) {
  try {
    const { id } = req.params;
    const {
      package_name,
      description,
      max_pax,
      status,
      pricing,
      menu_inclusions,
    } = req.body;

    // Check package exists
    const [existing] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Package not found." },
      });
    }

    const currentPackage = existing[0];

    // Validate required fields
    if (package_name !== undefined && !package_name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Package name cannot be empty.",
        },
      });
    }
    if (
      max_pax !== undefined &&
      (isNaN(Number(max_pax)) || Number(max_pax) < 1)
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Valid max pax is required.",
        },
      });
    }
    if (max_pax !== undefined && Number(max_pax) > 70) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Maximum pax cannot exceed 70 (venue capacity).",
        },
      });
    }

    // Prevent renaming to a duplicate package name (case-insensitive, trimmed)
    if (package_name !== undefined) {
      const [dupName] = await pool.query(
        "SELECT package_id FROM packages WHERE LOWER(TRIM(package_name)) = LOWER(?) AND package_id != ? LIMIT 1",
        [package_name.trim(), id],
      );
      if (dupName.length > 0) {
        return res.status(409).json({
          error: {
            code: "DUPLICATE_PACKAGE",
            message: "A package with this name already exists.",
          },
        });
      }
    }

    let imageUrl = currentPackage.image;
    let imagePublicId = currentPackage.image_public_id || null;
    let newlyUploadedPublicId = null;

    // Resolve the old image's public_id so it can be deleted ONLY after the new
    // one is safely saved. Prefer the stored id; fall back to deriving it from
    // the Cloudinary URL for rows created before image_public_id existed.
    let oldImagePublicId = null;
    if (
      currentPackage.image &&
      currentPackage.image.includes("cloudinary")
    ) {
      const urlParts = currentPackage.image.split("/");
      const filename = urlParts[urlParts.length - 1]?.split(".")[0];
      oldImagePublicId =
        currentPackage.image_public_id ||
        (filename ? `authentic_flavors/packages/${filename}` : null);
    }

    // Handle image upload/replacement: upload the NEW file first, save it to
    // the database, and only then delete the old file. If the database step
    // fails, the freshly uploaded file is removed so nothing is orphaned.
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "packages",
        );
        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
        newlyUploadedPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(500).json({
          error: { code: "UPLOAD_ERROR", message: "Failed to upload image." },
        });
      }
    }

    // Update package fields
    const updateFields = [];
    const updateValues = [];

    if (package_name !== undefined) {
      updateFields.push("package_name = ?");
      updateValues.push(package_name.trim());
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      updateValues.push(description || null);
    }
    if (max_pax !== undefined) {
      updateFields.push("max_pax = ?");
      updateValues.push(Number(max_pax));
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }
    if (req.file) {
      updateFields.push("image = ?");
      updateValues.push(imageUrl);
      updateFields.push("image_public_id = ?");
      updateValues.push(imagePublicId);
    }

    try {
      if (updateFields.length > 0) {
        updateValues.push(id);
        await pool.query(
          `UPDATE packages SET ${updateFields.join(", ")} WHERE package_id = ?`,
          updateValues,
        );
      }
    } catch (updateError) {
      // The new file was uploaded but the row never saved — remove it.
      if (newlyUploadedPublicId) {
        await deleteFromCloudinary(newlyUploadedPublicId).catch(() => {});
      }
      throw updateError;
    }

    // Only after the new image is committed to the database is the old file
    // removed (best-effort; a cleanup failure must not fail the request).
    if (req.file && oldImagePublicId) {
      await deleteFromCloudinary(oldImagePublicId).catch(() => {});
    }

    // Update pricing tiers and menu inclusions atomically. A present-but-empty
    // tier list means "delete all tiers" (the admin cleared them), so we use
    // `!== undefined` and let the empty array fall through to the delete path.
    // Both the tiers and the inclusions are replaced in ONE transaction so a
    // mid-way failure can never leave half-saved data.
    let pricingArray;
    if (pricing !== undefined && pricing !== null) {
      try {
        pricingArray =
          typeof pricing === "string" ? JSON.parse(pricing) : pricing;
      } catch {
        pricingArray = [];
      }
    }
    let inclusionsArray = undefined;
    if (menu_inclusions !== undefined && menu_inclusions !== null) {
      try {
        inclusionsArray =
          typeof menu_inclusions === "string"
            ? JSON.parse(menu_inclusions)
            : menu_inclusions;
      } catch {
        inclusionsArray = [];
      }
    }

    const pricingChanged =
      pricingArray !== undefined && Array.isArray(pricingArray);
    const inclusionsChanged =
      inclusionsArray !== undefined && Array.isArray(inclusionsArray);

    if (pricingChanged || inclusionsChanged) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        if (pricingChanged) {
          await connection.query(
            "DELETE FROM package_pricing WHERE package_id = ?",
            [id],
          );
          for (const tier of pricingArray) {
            if (tier.pax_count && tier.price) {
              await connection.query(
                "INSERT INTO package_pricing (package_id, pax_count, price) VALUES (?, ?, ?)",
                [Number(id), Number(tier.pax_count), Number(tier.price)],
              );
            }
          }
        }

        if (inclusionsChanged) {
          await connection.query(
            "DELETE FROM package_menu_inclusions WHERE package_id = ?",
            [id],
          );
          // Normalize to support both plain numbers [1,2,3] and objects
          // [{ menu_item_id: 1 }, ...] so the API is tolerant to any caller.
          const normalizedIds = inclusionsArray
            .map((inc) =>
              typeof inc === "object" && inc !== null
                ? Number(inc.menu_item_id)
                : Number(inc),
            )
            .filter((mid) => !Number.isNaN(mid));

          for (let i = 0; i < normalizedIds.length; i++) {
            await connection.query(
              "INSERT INTO package_menu_inclusions (package_id, menu_item_id, display_order) VALUES (?, ?, ?)",
              [Number(id), normalizedIds[i], i],
            );
          }
        }

        await connection.commit();
      } catch (tierError) {
        await connection.rollback();
        throw tierError;
      } finally {
        connection.release();
      }
    }

    // Fetch updated package with pricing and inclusions
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [id],
    );
    const [pricingRows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [id],
    );
    const [inclusionRows] = await pool.query(
      `SELECT pmi.inclusion_id, pmi.menu_item_id, pmi.display_order, mi.item_name, mi.category_id, mc.category_name
       FROM package_menu_inclusions pmi
       JOIN menu_items mi ON pmi.menu_item_id = mi.menu_item_id
       JOIN menu_categories mc ON mi.category_id = mc.category_id
       WHERE pmi.package_id = ? ORDER BY pmi.display_order, mc.display_order, mc.category_name, mi.item_name`,
      [id],
    );

    const updatedPackage = rows[0];
    updatedPackage.pricing = pricingRows;
    updatedPackage.menu_inclusions = inclusionRows;

    res.status(200).json({ package: updatedPackage });
  } catch (error) {
    console.error("Error updating package:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to update package." },
    });
  }
}

// ─── Admin: Delete Package (soft delete) ────────────────────────────
export async function deletePackage(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Package not found." },
      });
    }

    // Soft delete: set status to 'Inactive'
    await pool.query(
      "UPDATE packages SET status = 'Inactive' WHERE package_id = ?",
      [id],
    );

    res.status(200).json({ message: "Package deactivated successfully." });
  } catch (error) {
    console.error("Error deleting package:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to delete package." },
    });
  }
}

// ─── Admin: Delete Package Image ──────────────────────────────────────
export async function deletePackageImage(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Package not found." },
      });
    }

    const currentPackage = existing[0];

    if (!currentPackage.image) {
      return res.status(400).json({
        error: { code: "INVALID_STATE", message: "Package has no image to delete." },
      });
    }

    // Delete from Cloudinary if public_id exists
    if (currentPackage.image_public_id) {
      await deleteFromCloudinary(currentPackage.image_public_id).catch((err) => {
        console.error("Failed to delete image from Cloudinary:", err);
      });
    }

    // Clear image fields in database
    await pool.query(
      "UPDATE packages SET image = NULL, image_public_id = NULL WHERE package_id = ?",
      [id],
    );

    res.status(200).json({ message: "Package image deleted successfully." });
  } catch (error) {
    console.error("Error deleting package image:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to delete package image." },
    });
  }
}

// Homepage Statistics
export async function getHomepageStatistics(_req, res) {
  try {
    const eventsHosted = await getEventsHostedCount();
    const happyGuests = await getHappyGuestsCount();
    const averageRating = await getAverageRating();
    const yearsOfExcellence = 3;

    res.status(200).json({
      statistics: {
        eventsHosted,
        happyGuests,
        averageRating,
        yearsOfExcellence,
      },
    });
  } catch (error) {
    console.error("Error fetching homepage statistics:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch homepage statistics",
      },
    });
  }
}

// Upcoming events
export async function getUpcomingEvents(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT 
        b.booking_id,
        DATE_FORMAT(b.event_date, '%Y-%m-%d') as event_date,
        b.start_time,
        b.number_of_pax,
        b.booking_status,
        p.package_name,
        et.type_name as event_type
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       WHERE b.booking_status IN (?, ?)
       AND b.event_date >= CURDATE()
       ORDER BY b.event_date ASC, b.start_time ASC`,
      ACTIVE_BOOKING_STATUSES,
    );

    res.status(200).json({ events: rows });
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch upcoming events",
      },
    });
  }
}
