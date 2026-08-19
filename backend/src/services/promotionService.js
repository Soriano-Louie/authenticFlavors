import { pool } from "../db/pool.js";
import { getPhilippineDateTimeString } from "../utils/timezone.js";

/**
 * Discount-resolution rules (single source of truth):
 *  - Only announcements that are `published` and live right now (Philippine
 *    clock) are eligible: publish_date <= now AND (expiration is null OR
 *    expiration >= now).
 *  - A package-specific discount beats an "all packages" discount.
 *  - Among equally-scoped candidates, the larger discount wins.
 *  - Ties resolve to the most recently created announcement.
 * Returns null when nothing applies, so callers keep today's behavior.
 */
export async function getActiveDiscount(packageId) {
  const nowPH = getPhilippineDateTimeString();
  const [rows] = await pool.query(
    `SELECT id, discount_type, discount_value, discount_scope, discount_package_id
     FROM announcements
     WHERE status = 'published'
       AND discount_type IS NOT NULL
       AND discount_value IS NOT NULL
       AND discount_value > 0
       AND publish_date <= ?
       AND (expiration_date IS NULL OR expiration_date >= ?)
       AND (discount_scope = 'all' OR discount_package_id = ?)
     ORDER BY
       CASE WHEN discount_scope = 'package' THEN 0 ELSE 1 END ASC,
       discount_value DESC,
       id DESC
     LIMIT 1`,
    [nowPH, nowPH, packageId],
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    type: row.discount_type,
    value: Number(row.discount_value),
    scope: row.discount_scope,
    package_id: row.discount_package_id ?? null,
    announcement_id: row.id,
  };
}

/**
 * Apply a discount to a full total (package tier price + menu surcharges) and
 * return the new total. Percentage is applied to the full total; fixed is
 * simply subtracted and floored at 0. The discount can never exceed the total.
 */
export function applyDiscount(total, discount) {
  if (!discount || discount.value <= 0) return total;
  const amount =
    discount.type === "percentage"
      ? Math.round(total * (discount.value / 100) * 100) / 100
      : Math.min(discount.value, total);
  return Math.max(0, total - amount);
}

/**
 * Convenience: the exact discount amount that applyDiscount() removed, for
 * storing on the booking row alongside the discounted total.
 */
export function discountAmount(total, discount) {
  if (!discount || discount.value <= 0) return 0;
  return Math.max(0, total - applyDiscount(total, discount));
}