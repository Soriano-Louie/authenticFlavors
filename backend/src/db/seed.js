import { pool } from "./pool.js";

export async function seedDatabaseIfEmpty() {
  const connection = await pool.getConnection();
  try {
    // 1. Seed event_types
    const [eventTypes] = await connection.query("SELECT COUNT(*) as count FROM event_types");
    if (eventTypes[0].count === 0) {
      const defaultEventTypes = [
        "Birthday",
        "Anniversary",
        "Corporate",
        "Wedding",
        "Family Celebration",
        "Graduation",
        "Other"
      ];
      for (const type of defaultEventTypes) {
        await connection.query("INSERT INTO event_types (type_name, status) VALUES (?, 'Active')", [type]);
      }
      console.log("[SEED] Default event types seeded successfully.");
    }

    // 2. Seed venue_setups
    const [venueSetups] = await connection.query("SELECT COUNT(*) as count FROM venue_setups");
    if (venueSetups[0].count === 0) {
      const defaultVenueSetups = [
        { name: "Floral Arrangements", desc: "Elegant floral centerpieces and accents" },
        { name: "Candle Lighting", desc: "Warm candlelight ambiance" },
        { name: "Projector & Screen", desc: "AV setup for presentations and videos" },
        { name: "Sound System / PA", desc: "Sound system with microphones" },
        { name: "Photo Backdrop", desc: "Decorative backdrop for guest photos" },
        { name: "Balloon Décor", desc: "Festive balloon arrangements" },
        { name: "Standard Setup", desc: "Clean and classic dining table setup" }
      ];
      for (const setup of defaultVenueSetups) {
        await connection.query(
          "INSERT INTO venue_setups (setup_name, description, status) VALUES (?, ?, 'Active')",
          [setup.name, setup.desc]
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
