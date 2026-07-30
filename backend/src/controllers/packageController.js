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

export async function getPackages(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE status = 'Active' ORDER BY package_name",
    );

    // Fetch pricing for all packages
    const packagesWithPricing = await Promise.all(
      rows.map(async (pkg) => {
        const [pricingRows] = await pool.query(
          "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
          [pkg.package_id],
        );
        return {
          ...pkg,
          pricing: pricingRows,
        };
      }),
    );

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

    const packageData = rows[0];
    packageData.pricing = pricingRows;

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
      "SELECT * FROM menu_items WHERE category_id = ? AND availability_status = 'Active' ORDER BY item_name",
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
        return {
          ...pkg,
          pricing: pricingRows,
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
    const { package_name, description, max_pax, pricing } = req.body;

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

    // Insert package
    const [result] = await pool.query(
      "INSERT INTO packages (package_name, description, max_pax, image, status) VALUES (?, ?, ?, ?, 'Active')",
      [package_name.trim(), description || null, Number(max_pax), imageUrl],
    );

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

    // Fetch the created package with pricing
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [packageId],
    );
    const [pricingRows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [packageId],
    );

    const newPackage = rows[0];
    newPackage.pricing = pricingRows;

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
    const { package_name, description, max_pax, status, pricing } = req.body;

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

    let imageUrl = currentPackage.image;
    let imagePublicId = null;

    // Handle image upload/replacement
    if (req.file) {
      try {
        // Delete old image from Cloudinary if it exists and is a Cloudinary URL
        if (
          currentPackage.image &&
          currentPackage.image.includes("cloudinary")
        ) {
          // Extract public_id from URL (last part before extension)
          const urlParts = currentPackage.image.split("/");
          const filename = urlParts[urlParts.length - 1]?.split(".")[0];
          if (filename) {
            const oldPublicId = `authentic_flavors/packages/${filename}`;
            await deleteFromCloudinary(oldPublicId).catch(() => {});
          }
        }

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
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await pool.query(
        `UPDATE packages SET ${updateFields.join(", ")} WHERE package_id = ?`,
        updateValues,
      );
    }

    // Update pricing tiers if provided
    if (pricing) {
      let pricingArray;
      try {
        pricingArray =
          typeof pricing === "string" ? JSON.parse(pricing) : pricing;
      } catch {
        pricingArray = [];
      }

      if (Array.isArray(pricingArray)) {
        // Delete existing pricing and re-insert
        await pool.query("DELETE FROM package_pricing WHERE package_id = ?", [
          id,
        ]);

        for (const tier of pricingArray) {
          if (tier.pax_count && tier.price) {
            await pool.query(
              "INSERT INTO package_pricing (package_id, pax_count, price) VALUES (?, ?, ?)",
              [Number(id), Number(tier.pax_count), Number(tier.price)],
            );
          }
        }
      }
    }

    // Fetch updated package with pricing
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ?",
      [id],
    );
    const [pricingRows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [id],
    );

    const updatedPackage = rows[0];
    updatedPackage.pricing = pricingRows;

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

    res.status(200).json({ message: "Package deleted successfully." });
  } catch (error) {
    console.error("Error deleting package:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to delete package." },
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

// Upcoming Events
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
       WHERE b.booking_status = 'Confirmed' 
       AND b.event_date >= CURDATE()
       ORDER BY b.event_date ASC, b.start_time ASC`,
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
