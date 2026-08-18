import { pool } from "./pool.js";
import { getOperatingHoursDisplay } from "../utils/operatingHours.js";

export async function seedDatabaseIfEmpty() {
  const connection = await pool.getConnection();
  try {
    // 0. Ensure amount_paid and remaining_balance exist on bookings table
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings'",
      [connection.config.database],
    );
    const columnNames = columns.map((c) => c.COLUMN_NAME);
    if (!columnNames.includes("amount_paid")) {
      await connection.query(
        "ALTER TABLE bookings ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0.00",
      );
      console.log("[MIGRATION] Added amount_paid to bookings table.");
    }
    if (!columnNames.includes("remaining_balance")) {
      await connection.query(
        "ALTER TABLE bookings ADD COLUMN remaining_balance DECIMAL(10,2) DEFAULT NULL",
      );
      console.log("[MIGRATION] Added remaining_balance to bookings table.");
    }

    // 0.6 Add cancellation tracking columns to bookings table
    const [cancellationColumns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings'",
      [connection.config.database],
    );
    const cancellationColumnNames = cancellationColumns.map(
      (c) => c.COLUMN_NAME,
    );
    const cancellationAlterations = [];
    if (!cancellationColumnNames.includes("cancellation_requested_at")) {
      cancellationAlterations.push(
        "ADD COLUMN cancellation_requested_at DATETIME NULL",
      );
    }
    if (!cancellationColumnNames.includes("cancellation_processed_at")) {
      cancellationAlterations.push(
        "ADD COLUMN cancellation_processed_at DATETIME NULL",
      );
    }
    if (!cancellationColumnNames.includes("cancellation_policy_applied")) {
      cancellationAlterations.push(
        "ADD COLUMN cancellation_policy_applied VARCHAR(50) NULL",
      );
    }
    if (!cancellationColumnNames.includes("amount_due_on_cancellation")) {
      cancellationAlterations.push(
        "ADD COLUMN amount_due_on_cancellation DECIMAL(10,2) DEFAULT 0.00",
      );
    }
    if (!cancellationColumnNames.includes("cancellation_notes")) {
      cancellationAlterations.push("ADD COLUMN cancellation_notes TEXT NULL");
    }
    if (cancellationAlterations.length > 0) {
      const alterSql = `ALTER TABLE bookings ${cancellationAlterations.join(", ")}`;
      await connection.query(alterSql);
      console.log(
        "[MIGRATION] Added cancellation tracking columns to bookings table:",
        cancellationAlterations.join(", "),
      );
    }

    const [aiRefColumn] = await connection.query(
      `SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'ai_booking_reference'`,
      [connection.config.database],
    );
    if (aiRefColumn.length > 0 && aiRefColumn[0].IS_NULLABLE === "NO") {
      await connection.query(
        "ALTER TABLE bookings MODIFY COLUMN ai_booking_reference INT DEFAULT NULL",
      );
      console.log("[MIGRATION] Made ai_booking_reference nullable.");
    }

    const [manualRefColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'booking_reference'`,
      [connection.config.database],
    );
    if (manualRefColumn.length === 0) {
      await connection.query(
        "ALTER TABLE bookings ADD COLUMN booking_reference VARCHAR(20) NULL",
      );
      console.log("[MIGRATION] Added booking_reference column.");
    }

    // 0.19 Enforce uniqueness on booking references at the DB level so two
    // bookings can never share a reference even if two requests race.
    const [refIndexes] = await connection.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'uq_booking_reference'`,
      [connection.config.database],
    );
    if (refIndexes.length === 0) {
      try {
        await connection.query(
          "ALTER TABLE bookings ADD UNIQUE KEY uq_booking_reference (booking_reference)",
        );
        console.log("[MIGRATION] Added unique index on booking_reference.");
      } catch (err) {
        console.warn(
          "[MIGRATION] Could not add unique index on booking_reference (duplicates may exist):",
          err.message,
        );
      }
    }

    const [aiRefIndexes] = await connection.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'uq_ai_booking_reference'`,
      [connection.config.database],
    );
    if (aiRefIndexes.length === 0) {
      try {
        await connection.query(
          "ALTER TABLE bookings ADD UNIQUE KEY uq_ai_booking_reference (ai_booking_reference)",
        );
        console.log("[MIGRATION] Added unique index on ai_booking_reference.");
      } catch (err) {
        console.warn(
          "[MIGRATION] Could not add unique index on ai_booking_reference (duplicates may exist):",
          err.message,
        );
      }
    }

    // 0.2 Ensure an index on bookings.event_date exists. The in-transaction
    // availability check (FOR UPDATE) needs it to take a scoped gap lock on a
    // single date instead of locking the whole table, and it speeds up all
    // occupancy/availability queries.
    const [eventDateIndexes] = await connection.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'event_date'
       LIMIT 1`,
      [connection.config.database],
    );
    if (eventDateIndexes.length === 0) {
      await connection.query(
        "ALTER TABLE bookings ADD INDEX idx_bookings_event_date (event_date)",
      );
      console.log("[MIGRATION] Added index on bookings.event_date.");
    }

    // 0.2 Add custom_event_type column to bookings table
    const [customEventTypeColumn] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'custom_event_type'`,
      [connection.config.database],
    );
    if (customEventTypeColumn.length === 0) {
      await connection.query(
        "ALTER TABLE bookings ADD COLUMN custom_event_type VARCHAR(255) DEFAULT NULL AFTER event_type_id",
      );
      console.log("[MIGRATION] Added custom_event_type column to bookings table.");
    }

    // 0.0 Ensure packages table has image column
    const [packageColumns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'packages'",
      [connection.config.database],
    );
    const packageColumnNames = packageColumns.map((c) => c.COLUMN_NAME);
    if (!packageColumnNames.includes("image")) {
      await connection.query(
        "ALTER TABLE packages ADD COLUMN image VARCHAR(500) DEFAULT NULL AFTER max_pax",
      );
      console.log("[MIGRATION] Added image column to packages table.");
    }
    if (!packageColumnNames.includes("description")) {
      await connection.query(
        "ALTER TABLE packages ADD COLUMN description TEXT DEFAULT NULL AFTER package_name",
      );
      console.log("[MIGRATION] Added description column to packages table.");
    }

    // 0.0.1 Ensure package_menu_inclusions table exists
    const [inclusionTableCheck] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'package_menu_inclusions'`,
      [connection.config.database],
    );
    if (inclusionTableCheck.length === 0) {
      await connection.query(`
        CREATE TABLE package_menu_inclusions (
          inclusion_id INT AUTO_INCREMENT PRIMARY KEY,
          package_id INT NOT NULL,
          menu_item_id INT NOT NULL,
          display_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
          FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE CASCADE,
          UNIQUE KEY unique_package_menu_item (package_id, menu_item_id),
          INDEX idx_package_order (package_id, display_order)
        )
      `);
      console.log("[MIGRATION] package_menu_inclusions table created.");
    }

    // 0.1 Create feedback table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        feedback_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT NULL,
        sentiment_status VARCHAR(20) DEFAULT 'Pending',
        sentiment_score DECIMAL(3,2) NULL,
        sentiment_summary TEXT NULL,
        key_topics JSON NULL,
        actionable_insights TEXT NULL,
        is_analyzed BOOLEAN DEFAULT FALSE,
        analyzed_at DATETIME NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE KEY unique_booking_feedback (booking_id)
      )
    `);
    console.log("[MIGRATION] feedback table ensured.");

    // Migration for feedback table columns if table already exists
    const [fbCols] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'feedback'",
      [connection.config.database],
    );
    const fbColNames = fbCols.map((c) => c.COLUMN_NAME);
    if (!fbColNames.includes("key_topics")) {
      await connection.query(
        "ALTER TABLE feedback ADD COLUMN key_topics JSON NULL AFTER sentiment_summary",
      );
      console.log("[MIGRATION] Added key_topics to feedback table.");
    }
    if (!fbColNames.includes("actionable_insights")) {
      await connection.query(
        "ALTER TABLE feedback ADD COLUMN actionable_insights TEXT NULL AFTER key_topics",
      );
      console.log("[MIGRATION] Added actionable_insights to feedback table.");
    }
    if (!fbColNames.includes("analyzed_at")) {
      await connection.query(
        "ALTER TABLE feedback ADD COLUMN analyzed_at DATETIME NULL AFTER is_analyzed",
      );
      console.log("[MIGRATION] Added analyzed_at to feedback table.");
    }

    // 0.2 Create payments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        payment_type ENUM('Reservation', 'DownPayment', 'FinalPayment', 'CancellationCharge') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        paymongo_checkout_id VARCHAR(255) NULL,
        paymongo_payment_id VARCHAR(255) NULL,
        payment_reference VARCHAR(255) NULL,
        payment_method VARCHAR(255) NULL,
        payment_status ENUM('Pending', 'For_Verification', 'Paid', 'Failed', 'Rejected', 'Overdue', 'Cancelled') DEFAULT 'Pending',
        paid_at DATETIME NULL,
        receipt_url TEXT NULL,
        receipt_public_id VARCHAR(255) NULL,
        receipt_uploaded_at DATETIME NULL,
        verified_by INT NULL,
        verified_at DATETIME NULL,
        admin_remarks TEXT NULL,
        is_cancellation_charge BOOLEAN DEFAULT FALSE,
        cancellation_reference VARCHAR(255) NULL,
        reminder_sent_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
      )
    `);
    console.log("[MIGRATION] payments table ensured.");

    // Ensure extra columns exist even on older tables
    const [paymentColumns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments'",
      [connection.config.database],
    );
    const paymentColumnNames = paymentColumns.map((c) => c.COLUMN_NAME);
    const paymentAlterations = [];
    if (!paymentColumnNames.includes("receipt_url")) {
      paymentAlterations.push("ADD COLUMN receipt_url TEXT NULL");
    }
    if (!paymentColumnNames.includes("receipt_public_id")) {
      paymentAlterations.push("ADD COLUMN receipt_public_id VARCHAR(255) NULL");
    }
    if (!paymentColumnNames.includes("receipt_uploaded_at")) {
      paymentAlterations.push("ADD COLUMN receipt_uploaded_at DATETIME NULL");
    }
    if (!paymentColumnNames.includes("verified_by")) {
      paymentAlterations.push("ADD COLUMN verified_by INT NULL");
    }
    if (!paymentColumnNames.includes("verified_at")) {
      paymentAlterations.push("ADD COLUMN verified_at DATETIME NULL");
    }
    if (!paymentColumnNames.includes("admin_remarks")) {
      paymentAlterations.push("ADD COLUMN admin_remarks TEXT NULL");
    }
    if (paymentAlterations.length > 0) {
      const alterSql = `ALTER TABLE payments ${paymentAlterations.join(", ")}`;
      await connection.query(alterSql);
      console.log(
        "[MIGRATION] Added missing payments columns:",
        paymentAlterations.join(", "),
      );
    }

    const [paymentStatusCheck] = await connection.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_status'`,
      [connection.config.database],
    );
    const currentPaymentEnum = paymentStatusCheck[0]?.COLUMN_TYPE || "";
    if (
      !currentPaymentEnum.includes("For_Verification") ||
      !currentPaymentEnum.includes("Rejected") ||
      !currentPaymentEnum.includes("Overdue") ||
      !currentPaymentEnum.includes("Cancelled")
    ) {
      await connection.query(
        `ALTER TABLE payments MODIFY COLUMN payment_status ENUM('Pending', 'For_Verification', 'Paid', 'Failed', 'Rejected', 'Overdue', 'Cancelled') DEFAULT 'Pending'`,
      );
      console.log("[MIGRATION] Updated payments.payment_status ENUM.");
    }

    // Ensure payment_type ENUM includes CancellationCharge
    const [paymentTypeCheck] = await connection.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_type'`,
      [connection.config.database],
    );
    const currentPaymentTypeEnum = paymentTypeCheck[0]?.COLUMN_TYPE || "";
    if (!currentPaymentTypeEnum.includes("CancellationCharge")) {
      await connection.query(
        `ALTER TABLE payments MODIFY COLUMN payment_type ENUM('Reservation', 'DownPayment', 'FinalPayment', 'CancellationCharge') NOT NULL`,
      );
      console.log(
        "[MIGRATION] Updated payments.payment_type ENUM to include CancellationCharge.",
      );
    }

    // Ensure is_cancellation_charge and cancellation_reference columns exist
    const [paymentExtraColumns] = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments'",
      [connection.config.database],
    );
    const paymentExtraColumnNames = paymentExtraColumns.map(
      (c) => c.COLUMN_NAME,
    );
    const paymentExtraAlterations = [];
    if (!paymentExtraColumnNames.includes("is_cancellation_charge")) {
      paymentExtraAlterations.push(
        "ADD COLUMN is_cancellation_charge BOOLEAN DEFAULT FALSE",
      );
    }
    if (!paymentExtraColumnNames.includes("cancellation_reference")) {
      paymentExtraAlterations.push(
        "ADD COLUMN cancellation_reference VARCHAR(255) NULL",
      );
    }
    if (!paymentExtraColumnNames.includes("reminder_sent_at")) {
      paymentExtraAlterations.push(
        "ADD COLUMN reminder_sent_at DATETIME NULL",
      );
    }
    if (paymentExtraAlterations.length > 0) {
      const alterSql = `ALTER TABLE payments ${paymentExtraAlterations.join(", ")}`;
      await connection.query(alterSql);
      console.log(
        "[MIGRATION] Added cancellation columns to payments table:",
        paymentExtraAlterations.join(", "),
      );
    }

    // 0.3 Create email_verifications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        attempt_count INT DEFAULT 0,
        resend_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_email_code (email, code)
      )
    `);
    console.log("[MIGRATION] email_verifications table ensured.");

    // 0.30 Widen email_verifications.code so SHA-256 hashes (64 chars) fit.
    await connection.query(
      "ALTER TABLE email_verifications MODIFY COLUMN code VARCHAR(64) NOT NULL",
    );
    console.log("[MIGRATION] email_verifications.code widened to VARCHAR(64).");

    // 0.31 Create email_change_verifications table
    // Stores hashed one-time codes for verifying an email address change.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_change_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        current_email VARCHAR(255) NOT NULL,
        new_email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempt_count INT DEFAULT 0,
        is_used BOOLEAN DEFAULT FALSE,
        resend_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_new_email (new_email)
      )
    `);
    console.log("[MIGRATION] email_change_verifications table ensured.");

    // 0.4 Create password_reset_tokens table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_token_hash (token_hash)
      )
    `);
    console.log("[MIGRATION] password_reset_tokens table ensured.");

    // 0.6 Create notifications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        booking_id INT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        link VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        INDEX idx_user_read (user_id, is_read),
        INDEX idx_user_created (user_id, created_at)
      )
    `);
    console.log("[MIGRATION] notifications table ensured.");

    // 0.6a Create blocked_dates table (admin-declared unavailable days such
    // as a rest day after an event). Blocked dates count as fully occupied in
    // the availability source of truth.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS blocked_dates (
        blocked_date_id INT AUTO_INCREMENT PRIMARY KEY,
        blocked_date DATE NOT NULL UNIQUE,
        reason VARCHAR(255) NULL,
        blocked_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (blocked_by) REFERENCES users(user_id) ON DELETE SET NULL,
        INDEX idx_blocked_date (blocked_date)
      )
    `);
    console.log("[MIGRATION] blocked_dates table ensured.");

    // 0.7 Create announcements table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        status ENUM('draft', 'published') DEFAULT 'draft',
        publish_date DATETIME NOT NULL,
        expiration_date DATETIME NULL,
        image_url VARCHAR(500) NULL,
        image_public_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_publish (status, publish_date),
        INDEX idx_expiration (expiration_date)
      )
    `);
    console.log("[MIGRATION] announcements table ensured.");

    // 0.8 Create menu_change_requests table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_change_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        requested_menu_selections JSON NOT NULL,
        dietary_notes TEXT NULL,
        status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
        rejection_reason TEXT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_booking_status (booking_id, status)
      )
    `);
    console.log("[MIGRATION] menu_change_requests table ensured.");

    // 0.9 Create booking_history table for auditing
    await connection.query(`
      CREATE TABLE IF NOT EXISTS booking_history (
        history_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        previous_state JSON NULL,
        new_state JSON NULL,
        changed_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        INDEX idx_booking_history (booking_id)
      )
    `);
    console.log("[MIGRATION] booking_history table ensured.");

    // 0.10 Create venue_setup_requests table for admin review of venue setup notes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS venue_setup_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        venue_setup_notes TEXT NOT NULL,
        admin_response TEXT NULL,
        status ENUM('Pending', 'Approved', 'Changes_Requested', 'Declined') NOT NULL DEFAULT 'Pending',
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
        INDEX idx_venue_setup_requests_booking (booking_id),
        INDEX idx_venue_setup_requests_user (user_id)
      )
    `);
    console.log("[MIGRATION] venue_setup_requests table ensured.");

    // 0.11 Create activity_logs table for the admin Recent Activity feed,
    // then backfill it from existing records so the feed shows real data.
    const [activityLogsTable] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'activity_logs'`,
      [connection.config.database],
    );
    if (activityLogsTable.length === 0) {
      await connection.query(`
        CREATE TABLE activity_logs (
          activity_id INT AUTO_INCREMENT PRIMARY KEY,
          actor_user_id INT NULL,
          actor_name VARCHAR(255) NOT NULL,
          actor_role ENUM('Admin', 'Customer') NOT NULL DEFAULT 'Admin',
          activity_type VARCHAR(50) NOT NULL,
          action VARCHAR(500) NOT NULL,
          booking_id INT NULL,
          created_at DATETIME NULL,
          INDEX idx_activity_created (created_at),
          INDEX idx_activity_type (activity_type),
          INDEX idx_activity_actor (actor_user_id),
          CONSTRAINT fk_activity_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
          CONSTRAINT fk_activity_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
        )
      `);
      console.log("[MIGRATION] activity_logs table created.");

      const adminSub = `(SELECT user_id, first_name, last_name FROM users WHERE role = 'Admin' ORDER BY user_id LIMIT 1)`;
      const backfillSql = `
        INSERT INTO activity_logs
          (actor_user_id, actor_name, actor_role, activity_type, action, booking_id, created_at)
        SELECT
          u.user_id,
          CONCAT(u.first_name, ' ', u.last_name),
          CASE WHEN u.role = 'Admin' THEN 'Admin' ELSE 'Customer' END,
          'booking_submitted',
          CONCAT('submitted Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id,
          b.created_at
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        WHERE b.created_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'booking_confirmed',
          CONCAT('confirmed Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, b.updated_at
        FROM bookings b JOIN ${adminSub} u
        WHERE b.booking_status = 'Confirmed'

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'booking_completed',
          CONCAT('completed Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, b.updated_at
        FROM bookings b JOIN ${adminSub} u
        WHERE b.booking_status = 'Completed'

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Customer', 'booking_cancelled_customer',
          CONCAT('cancelled Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, COALESCE(b.cancellation_processed_at, b.updated_at)
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        WHERE b.booking_status = 'Cancelled' AND b.cancellation_requested_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'booking_cancelled_admin',
          CONCAT('cancelled Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, b.updated_at
        FROM bookings b JOIN ${adminSub} u
        WHERE b.booking_status = 'Cancelled' AND b.cancellation_requested_at IS NULL

        UNION ALL SELECT
          cu.user_id, CONCAT(cu.first_name, ' ', cu.last_name), 'Customer', 'receipt_uploaded',
          CONCAT(
            'uploaded the ',
            CASE p.payment_type
              WHEN 'DownPayment' THEN 'down payment'
              WHEN 'FinalPayment' THEN 'final payment'
              ELSE 'reservation'
            END,
            ' receipt for Booking #',
            COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))
          ),
          b.booking_id, p.receipt_uploaded_at
        FROM payments p
        JOIN bookings b ON b.booking_id = p.booking_id
        JOIN users cu ON cu.user_id = b.user_id
        WHERE p.receipt_uploaded_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'payment_approved',
          CONCAT(
            'approved the ',
            CASE p.payment_type WHEN 'DownPayment' THEN 'Down Payment' WHEN 'FinalPayment' THEN 'Final Payment' ELSE 'Reservation' END,
            ' for Booking #',
            COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))
          ),
          b.booking_id, p.verified_at
        FROM payments p
        JOIN bookings b ON b.booking_id = p.booking_id
        JOIN ${adminSub} u
        WHERE p.verified_at IS NOT NULL AND p.payment_status = 'Paid'

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'payment_rejected',
          CONCAT(
            'rejected the ',
            CASE p.payment_type WHEN 'DownPayment' THEN 'Down Payment' WHEN 'FinalPayment' THEN 'Final Payment' ELSE 'Reservation' END,
            ' for Booking #',
            COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))
          ),
          b.booking_id, COALESCE(p.verified_at, p.updated_at)
        FROM payments p
        JOIN bookings b ON b.booking_id = p.booking_id
        JOIN ${adminSub} u
        WHERE p.payment_status = 'Rejected'

        UNION ALL SELECT
          cu.user_id, CONCAT(cu.first_name, ' ', cu.last_name), 'Customer', 'payment_paid',
          CONCAT(
            'paid the ',
            CASE p.payment_type WHEN 'DownPayment' THEN 'down payment' WHEN 'FinalPayment' THEN 'final payment' ELSE 'reservation' END,
            ' for Booking #',
            COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))
          ),
          b.booking_id, p.verified_at
        FROM payments p
        JOIN bookings b ON b.booking_id = p.booking_id
        JOIN users cu ON cu.user_id = b.user_id
        WHERE p.payment_status = 'Paid' AND p.verified_at IS NOT NULL

        UNION ALL SELECT
          cu.user_id, CONCAT(cu.first_name, ' ', cu.last_name), 'Customer', 'venue_setup_submitted',
          CONCAT('submitted venue setup notes for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, v.created_at
        FROM venue_setup_requests v
        JOIN bookings b ON b.booking_id = v.booking_id
        JOIN users cu ON cu.user_id = v.user_id
        WHERE v.status = 'Pending'

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'venue_setup_approved',
          CONCAT('approved the venue setup for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, v.reviewed_at
        FROM venue_setup_requests v
        JOIN bookings b ON b.booking_id = v.booking_id
        JOIN ${adminSub} u
        WHERE v.status = 'Approved' AND v.reviewed_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'venue_setup_changes_requested',
          CONCAT('requested changes for the venue setup of Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, v.reviewed_at
        FROM venue_setup_requests v
        JOIN bookings b ON b.booking_id = v.booking_id
        JOIN ${adminSub} u
        WHERE v.status = 'Changes_Requested' AND v.reviewed_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'venue_setup_declined',
          CONCAT('declined the venue setup for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, v.reviewed_at
        FROM venue_setup_requests v
        JOIN bookings b ON b.booking_id = v.booking_id
        JOIN ${adminSub} u
        WHERE v.status = 'Declined' AND v.reviewed_at IS NOT NULL

        UNION ALL SELECT
          cu.user_id, CONCAT(cu.first_name, ' ', cu.last_name), 'Customer', 'menu_change_requested',
          CONCAT('requested a menu change for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, m.created_at
        FROM menu_change_requests m
        JOIN bookings b ON b.booking_id = m.booking_id
        JOIN users cu ON cu.user_id = m.user_id
        WHERE m.status = 'Pending'

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'menu_change_approved',
          CONCAT('approved the menu change for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, m.reviewed_at
        FROM menu_change_requests m
        JOIN bookings b ON b.booking_id = m.booking_id
        JOIN ${adminSub} u
        WHERE m.status = 'Approved' AND m.reviewed_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Admin', 'menu_change_rejected',
          CONCAT('rejected the menu change for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, m.reviewed_at
        FROM menu_change_requests m
        JOIN bookings b ON b.booking_id = m.booking_id
        JOIN ${adminSub} u
        WHERE m.status = 'Rejected' AND m.reviewed_at IS NOT NULL

        UNION ALL SELECT
          cu.user_id, CONCAT(cu.first_name, ' ', cu.last_name), 'Customer', 'feedback_submitted',
          CONCAT('submitted feedback for Booking #', COALESCE(b.booking_reference, CONCAT('AF-', b.ai_booking_reference), CONCAT('BK-', b.booking_id))),
          b.booking_id, f.submitted_at
        FROM feedback f
        JOIN bookings b ON b.booking_id = f.booking_id
        JOIN users cu ON cu.user_id = f.user_id
        WHERE f.submitted_at IS NOT NULL

        UNION ALL SELECT
          u.user_id, CONCAT(u.first_name, ' ', u.last_name), 'Customer', 'user_registered',
          CONCAT('created a new customer account'),
          NULL, u.created_at
        FROM users u
        WHERE u.role = 'Customer' AND u.created_at IS NOT NULL
      `;
      const [backfillResult] = await connection.query(backfillSql);
      console.log(
        `[MIGRATION] activity_logs backfilled with ${backfillResult.affectedRows} entries.`,
      );
    }

    // 0.5 Ensure account_status ENUM includes 'Pending'
    const [accountStatusCol] = await connection.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_status'",
      [connection.config.database],
    );
    const currentAccountStatusEnum = accountStatusCol[0]?.COLUMN_TYPE || "";
    if (!currentAccountStatusEnum.includes("Pending")) {
      await connection.query(
        "ALTER TABLE users MODIFY COLUMN account_status ENUM('Active','Inactive','Suspended','Pending') NOT NULL DEFAULT 'Active'",
      );
      console.log("[MIGRATION] Added 'Pending' to users.account_status ENUM.");
    }

    // 0.5.1 Add token_version column for single-session enforcement.
    // Bumped on every login/password change/reset so all previous sessions
    // (stale access + refresh JWTs) are invalidated at once.
    const [tokenVersionCol] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version'`,
      [connection.config.database],
    );
    if (tokenVersionCol.length === 0) {
      await connection.query(
        "ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0",
      );
      console.log("[MIGRATION] Added token_version to users table.");
    }

    // 1. Seed event_types
    const [eventTypes] = await connection.query(
      "SELECT COUNT(*) as count FROM event_types",
    );
    if (eventTypes[0].count === 0) {
      const defaultEventTypes = [
        "Birthday",
        "Anniversary",
        "Corporate",
        "Wedding",
        "Family Celebration",
        "Graduation",
        "Other",
      ];
      for (const type of defaultEventTypes) {
        await connection.query(
          "INSERT INTO event_types (type_name, status) VALUES (?, 'Active')",
          [type],
        );
      }
      console.log("[SEED] Default event types seeded successfully.");
    }

    // 2. Seed venue_setups
    const [venueSetups] = await connection.query(
      "SELECT COUNT(*) as count FROM venue_setups",
    );
    if (venueSetups[0].count === 0) {
      const defaultVenueSetups = [
        {
          name: "Floral Arrangements",
          desc: "Elegant floral centerpieces and accents",
        },
        { name: "Candle Lighting", desc: "Warm candlelight ambiance" },
        {
          name: "Projector & Screen",
          desc: "AV setup for presentations and videos",
        },
        { name: "Sound System / PA", desc: "Sound system with microphones" },
        {
          name: "Photo Backdrop",
          desc: "Decorative backdrop for guest photos",
        },
        { name: "Balloon Décor", desc: "Festive balloon arrangements" },
        {
          name: "Standard Setup",
          desc: "Clean and classic dining table setup",
        },
      ];
      for (const setup of defaultVenueSetups) {
        await connection.query(
          "INSERT INTO venue_setups (setup_name, description, status) VALUES (?, ?, 'Active')",
          [setup.name, setup.desc],
        );
      }
      console.log("[SEED] Default venue setups seeded successfully.");
    }
    // 1.0 Create knowledge_base table for chatbot FAQ lookup (avoids Gemini API calls)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        kb_id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category_status (category, status),
        FULLTEXT INDEX ft_question (question)
      )
    `);
    console.log("[MIGRATION] knowledge_base table ensured.");

    // Seed knowledge_base only if empty
    const [kbCount] = await connection.query(
      "SELECT COUNT(*) as count FROM knowledge_base",
    );
    if (kbCount[0].count === 0) {
      const kbEntries = [
        // Hours & Location
        [
          "Hours & Location",
          "What are your operating hours?",
          `We are open Tuesday to Sunday from ${getOperatingHoursDisplay()}. We are closed on Mondays.`,
        ],
        [
          "Hours & Location",
          "Where are you located?",
          "Authentic Flavors is located at 45 ML Quezon St. New Lower Bicutan, Taguig City, Philippines.",
        ],
        [
          "Hours & Location",
          "Do you have parking available?",
          "Yes, we have dedicated event parking available for our guests.",
        ],
        [
          "Hours & Location",
          "Are you open on holidays?",
          "We are open on most holidays except Christmas Day, New Year's Day, and Mondays (our regular rest day).",
        ],
        [
          "Hours & Location",
          "Why are you closed on Mondays?",
          "We are closed on Mondays to give our team a rest day and to prepare fresh ingredients for the week ahead. We look forward to serving you Tuesday through Sunday!",
        ],
        // Reservations
        [
          "Reservations",
          "How do I make a reservation?",
          "You can make a reservation by visiting our Book a Package page on our website and selecting your preferred package, date, and menu. Bookings must be made at least 14 days (two weeks) in advance so there is enough time to settle the down payment.",
        ],
        [
          "Reservations",
          "What is your cancellation policy?",
          "Cancellations made at least 5 days before your event forfeit the ₱5,000 reservation fee. Cancellations made less than 5 days before the event are charged 50% of the total package price, and cancellations made 1 day before or on the day of the event are charged 100% of the total package price.",
        ],
        [
          "Reservations",
          "Do you accept walk-ins?",
          "Yes, we welcome walk-ins! However, table availability is subject to the current occupancy. Reservations are recommended, especially on weekends and holidays.",
        ],
        [
          "Reservations",
          "Is there a dress code?",
          "We maintain a smart casual dress code. We kindly ask guests to refrain from wearing slippers, swimwear, or sleeveless shirts for gentlemen.",
        ],
        [
          "Reservations",
          "Can I book the entire restaurant for a private event?",
          "Absolutely! Our venue can accommodate a maximum of 70 guests for private events. Please contact our events team at events@authenticflavors.com or call (02) 8123-4567 for more details.",
        ],
        [
          "Reservations",
          "What is the maximum number of guests you can accommodate?",
          "Our venue can accommodate a maximum of 70 guests for seated events.",
        ],
        // Menu & Food
        [
          "Menu & Food",
          "What type of cuisine do you serve?",
          "Authentic Flavors serves modern Filipino cuisine with a contemporary twist. Chef Ramos started the business during the pandemic with sisig and chicken wings, and has since expanded into a full-service restaurant offering a wide variety of dishes.",
        ],
        [
          "Menu & Food",
          "Do you accommodate food allergies?",
          "Yes, we take food allergies seriously. Please input in the booking information any allergies when ordering, and our kitchen will take the necessary precautions. However, please note that our kitchen handles common allergens.",
        ],
        [
          "Menu & Food",
          "Are your dishes halal-certified?",
          "Our restaurant is not fully halal-certified. Please speak with our manager for more details.",
        ],
        [
          "Menu & Food",
          "Do you serve alcoholic beverages?",
          "Yes, we have a selection of local and imported wines, beers, and signature cocktails. We also offer non-alcoholic mocktails for guests who prefer them.",
        ],
        // Pricing & Payment
        [
          "Pricing & Payment",
          "What payment methods do you accept?",
          "We accept cash, GCash, Maya, and online banking transfers.",
        ],
        [
          "Pricing & Payment",
          "Can I split the bill?",
          "Yes, bill splitting is allowed but only for the final payment, and it must be done in person at the restaurant. The reservation fee and down payment are settled per booking via cash, GCash, Maya, or online banking transfer.",
        ],
        // Catering & Events
        [
          "Catering & Events",
          "How far in advance should I book for an event?",
          "We recommend booking at least 2 weeks in advance for small events and 1 month in advance for large events to ensure availability and proper preparations.",
        ],
        [
          "Catering & Events",
          "Do you provide event setup and decoration?",
          "Yes, our events team provides basic setup and decoration as part of our packages.",
        ],
        // About the Restaurant
        [
          "About the Restaurant",
          "When was the restaurant established?",
          "Authentic Flavors was officially established in November 2023. It started as a home-based online food business during the pandemic, initially selling sisig and chicken wings, before growing into a full-service dining restaurant.",
        ],
        [
          "About the Restaurant",
          "Who is Chef Ramos?",
          "Chef Ramos is the Executive Chef and Founder of Authentic Flavors. He started the business during the pandemic as a home-based online food service, selling sisig and chicken wings. Through quality food, excellent service, and online promotion, the business grew into the restaurant it is today.",
        ],
        [
          "About the Restaurant",
          "What is the venue capacity?",
          "Our venue can accommodate a maximum of 70 guests. It offers an exclusive, intimate setting perfect for birthdays, weddings, corporate dinners, and other milestones.",
        ],
        // Contact & Support
        [
          "Contact & Support",
          "How can I contact the restaurant?",
          "You can reach us via email at ramosauthenticflavors@gmail.com, or through our Facebook page.",
        ],
        [
          "Contact & Support",
          "Is Wi-Fi available?",
          "Yes, free Wi-Fi is available for all guests. Ask your server for the password upon arrival.",
        ],
        [
          "Contact & Support",
          "Are you available on social media?",
          "Yes, follow us on Facebook and Instagram for updates, promos, and behind-the-scenes content.",
        ],
        [
          "Contact & Support",
          "How do I provide feedback about my experience?",
          "We value your feedback! You can fill out our feedback form on the website, leave us a review on Google or Facebook, or speak directly with our manager during your visit.",
        ],
      ];

      for (const [category, question, answer] of kbEntries) {
        await connection.query(
          "INSERT INTO knowledge_base (category, question, answer, status) VALUES (?, ?, ?, 'Active')",
          [category, question, answer],
        );
      }
      console.log(
        `[SEED] knowledge_base seeded with ${kbEntries.length} FAQ entries.`,
      );
    }

    // Idempotently correct FAQ answers that previously contradicted the
    // implemented business rules, so databases seeded before the rules existed
    // also pick up the fix on the next server start.
    await connection.query(
      `UPDATE knowledge_base SET answer = ?, updated_at = CURRENT_TIMESTAMP
       WHERE question = 'How do I make a reservation?'`,
      [
        "You can make a reservation by visiting our Book a Package page on our website and selecting your preferred package, date, and menu. Bookings must be made at least 14 days (two weeks) in advance so there is enough time to settle the down payment.",
      ],
    );
    await connection.query(
      `UPDATE knowledge_base SET answer = ?, updated_at = CURRENT_TIMESTAMP
       WHERE question = 'What is your cancellation policy?'`,
      [
        "Cancellations made at least 5 days before your event forfeit the ₱5,000 reservation fee. Cancellations made less than 5 days before the event are charged 50% of the total package price, and cancellations made 1 day before or on the day of the event are charged 100% of the total package price.",
      ],
    );
    await connection.query(
      `UPDATE knowledge_base SET answer = ?, updated_at = CURRENT_TIMESTAMP
       WHERE question = 'Can I split the bill?'`,
      [
        "Yes, bill splitting is allowed but only for the final payment, and it must be done in person at the restaurant. The reservation fee and down payment are settled per booking via cash, GCash, Maya, or online banking transfer.",
      ],
    );
  } catch (error) {
    console.error("[SEED] Error seeding database:", error);
  } finally {
    connection.release();
  }
}
