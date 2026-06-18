import { pool } from "./db.js";

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('candidate','employer')),
  company       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id             SERIAL PRIMARY KEY,
  employer_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  company        TEXT NOT NULL,
  logo_color     TEXT DEFAULT '#1875e5',
  logo_text      TEXT DEFAULT '?',
  verified       BOOLEAN NOT NULL DEFAULT false,
  location       TEXT NOT NULL,
  remote         TEXT NOT NULL DEFAULT 'On-site',
  type           TEXT NOT NULL DEFAULT 'Full-time',
  experience     TEXT,
  salary_min     INTEGER NOT NULL CHECK (salary_min > 0),
  salary_max     INTEGER NOT NULL CHECK (salary_max >= salary_min),
  posted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  openings       INTEGER NOT NULL DEFAULT 1,
  applicants_base INTEGER NOT NULL DEFAULT 0,
  skills         TEXT[] NOT NULL DEFAULT '{}',
  category       TEXT NOT NULL DEFAULT 'Other',
  match_score    INTEGER NOT NULL DEFAULT 80,
  match_reason   TEXT DEFAULT '',
  about          TEXT DEFAULT '',
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  requirements   TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS applications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stage       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','offer','rejected')),
  note        TEXT DEFAULT 'Application submitted — recruiter notified',
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
`;

async function main() {
  await pool.query(SQL);
  console.log("✓ Migration complete — tables ready.");
  await pool.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
