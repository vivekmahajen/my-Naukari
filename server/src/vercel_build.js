// Build step for Vercel. We attempt the idempotent DB bootstrap (migrate +
// seed-if-empty + imports), but we DO NOT fail the deployment if the database
// is unreachable — the static site and API function should always ship. When
// DATABASE_URL is correctly set, this seeds automatically; otherwise it logs a
// clear warning and the site still deploys (seed later via `npm run bootstrap`).
import { pool } from "./db.js";
import { bootstrap } from "./bootstrap.js";

try {
  await bootstrap();
} catch (e) {
  console.warn("\n⚠  Skipping DB bootstrap during build:");
  console.warn("   " + e.message);
  console.warn("   The site will still deploy. Once DATABASE_URL is set (Production),");
  console.warn("   data appears automatically on the next deploy, or seed manually with:");
  console.warn("   DATABASE_URL=\"<neon-pooled-url>\" npm run bootstrap\n");
} finally {
  await pool.end().catch(() => {});
}
