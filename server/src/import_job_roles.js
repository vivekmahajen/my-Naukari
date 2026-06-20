import { fileURLToPath } from "url";
import { pool } from "./db.js";
// Imported as a module so it is bundled into the Vercel serverless function.
import list from "../data/university_roles.json" with { type: "json" };

export async function importJobRoles() {
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const r of list) {
      // New roles only; never overwrite a description added later.
      const res = await client.query(
        `INSERT INTO job_roles
           (category_no, category_group, category, title, abbr, level, scope_note, seniority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (lower(title), category_group) DO NOTHING
         RETURNING id`,
        [r.category_no, r.category_group, r.category, r.title, r.abbr, r.level, r.scope_note, r.seniority]
      );
      if (res.rows[0]) inserted++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const total = (await pool.query("SELECT count(*) FROM job_roles")).rows[0].count;
  console.log(`✓ Job roles import: ${inserted} new, ${list.length - inserted} already present. Total: ${total}.`);
}

// Run + close the pool only when invoked directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  importJobRoles()
    .then(() => pool.end())
    .catch((e) => { console.error("Job roles import failed:", e); process.exit(1); });
}
