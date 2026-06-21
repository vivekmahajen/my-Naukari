import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query, connectionString } from "./db.js";
import { signToken, authOptional, authRequired, requireRole } from "./auth.js";
import { bootstrap } from "./bootstrap.js";
import { migrate } from "./migrate.js";
import { seedCandidates, CANDIDATE_PASSWORD } from "./seed_candidates.js";
import { parseCandidatesCsv, upsertCandidates } from "./import_candidates.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" })); // allow CSV-text uploads for candidate import

const origins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(authOptional);

/* Map a DB job row to the shape the frontend already expects (camelCase). */
function mapJob(r) {
  const postedDays = Math.max(0, Math.floor((Date.now() - new Date(r.posted_at)) / 86400000));
  return {
    id: String(r.id),
    title: r.title,
    company: r.company,
    logoColor: r.logo_color,
    logoText: r.logo_text,
    verified: r.verified,
    location: r.location,
    remote: r.remote,
    type: r.type,
    experience: r.experience,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    postedDays,
    applicants: r.applicants_base + Number(r.live_applicants || 0),
    openings: r.openings,
    skills: r.skills,
    matchScore: r.match_score,
    matchReason: r.match_reason,
    category: r.category,
    about: r.about,
    responsibilities: r.responsibilities,
    requirements: r.requirements,
    universityId: r.university_id ? String(r.university_id) : null,
    universityName: r.university_name || null,
    employerId: r.employer_id ? String(r.employer_id) : null,
  };
}

const JOB_SELECT = `
  SELECT j.*, (SELECT count(*) FROM applications a WHERE a.job_id = j.id) AS live_applicants,
    e.name AS university_name
  FROM jobs j
  LEFT JOIN employers e ON e.id = j.university_id`;

/* ---------------- Health ---------------- */
app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up", hasDatabaseUrl: !!connectionString });
  } catch (e) {
    // Safe diagnostics: never echoes the connection string, only whether it is
    // present and the driver's error reason (e.g. ENOTFOUND, auth failed, SSL).
    res.status(503).json({
      ok: false,
      db: "down",
      hasDatabaseUrl: !!connectionString,
      reason: e.code || e.message,
    });
  }
});

/* One-time DB provisioning, triggerable from a browser so no local tooling is
   needed. DISABLED unless a dedicated SEED_KEY env var is set, and the request
   must present it (?key=… or x-seed-key header). It intentionally does NOT fall
   back to JWT_SECRET, so leaving SEED_KEY unset fully closes this endpoint.
   Idempotent: safe to call more than once. */
