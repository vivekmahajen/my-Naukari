import fs from "fs";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

// Minimal RFC-4180 CSV parser: handles quoted fields, "" escapes, and commas
// or newlines inside quotes (needed for Apollo's huge "Keywords" column).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\r") {
      // ignore
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v) => {
  if (v == null) return null;
  let s = String(v).trim();
  if (s.startsWith("'")) s = s.slice(1); // strip Excel text-guard apostrophe (phones)
  return s === "" ? null : s;
};
const toInt = (v) => {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

const COLS = [
  "apollo_contact_id", "first_name", "last_name", "full_name", "title", "company",
  "email", "email_status", "seniority", "departments", "work_phone", "mobile_phone",
  "corporate_phone", "linkedin_url", "company_linkedin_url", "website", "twitter_url",
  "facebook_url", "city", "state", "country", "industry", "keywords", "num_employees",
];

export async function importCandidates(csvPath) {
  const rows = parseCSV(fs.readFileSync(csvPath, "utf8")).filter((r) => r.some((c) => c !== ""));
  if (!rows.length) throw new Error("Empty CSV");
  const header = rows[0].map((h) => h.trim());
  const at = (r, name) => { const i = header.indexOf(name); return i >= 0 ? clean(r[i]) : null; };

  let n = 0;
  for (const r of rows.slice(1)) {
    const first = at(r, "First Name"), last = at(r, "Last Name");
    const li = at(r, "Person Linkedin Url");
    if (!first && !last && !li) continue; // skip blank lines
    const vals = [
      at(r, "Apollo Contact Id"), first, last, [first, last].filter(Boolean).join(" ") || null,
      at(r, "Title"), at(r, "Company Name"), at(r, "Email"), at(r, "Email Status"),
      at(r, "Seniority"), at(r, "Departments"), at(r, "Work Direct Phone"), at(r, "Mobile Phone"),
      at(r, "Corporate Phone"), li, at(r, "Company Linkedin Url"), at(r, "Website"),
      at(r, "Twitter Url"), at(r, "Facebook Url"), at(r, "City"), at(r, "State"), at(r, "Country"),
      at(r, "Industry"), at(r, "Keywords"), toInt(at(r, "# Employees")),
    ];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
    const updates = COLS.filter((c) => c !== "apollo_contact_id").map((c) => `${c}=EXCLUDED.${c}`).join(", ");
    await pool.query(
      `INSERT INTO candidates (${COLS.join(",")}) VALUES (${placeholders})
       ON CONFLICT (apollo_contact_id) DO UPDATE SET ${updates}`,
      vals
    );
    n++;
  }
  const total = (await pool.query("SELECT count(*) FROM candidates")).rows[0].count;
  console.log(`✓ Candidates import: ${n} rows processed. Total in table: ${total}.`);
  return { processed: n, total: Number(total) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) { console.error("Usage: node src/import_candidates.js <path-to-apollo-export.csv>"); process.exit(1); }
  importCandidates(path).then(() => pool.end()).catch((e) => { console.error("Candidate import failed:", e); process.exit(1); });
}
