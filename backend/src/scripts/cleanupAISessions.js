import {
  runSessionCleanup,
  getSessionStatusCounts,
} from "../services/sessionCleanupService.js";

function formatCounts(label, counts) {
  const conv = counts.conversations
    .map((r) => `${r.conversation_status}: ${r.cnt}`)
    .join(", ");
  const sess = counts.sessions
    .map((r) => `${r.session_status}: ${r.cnt}`)
    .join(", ");
  console.log(`\n${label}`);
  console.log(`  ai_conversations   -> ${conv}`);
  console.log(`  ai_booking_sessions-> ${sess}`);
}

async function main() {
  console.log("=== AI Session Cleanup ===");

  const before = await getSessionStatusCounts();
  formatCounts("BEFORE:", before);

  await runSessionCleanup();

  const after = await getSessionStatusCounts();
  formatCounts("AFTER:", after);

  console.log("\nCleanup complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
