import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./db/pool.js";
import { seedDatabaseIfEmpty } from "./db/seed.js";
import { startSessionCleanupScheduler } from "./services/sessionCleanupService.js";
import { startReminderScheduler } from "./services/reminderSchedulerService.js";

async function startServer() {
  console.log("[Startup] Connecting to database...");
  await testDbConnection();
  console.log("[Startup] Database connected.");

  console.log("[Startup] Applying migrations / seeding...");
  await seedDatabaseIfEmpty();
  console.log("[Startup] Migrations / seeding complete.");

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Backend listening on port ${env.port}`);
  });

  // Self-healing: auto-cancel stale AI booking sessions/conversations hourly
  startSessionCleanupScheduler();
  console.log("[SessionCleanup] Hourly scheduler started.");

  // Automated notification and email reminder scheduler
  startReminderScheduler();
  console.log("[ReminderScheduler] Automated reminder scheduler started.");
}

startServer().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
