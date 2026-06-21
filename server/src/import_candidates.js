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

// Parse Apollo CSV text → array of candidate objects (keyed by COLS).
export function parseCandidatesCsv(text) {
  const rows = parseCSV(text).filter((r) => r.some((c) => c !== ""));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  const at = (r, name) => { const i = header.indexOf(name); return i >= 0 ? clean(r[i]) : null; };
  const out = [];
  for (const r of rows.slice(1)) {
    const first = at(r, "First Name"), last = at(r, "Last Name"), li = at(r, "Person Linkedin Url");
    if (!first && !last && !li) continue;
    out.push({
      apollo_contact_id: at(r, "Apollo Contact Id"), first_name: first, last_name: last,
      full_name: [first, last].filter(Boolean).join(" ") || null,
      title: at(r, "Title"), company: at(r, "Company Name"), email: at(r, "Email"),
      email_status: at(r, "Email Status"), seniority: at(r, "Seniority"), departments: at(r, "Departments"),
      work_phone: at(r, "Work Direct Phone"), mobile_phone: at(r, "Mobile Phone"),
      corporate_phone: at(r, "Corporate Phone"), linkedin_url: li,
      company_linkedin_url: at(r, "Company Linkedin Url"), website: at(r, "Website"),
      twitter_url: at(r, "Twitter Url"), facebook_url: at(r, "Facebook Url"),
      city: at(r, "City"), state: at(r, "State"), country: at(r, "Country"),
      industry: at(r, "Industry"), keywords: at(r, "Keywords"), num_employees: toInt(at(r, "# Employees")),
    });
  }
  return out;
}

// Idempotent upsert (by apollo_contact_id) of parsed candidate objects.
export async function upsertCandidates(list) {
  const updates = COLS.filter((c) => c !== "apollo_contact_id").map((c) => `${c}=EXCLUDED.${c}`).join(", ");
  let n = 0;
  for (const c of list) {
    const vals = COLS.map((col) => c[col] ?? null);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
    await pool.query(
      `INSERT INTO candidates (${COLS.join(",")}) VALUES (${placeholders})
       ON CONFLICT (apollo_contact_id) DO UPDATE SET ${updates}`,
      vals
    );
    n++;
  }
  return n;
}

export async function importCandidates(csvPath) {
  const list = parseCandidatesCsv(fs.readFileSync(csvPath, "utf8"));
  const n = await upsertCandidates(list);
  const total = (await pool.query("SELECT count(*) FROM candidates")).rows[0].count;
  console.log(`✓ Candidates import: ${n} rows processed. Total in table: ${total}.`);
  return { processed: n, total: Number(total) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) { console.error("Usage: node src/import_candidates.js <path-to-apollo-export.csv>"); process.exit(1); }
  importCandidates(path).then(() => pool.end()).catch((e) => { console.error("Candidate import failed:", e); process.exit(1); });
}
