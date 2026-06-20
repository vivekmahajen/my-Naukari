import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data", "university_roles.json");

async function main() {
  const list = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
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
  await pool.end();
}

main().catch((e) => {
  console.error("Job roles import failed:", e);
  process.exit(1);
});
