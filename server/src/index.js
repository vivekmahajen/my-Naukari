import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query } from "./db.js";
import { signToken, authOptional, authRequired, requireRole } from "./auth.js";

dotenv.config();

const app = express();
app.use(express.json());

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
  };
}

const JOB_SELECT = `
  SELECT j.*, (SELECT count(*) FROM applications a WHERE a.job_id = j.id) AS live_applicants
  FROM jobs j`;

/* ---------------- Health ---------------- */
app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
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
  if (!b.title || !b.location || !b.salaryMin || !b.salaryMax)
    return res.status(400).json({ error: "title, location, salaryMin and salaryMax are required" });
  if (Number(b.salaryMax) < Number(b.salaryMin))
    return res.status(400).json({ error: "salaryMax must be >= salaryMin" });
  try {
    const company = b.company || req.user.company || "Company";
    const logoText = (company.trim()[0] || "?").toUpperCase() +
      (company.trim().split(" ")[1]?.[0]?.toUpperCase() || "");
    const r = await query(
      `INSERT INTO jobs
        (employer_id,title,company,logo_text,verified,location,remote,type,experience,
         salary_min,salary_max,openings,skills,category,match_score,match_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,100,'Newly posted role.')
       RETURNING id`,
      [req.user.id, b.title, company, logoText, !!b.verified, b.location,
       b.remote || "On-site", b.type || "Full-time", b.experience || null,
       Number(b.salaryMin), Number(b.salaryMax), Number(b.openings) || 1,
       Array.isArray(b.skills) ? b.skills : String(b.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
       b.category || "Other"]
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

/* ---------------- Boot ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Naukri+ API listening on http://localhost:${PORT}`));