app.all("/api/admin/seed", async (req, res) => {
  const expected = process.env.SEED_KEY;
  if (!expected) {
    return res.status(403).json({ ok: false, error: "Seeding is disabled. Set a SEED_KEY env var to enable it." });
  }
  const provided = req.query.key || req.get("x-seed-key");
  if (provided !== expected) {
    return res.status(401).json({ ok: false, error: "Invalid or missing seed key" });
  }
  try {
    await bootstrap();
    const counts = {
      jobs: (await query("SELECT count(*)::int AS n FROM jobs")).rows[0].n,
      employers: (await query("SELECT count(*)::int AS n FROM employers")).rows[0].n,
      job_roles: (await query("SELECT count(*)::int AS n FROM job_roles")).rows[0].n,
    };
    res.json({ ok: true, counts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* Create the 5 demo candidates (idempotent). Same SEED_KEY protection. */
app.all("/api/admin/seed-candidates", async (req, res) => {
  const expected = process.env.SEED_KEY;
  if (!expected) return res.status(403).json({ ok: false, error: "Seeding is disabled. Set a SEED_KEY env var to enable it." });
  if ((req.query.key || req.get("x-seed-key")) !== expected) return res.status(401).json({ ok: false, error: "Invalid or missing seed key" });
  try {
    await migrate();                 // ensure the candidate profile columns exist
    const candidates = await seedCandidates();
    res.json({ ok: true, password: CANDIDATE_PASSWORD, candidates });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ---------------- Auth ---------------- */
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, company } = req.body || {};
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "name, email, password and role are required" });
  if (!["candidate", "employer"].includes(role))
    return res.status(400).json({ error: "role must be candidate or employer" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await query(
      `INSERT INTO users (name,email,password_hash,role,company)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,company`,
      [name, email.toLowerCase(), hash, role, company || null]
    );
    const user = r.rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  try {
    const r = await query("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash)))
      return res.status(401).json({ error: "Invalid email or password" });
    const user = { id: u.id, name: u.name, email: u.email, role: u.role, company: u.company };
    res.json({ token: signToken(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/me", authRequired, (req, res) => res.json({ user: req.user }));

/* ---------------- Jobs ---------------- */
app.get("/api/jobs", async (req, res) => {
  const { q, location, category, remote, verified, fresh } = req.query;

  // Build the WHERE clause explicitly with positional params.
  const clauses = [];
  const vals = [];
  if (q) { vals.push(`%${q}%`); const p = `$${vals.length}`;
    clauses.push(`(j.title ILIKE ${p} OR j.company ILIKE ${p} OR EXISTS (SELECT 1 FROM unnest(j.skills) s WHERE s ILIKE ${p}))`); }
  if (location) { vals.push(`%${location}%`); clauses.push(`j.location ILIKE $${vals.length}`); }
  if (category) { vals.push(category); clauses.push(`j.category = $${vals.length}`); }
  if (remote) { vals.push(remote); clauses.push(`j.remote = $${vals.length}`); }
  if (verified === "true") clauses.push("j.verified = true");
  if (fresh === "true") clauses.push("j.posted_at > now() - interval '7 days'");

  const sql = `${JOB_SELECT} ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY j.match_score DESC`;
  try {
    const r = await query(sql, vals);
    res.json(r.rows.map(mapJob));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    const r = await query(`${JOB_SELECT} WHERE j.id = $1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Job not found" });
    res.json(mapJob(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

/* Employer posts a job */
app.post("/api/jobs", authRequired, requireRole("employer"), async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.salaryMin || !b.salaryMax || (!b.location && !b.universityId))
    return res.status(400).json({ error: "title, location (or a university), salaryMin and salaryMax are required" });
  if (Number(b.salaryMax) < Number(b.salaryMin))
    return res.status(400).json({ error: "salaryMax must be >= salaryMin" });
  try {
    // Optionally link to a directory employer (university) and default company/location from it.
    let universityId = b.universityId ? Number(b.universityId) : null;
    let uni = null;
    if (universityId) {
      const u = await query("SELECT id, name, state FROM employers WHERE id = $1", [universityId]);
      uni = u.rows[0] || null;
      if (!uni) universityId = null; // ignore an unknown id rather than failing
    }
    const company = b.company || uni?.name || req.user.company || "Company";
    const location = b.location || uni?.state || "India";
    const logoText = (company.trim()[0] || "?").toUpperCase() +
      (company.trim().split(" ")[1]?.[0]?.toUpperCase() || "");
    const r = await query(
      `INSERT INTO jobs
        (employer_id,title,company,logo_text,verified,location,remote,type,experience,
         salary_min,salary_max,openings,skills,category,university_id,match_score,match_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,100,'Newly posted role.')
       RETURNING id`,
      [req.user.id, b.title, company, logoText, !!b.verified, location,
       b.remote || "On-site", b.type || "Full-time", b.experience || null,
       Number(b.salaryMin), Number(b.salaryMax), Number(b.openings) || 1,
       Array.isArray(b.skills) ? b.skills : String(b.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
       b.category || "Other", universityId]
    );
    const created = await query(`${JOB_SELECT} WHERE j.id = $1`, [r.rows[0].id]);
    res.status(201).json(mapJob(created.rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create job" });
  }
});

/* Employer: applicants to my jobs */
app.get("/api/employer/jobs", authRequired, requireRole("employer"), async (req, res) => {
  try {
    const r = await query(
      `${JOB_SELECT} WHERE j.employer_id = $1 ORDER BY j.posted_at DESC`, [req.user.id]);
    res.json(r.rows.map(mapJob));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch employer jobs" });
  }
});

/* ---------------- Employers directory (potential employers) ---------------- */
app.get("/api/employers", async (req, res) => {
  const { q, state, type } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const clauses = [];
  const vals = [];
  if (q) { vals.push(`%${q}%`); clauses.push(`(name ILIKE $${vals.length} OR address ILIKE $${vals.length})`); }
  if (state) { vals.push(state); clauses.push(`state = $${vals.length}`); }
  if (type) { vals.push(type); clauses.push(`type = $${vals.length}`); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  try {
    const total = await query(`SELECT count(*)::int AS n FROM employers ${where}`, vals);
    const rows = await query(
      `SELECT id, name, category, type, address, zip, state, ugc_status, source
       FROM employers ${where} ORDER BY name LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, limit, offset]
    );
    res.json({ total: total.rows[0].n, limit, offset, employers: rows.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch employers" });
  }
});

// Distinct filter values for building dropdowns (declared before :id route).
app.get("/api/employers/meta", async (_req, res) => {
  try {
    const states = await query("SELECT DISTINCT state FROM employers WHERE state IS NOT NULL ORDER BY state");
    const types = await query("SELECT DISTINCT type FROM employers WHERE type IS NOT NULL ORDER BY type");
    res.json({ states: states.rows.map((r) => r.state), types: types.rows.map((r) => r.type) });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch employer metadata" });
  }
});

app.get("/api/employers/:id", async (req, res) => {
  try {
    const r = await query("SELECT * FROM employers WHERE id = $1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Employer not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch employer" });
  }
});

// Open positions posted against a given university.
app.get("/api/employers/:id/jobs", async (req, res) => {
  try {
    const r = await query(
      `${JOB_SELECT} WHERE j.university_id = $1 ORDER BY j.posted_at DESC`,
      [req.params.id]
    );
    res.json(r.rows.map(mapJob));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch university jobs" });
  }
});

/* ---------------- University leadership role catalog ---------------- */
// Categories with counts — handy for building category navigation in the UI.
app.get("/api/job-roles/categories", async (_req, res) => {
  try {
    const r = await query(
      `SELECT category_no, category_group, category,
              count(*)::int AS roles,
              count(*) FILTER (WHERE description_status = 'published')::int AS described
       FROM job_roles GROUP BY category_no, category_group, category
       ORDER BY category_no`
    );
    res.json({ categories: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/job-roles", async (req, res) => {
  const { q, category, group, seniority, status } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Number(req.query.offset) || 0;
  const clauses = [];
  const vals = [];
  if (q) { vals.push(`%${q}%`); clauses.push(`(title ILIKE $${vals.length} OR abbr ILIKE $${vals.length})`); }
  if (category) { vals.push(category); clauses.push(`category = $${vals.length}`); }
  if (group) { vals.push(group); clauses.push(`category_group = $${vals.length}`); }
  if (seniority) { vals.push(seniority); clauses.push(`seniority = $${vals.length}`); }
  if (status) { vals.push(status); clauses.push(`description_status = $${vals.length}`); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  try {
    const total = await query(`SELECT count(*)::int AS n FROM job_roles ${where}`, vals);
    const rows = await query(
      `SELECT id, category_no, category_group, category, title, abbr, level, scope_note,
              seniority, description, description_status
       FROM job_roles ${where}
       ORDER BY category_no, level NULLS LAST, title
       LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, limit, offset]
    );
    res.json({ total: total.rows[0].n, limit, offset, roles: rows.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch job roles" });
  }
});

app.get("/api/job-roles/:id", async (req, res) => {
  try {
    const r = await query("SELECT * FROM job_roles WHERE id = $1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Role not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch role" });
  }
});

// Fill in a role's description later. Empty/missing description resets to 'pending'.
app.patch("/api/job-roles/:id", authRequired, requireRole("employer"), async (req, res) => {
  const { description } = req.body || {};
  const desc = typeof description === "string" && description.trim() ? description.trim() : null;
  const status = desc ? "published" : "pending";
  try {
    const r = await query(
      `UPDATE job_roles SET description = $1, description_status = $2
       WHERE id = $3 RETURNING *`,
      [desc, status, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Role not found" });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update role" });
  }
});

/* ---------------- Candidates (sourced talent pool) — employer only ---------------- */
app.get("/api/candidates", authRequired, requireRole("employer"), async (req, res) => {
  const { q, title, location, seniority } = req.query;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Number(req.query.offset) || 0;
  const clauses = [], vals = [];
  if (q) { vals.push(`%${q}%`); const p = `$${vals.length}`;
    clauses.push(`(full_name ILIKE ${p} OR title ILIKE ${p} OR company ILIKE ${p} OR keywords ILIKE ${p} OR industry ILIKE ${p})`); }
  if (title) { vals.push(`%${title}%`); clauses.push(`title ILIKE $${vals.length}`); }
  if (location) { vals.push(`%${location}%`); const p = `$${vals.length}`;
    clauses.push(`(city ILIKE ${p} OR state ILIKE ${p} OR country ILIKE ${p})`); }
  if (seniority) { vals.push(seniority); clauses.push(`seniority = $${vals.length}`); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  try {
    const total = await query(`SELECT count(*)::int AS n FROM candidates ${where}`, vals);
    const rows = await query(
      `SELECT id, full_name, title, company, email, email_status, mobile_phone, work_phone,
              corporate_phone, linkedin_url, company_linkedin_url, website, city, state, country,
              seniority, industry, keywords, num_employees, source
       FROM candidates ${where} ORDER BY full_name
       LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, limit, offset]
    );
    res.json({ total: total.rows[0].n, limit, offset, candidates: rows.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

// Distinct titles / seniorities for the candidate-search filter dropdowns.
app.get("/api/candidates/meta", authRequired, requireRole("employer"), async (_req, res) => {
  try {
    const titles = await query("SELECT DISTINCT title FROM candidates WHERE title IS NOT NULL ORDER BY title");
    const seniorities = await query("SELECT DISTINCT seniority FROM candidates WHERE seniority IS NOT NULL ORDER BY seniority");
    res.json({ titles: titles.rows.map((r) => r.title), seniorities: seniorities.rows.map((r) => r.seniority) });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch candidate metadata" });
  }
});

// Full candidate record (employer only).
app.get("/api/candidates/:id", authRequired, requireRole("employer"), async (req, res) => {
  try {
    const r = await query("SELECT * FROM candidates WHERE id = $1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Candidate not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// Shortlist a sourced candidate onto one of my jobs (idempotent).
app.post("/api/candidates/:id/shortlist", authRequired, requireRole("employer"), async (req, res) => {
  const jobId = req.body && req.body.jobId;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });
  try {
    const owns = await query("SELECT id FROM jobs WHERE id = $1 AND employer_id = $2", [jobId, req.user.id]);
    if (!owns.rows[0]) return res.status(404).json({ error: "Job not found or not yours" });
    const r = await query(
      `INSERT INTO shortlists (job_id, candidate_id, employer_id)
       VALUES ($1, $2, $3) ON CONFLICT (job_id, candidate_id) DO NOTHING RETURNING id`,
      [jobId, req.params.id, req.user.id]
    );
    res.status(r.rows[0] ? 201 : 200).json({ ok: true, alreadyShortlisted: !r.rows[0] });
  } catch (e) {
    if (e.code === "23503") return res.status(404).json({ error: "Candidate or job not found" });
    console.error(e);
    res.status(500).json({ error: "Failed to shortlist" });
  }
});

// Import an Apollo CSV (text in the body) into the talent pool. Idempotent.
app.post("/api/candidates/import", authRequired, requireRole("employer"), async (req, res) => {
  const csv = req.body && req.body.csv;
  if (!csv || typeof csv !== "string") return res.status(400).json({ error: "Provide CSV text in { csv }" });
  try {
    const list = parseCandidatesCsv(csv);
    const processed = await upsertCandidates(list);
    const total = (await query("SELECT count(*)::int AS n FROM candidates")).rows[0].n;
    res.json({ ok: true, processed, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Import failed: " + e.message });
  }
});

/* ---------------- Applications ---------------- */
const STAGES = ["Applied", "Viewed", "Shortlisted", "Interview", "Decision"];

app.get("/api/applications", authRequired, async (req, res) => {
  try {
    const r = await query(
      `SELECT a.*, to_jsonb(j) AS job,
        floor(extract(epoch FROM now() - a.applied_at)/86400)::int AS applied_days
       FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.user_id = $1 ORDER BY a.applied_at DESC`,
      [req.user.id]
    );
    const out = r.rows.map((row) => ({
      id: row.id,
      jobId: String(row.job_id),
      job: mapJob({ ...row.job, live_applicants: 0 }),
      appliedDays: row.applied_days,
      stage: row.stage,
      status: row.status,
      note: row.note,
      stages: STAGES,
    }));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

app.post("/api/applications", authRequired, async (req, res) => {
  const { jobId, note } = req.body || {};
  if (!jobId) return res.status(400).json({ error: "jobId is required" });
  try {
    const r = await query(
      `INSERT INTO applications (user_id,job_id,note)
       VALUES ($1,$2,COALESCE($3,'Application submitted — recruiter notified'))
       ON CONFLICT (user_id,job_id) DO NOTHING
       RETURNING id`,
      [req.user.id, jobId, note || null]
    );
    if (!r.rows[0]) return res.status(409).json({ error: "Already applied to this job" });
    res.status(201).json({ id: r.rows[0].id, jobId: String(jobId), stage: 0, status: "active" });
  } catch (e) {
    if (e.code === "23503") return res.status(404).json({ error: "Job not found" });
    console.error(e);
    res.status(500).json({ error: "Failed to apply" });
  }
});

/* Employer ATS: applicants for one of my jobs */
app.get("/api/employer/jobs/:id/applicants", authRequired, requireRole("employer"), async (req, res) => {
  try {
    const owns = await query("SELECT id, title FROM jobs WHERE id=$1 AND employer_id=$2", [req.params.id, req.user.id]);
    if (!owns.rows[0]) return res.status(404).json({ error: "Job not found or not yours" });
    const r = await query(
      `SELECT a.id, a.stage, a.status, a.note, u.name, u.email,
        u.headline, u.experience, u.city, u.skills, u.resume,
        floor(extract(epoch FROM now() - a.applied_at)/86400)::int AS applied_days
       FROM applications a JOIN users u ON u.id = a.user_id
       WHERE a.job_id = $1 ORDER BY a.status='active' DESC, a.stage DESC, a.applied_at DESC`,
      [req.params.id]
    );
    const sourced = await query(
      `SELECT c.id, c.full_name, c.title, c.company, c.email, c.email_status,
              c.mobile_phone, c.work_phone, c.corporate_phone, c.linkedin_url,
              c.city, c.state, c.country, c.seniority
       FROM shortlists s JOIN candidates c ON c.id = s.candidate_id
       WHERE s.job_id = $1 ORDER BY s.created_at DESC`,
      [req.params.id]
    );
    res.json({
      job: { id: String(owns.rows[0].id), title: owns.rows[0].title },
      stages: STAGES,
      applicants: r.rows.map((a) => ({
        id: a.id, name: a.name, email: a.email,
        headline: a.headline, experience: a.experience, city: a.city,
        skills: a.skills || [], resume: a.resume || null,
        stage: a.stage, status: a.status, note: a.note, appliedDays: a.applied_days,
      })),
      sourced: sourced.rows.map((c) => ({
        id: c.id, name: c.full_name, title: c.title, company: c.company,
        email: c.email, emailStatus: c.email_status,
        phone: c.mobile_phone || c.work_phone || c.corporate_phone,
        linkedin: c.linkedin_url, seniority: c.seniority,
        location: [c.city, c.state, c.country].filter(Boolean).join(", "),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch applicants" });
  }
});

/* Employer ATS: advance/update an applicant (only on jobs I own) */
app.patch("/api/applications/:id", authRequired, requireRole("employer"), async (req, res) => {
  let { stage, status, note } = req.body || {};
  if (stage !== undefined && (stage < 0 || stage > STAGES.length - 1))
    return res.status(400).json({ error: `stage must be 0..${STAGES.length - 1}` });
  if (status !== undefined && !["active", "offer", "rejected"].includes(status))
    return res.status(400).json({ error: "status must be active, offer or rejected" });
  if (!note) {
    note = status === "offer" ? "Offer extended 🎉"
      : status === "rejected" ? "Not moving forward at this time"
      : stage !== undefined ? `Moved to ${STAGES[stage]} stage` : null;
  }
  try {
    const r = await query(
      `UPDATE applications a
         SET stage  = COALESCE($1, a.stage),
             status = COALESCE($2, a.status),
             note   = COALESCE($3, a.note)
       FROM jobs j
       WHERE a.id = $4 AND a.job_id = j.id AND j.employer_id = $5
       RETURNING a.id, a.stage, a.status, a.note`,
      [stage ?? null, status ?? null, note, req.params.id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Application not found or not yours" });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update application" });
  }
});

/* ---------------- Boot ---------------- */
// On serverless platforms (Vercel) the app is exported and invoked per-request,
// so we only start a long-running listener when not running under Vercel.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Naukri+ API listening on http://localhost:${PORT}`));
}

export default app;
