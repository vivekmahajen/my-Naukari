import { fileURLToPath } from "url";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";
import { importEmployers } from "./import_employers.js";
import { importJobRoles } from "./import_job_roles.js";

// Idempotent provisioning for a fresh (or existing) database — safe to run on
// every deploy. Creates the schema, seeds demo data only when the DB is empty
// (so real data is never wiped), then loads the universities + role catalog.
export async function bootstrap() {
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
