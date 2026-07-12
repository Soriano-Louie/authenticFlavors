import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./db/pool.js";
import { seedDatabaseIfEmpty } from "./db/seed.js";

async function startServer() {
  await testDbConnection();
  await seedDatabaseIfEmpty();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Backend listening on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
