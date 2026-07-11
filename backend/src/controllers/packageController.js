import { pool } from "../db/pool.js";

export async function getPackages(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE status = 'Active' ORDER BY package_name"
    );
    
    // Fetch pricing for all packages
    const packagesWithPricing = await Promise.all(
      rows.map(async (pkg) => {
        const [pricingRows] = await pool.query(
          "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
          [pkg.package_id]
        );
        return {
          ...pkg,
          pricing: pricingRows
        };
      })
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
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Package not found" },
      });
    }
    
    // Fetch pricing for this package
    const [pricingRows] = await pool.query(
      "SELECT pax_count, price FROM package_pricing WHERE package_id = ? ORDER BY pax_count",
      [id]
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
      [packageId]
    );
    res.status(200).json({ pricing: rows });
  } catch (error) {
    console.error("Error fetching package pricing:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch package pricing" },
    });
  }
}

export async function getMenuCategories(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM menu_categories WHERE status = 'Active' ORDER BY display_order, category_name"
    );
    res.status(200).json({ categories: rows });
  } catch (error) {
    console.error("Error fetching menu categories:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch menu categories" },
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
       ORDER BY mc.display_order, mc.category_name, mi.item_name`
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
      [categoryId]
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
      "SELECT * FROM event_types WHERE status = 'Active' ORDER BY type_name"
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
      "SELECT * FROM venue_setups WHERE status = 'Active' ORDER BY setup_name"
    );
    res.status(200).json({ venueSetups: rows });
  } catch (error) {
    console.error("Error fetching venue setups:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch venue setups" },
    });
  }
}