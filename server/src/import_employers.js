import { fileURLToPath } from "url";
import { pool } from "./db.js";
// Imported as a module (not read from disk) so it is bundled into the Vercel
// serverless function and available at runtime.
import list from "../data/universities.json" with { type: "json" };

const SOURCE = "UGC consolidated list 2026";

export async function importEmployers() {
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    const CHUNK = 500; // batched multi-row inserts: fast enough for serverless
    for (let i = 0; i < list.length; i += CHUNK) {
      const chunk = list.slice(i, i + CHUNK);
      const values = [];
      const params = [];
      chunk.forEach((u, j) => {
        const b = j * 7;
        values.push(`($${b + 1},'University',$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`);
        params.push(u.name, u.type, u.address, u.zip, u.state, u.ugc_status, SOURCE);
      });
      const r = await client.query(
        `INSERT INTO employers (name, category, type, address, zip, state, ugc_status, source)
         VALUES ${values.join(",")}
         ON CONFLICT (lower(name)) DO NOTHING`,
        params
      );
      inserted += r.rowCount;
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
  return { inserted, total: Number(total) };
}

// Run + close the pool only when invoked directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  importEmployers()
    .then(() => pool.end())
    .catch((e) => { console.error("Employers import failed:", e); process.exit(1); });
}
