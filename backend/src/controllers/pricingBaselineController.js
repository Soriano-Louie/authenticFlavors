import { pool } from '../db/pool.js';
import { repriceMenu } from '../services/bookingRulesService.js';
import { httpError } from '../utils/httpError.js';

export async function savePricingBaseline(req, res) {
  let db;
  try {
    const { base_price, discount_type, discount_value, items, review_note } = req.body;
    const validMoney = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0;
    if (!validMoney(base_price) || !Array.isArray(items) || !items.length ||
        typeof review_note !== 'string' || review_note.trim().length < 10 || review_note.length > 1000 ||
        !['none', 'fixed', 'percentage'].includes(discount_type) || !validMoney(discount_value) ||
        (discount_type === 'percentage' && Number(discount_value) > 100)) {
      throw httpError(400, 'VALIDATION_ERROR', 'Provide the agreed base price, item surcharges, discount, and a review note of at least 10 characters.');
    }
    db = await pool.getConnection();
    await db.beginTransaction();
    const [rows] = await db.query('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE', [req.params.id]);
    const booking = rows[0];
    if (!booking) throw httpError(404, 'NOT_FOUND', 'Booking not found.');
    const summary = typeof booking.booking_summary === 'string' ? JSON.parse(booking.booking_summary) : (booking.booking_summary || {});
    if (summary.pricing_snapshot) throw httpError(409, 'ALREADY_REVIEWED', 'This booking already has an agreed pricing baseline.');
    const [selected] = await db.query(`SELECT mi.menu_item_id, mi.item_name FROM booking_menu_selections bms
      JOIN menu_items mi ON mi.menu_item_id = bms.menu_item_id WHERE bms.booking_id = ?`, [booking.booking_id]);
    if (items.length !== selected.length || new Set(items.map(i => i.item_name)).size !== selected.length ||
        selected.some(i => !items.some(p => p.item_name === i.item_name && validMoney(p.additional_price)))) {
      throw httpError(400, 'VALIDATION_ERROR', 'Provide the original surcharge for every selected menu item.');
    }
    const snapshot = { base_price: Number(base_price),
      discount: discount_type === 'none' ? null : { type: discount_type, value: Number(discount_value) },
      items: Object.fromEntries(selected.map(i => [i.menu_item_id, Number(items.find(p => p.item_name === i.item_name).additional_price)])),
      reviewed_by: Number(req.auth.sub), review_note: review_note.trim(), reviewed_at: new Date().toISOString() };
    if (Math.abs(repriceMenu(snapshot, selected).total - Number(booking.total_price)) > 0.01) {
      throw httpError(409, 'TOTAL_MISMATCH', 'The reviewed prices must exactly match the existing agreed booking total.');
    }
    summary.pricing_snapshot = snapshot;
    await db.query('UPDATE bookings SET booking_summary = ? WHERE booking_id = ?', [JSON.stringify(summary), booking.booking_id]);
    await db.query(`INSERT INTO booking_history (booking_id, change_type, description, previous_state, new_state, changed_by)
      VALUES (?, 'PRICING_BASELINE', ?, ?, ?, ?)`, [booking.booking_id, review_note.trim(),
      JSON.stringify({ total_price: booking.total_price }), JSON.stringify(snapshot), Number(req.auth.sub)]);
    await db.commit();
    return res.json({ message: 'Pricing baseline recorded. Menu changes can now be reviewed.' });
  } catch (error) {
    await db?.rollback();
    throw error;
  } finally { db?.release(); }
}
