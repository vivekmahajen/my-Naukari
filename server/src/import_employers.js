import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data", "universities.json");
const SOURCE = "UGC consolidated list 2026";

async function main() {
  const list = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const u of list) {
      const r = await client.query(
        `INSERT INTO employers (name, category, type, address, zip, state, ugc_status, source)
         VALUES ($1, 'University', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (lower(name)) DO NOTHING
         RETURNING id`,
        [u.name, u.type, u.address, u.zip, u.state, u.ugc_status, SOURCE]
      );
      if (r.rows[0]) inserted++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const total = (await pool.query("SELECT count(*) FROM employers")).rows[0].count;
  console.log(`✓ Employers import: ${inserted} new, ${list.length - inserted} already present. Total: ${total}.`);
  await pool.end();
}

main().catch((e) => {
  console.error("Employers import failed:", e);
  process.exit(1);
});
