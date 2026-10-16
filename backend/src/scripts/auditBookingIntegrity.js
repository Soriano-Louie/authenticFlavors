// Read-only production readiness report. Run from backend so dotenv finds .env.
import { pool } from '../db/pool.js';

try {
  const [financial] = await pool.query(`SELECT b.booking_id, b.booking_status, b.total_price,
    COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid,
    COALESCE(SUM(CASE WHEN p.payment_status IN ('Pending','Overdue','Rejected','For_Verification') THEN p.amount ELSE 0 END), 0) AS outstanding,
    SUM(p.payment_status = 'Cancelled') AS cancelled_installments
    FROM bookings b LEFT JOIN payments p ON p.booking_id = b.booking_id AND p.payment_type != 'CancellationCharge'
    WHERE b.booking_status NOT IN ('Cancelled', 'Rejected')
    GROUP BY b.booking_id
    HAVING ABS(total_price - paid - outstanding) > 0.01 OR (b.booking_status = 'Completed' AND cancelled_installments > 0)`);
  const [legacyPricing] = await pool.query(`SELECT booking_id FROM bookings
    WHERE booking_status IN ('Pending','Reserved','Confirmed') AND
    (booking_summary IS NULL OR JSON_EXTRACT(booking_summary, '$.pricing_snapshot') IS NULL)`);
  const [legacyReceipts] = await pool.query(`SELECT payment_id FROM payments WHERE receipt_url IS NOT NULL
    AND (receipt_public_id IS NULL OR receipt_public_id NOT LIKE 'authentic_flavors/private_receipts/%')`);
  const [[timezone]] = await pool.query('SELECT @@session.time_zone AS session_timezone');
  const [tls] = await pool.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  console.log(JSON.stringify({ financialReview: financial, pricingReview: legacyPricing,
    legacyReceiptMigration: legacyReceipts, ...timezone, tlsEnabled: Boolean(tls[0]?.Value) }, null, 2));
} finally { await pool.end(); }
