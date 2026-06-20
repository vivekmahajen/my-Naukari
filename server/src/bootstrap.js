import { fileURLToPath } from "url";
import { pool, connectionString } from "./db.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";
import { importEmployers } from "./import_employers.js";
import { importJobRoles } from "./import_job_roles.js";

// Idempotent provisioning for a fresh (or existing) database — safe to run on
// every deploy. Creates the schema, seeds demo data only when the DB is empty
// (so real data is never wiped), then loads the universities + role catalog.
export async function bootstrap() {
  if (!connectionString) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) to " +
      "your Neon *pooled* connection string in your host's Environment Variables " +
      "(on Vercel: Settings → Environment Variables, Production scope ticked), then " +
      "redeploy. Without it the Postgres client falls back to localhost:5432."
    );
  }
  await migrate();

  const { rows } = await pool.query("SELECT count(*)::int AS n FROM jobs");
  if (rows[0].n === 0) {
    console.log("→ Empty database — seeding demo data.");
    await seed();
  } else {
    console.log(`✓ Jobs already present (${rows[0].n}) — skipping seed.`);
  }

  await importEmployers();
  await importJobRoles();
  console.log("✓ Bootstrap complete.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bootstrap()
    .then(() => pool.end())
    .catch((e) => { console.error("Bootstrap failed:", e); process.exit(1); });
}
