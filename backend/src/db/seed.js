import { pool } from "./pool.js";

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
        is_analyzed BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE KEY unique_booking_feedback (booking_id)
      )
    `);
    console.log("[MIGRATION] feedback table ensured.");

    // 0.2 Create payments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        payment_type ENUM('Reservation', 'DownPayment', 'FinalPayment') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        paymongo_checkout_id VARCHAR(255) NULL,
        paymongo_payment_id VARCHAR(255) NULL,
        payment_reference VARCHAR(255) NULL,
        payment_method VARCHAR(255) NULL,
        payment_status ENUM('Pending', 'Paid', 'Failed') DEFAULT 'Pending',
        paid_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
      )
    `);
    console.log("[MIGRATION] payments table ensured.");

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
  } catch (error) {
    console.error("[SEED] Error seeding database:", error);
  } finally {
    connection.release();
  }
}
