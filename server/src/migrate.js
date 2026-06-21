import { fileURLToPath } from "url";
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

-- Directory of potential employers (e.g. universities). Distinct from registered
-- employer user accounts in "users"; an entry can later be claimed by a user.
CREATE TABLE IF NOT EXISTS employers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'University',
  type        TEXT,                         -- e.g. State / Private / Central / Deemed
  address     TEXT,
  zip         TEXT,
  state       TEXT,
  ugc_status  TEXT,                         -- UGC recognition, e.g. 2(f), 12(B)
  source      TEXT,
  claimed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalog of standard university leadership roles (taxonomy from the role
-- reference). Reusable templates: a job posting can later be created from a role.
-- "description" is intentionally nullable and filled in later via the workflow
-- tracked by "description_status" (pending -> draft -> published).
CREATE TABLE IF NOT EXISTS job_roles (
  id                 SERIAL PRIMARY KEY,
  category_no        INTEGER,            -- section 1..11
  category_group     TEXT NOT NULL,      -- slug, e.g. 'apex', 'academic'
  category           TEXT NOT NULL,      -- display name of the section
  title              TEXT NOT NULL,      -- the position, e.g. 'Vice-Chancellor (VC)'
  abbr               TEXT,               -- e.g. VC, HOD, COE, CIO
  level              INTEGER,            -- apex hierarchy level (1..9), else null
  scope_note         TEXT,              -- short role note from the reference
  seniority          TEXT,              -- derived bucket for filtering
  description        TEXT,              -- ADDED LATER (nullable by design)
  description_status TEXT NOT NULL DEFAULT 'pending'
                     CHECK (description_status IN ('pending','draft','published')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sourced talent pool (e.g. Apollo CSV exports). Distinct from "users"
-- (login accounts): these are prospected contacts, no authentication.
CREATE TABLE IF NOT EXISTS candidates (
  id                   SERIAL PRIMARY KEY,
  apollo_contact_id    TEXT UNIQUE,
  first_name           TEXT,
  last_name            TEXT,
  full_name            TEXT,
  title                TEXT,
  company              TEXT,
  email                TEXT,
  email_status         TEXT,
  seniority            TEXT,
  departments          TEXT,
  work_phone           TEXT,
  mobile_phone         TEXT,
  corporate_phone      TEXT,
  linkedin_url         TEXT,
  company_linkedin_url TEXT,
  website              TEXT,
  twitter_url          TEXT,
  facebook_url         TEXT,
  city                 TEXT,
  state                TEXT,
  country              TEXT,
  industry             TEXT,
  keywords             TEXT,
  num_employees        INTEGER,
  source               TEXT DEFAULT 'Apollo',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employer shortlists a sourced candidate (talent pool) onto one of their jobs,
-- bringing sourced leads into the ATS pipeline.
CREATE TABLE IF NOT EXISTS shortlists (
  id           SERIAL PRIMARY KEY,
  job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  employer_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stage        INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'sourced',
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

-- Added via ALTER so it also lands on databases created before this column.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS university_id INTEGER REFERENCES employers(id) ON DELETE SET NULL;

-- Candidate profile fields (skills/experience/résumé) for richer applicants.
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS headline   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skills     TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS resume     JSONB;

CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_university ON jobs(university_id);
CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employers_name ON employers (lower(name));
CREATE INDEX IF NOT EXISTS idx_employers_state ON employers (state);
CREATE INDEX IF NOT EXISTS idx_employers_type ON employers (type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_roles_unique ON job_roles (lower(title), category_group);
CREATE INDEX IF NOT EXISTS idx_job_roles_group ON job_roles (category_group);
CREATE INDEX IF NOT EXISTS idx_job_roles_status ON job_roles (description_status);
CREATE INDEX IF NOT EXISTS idx_candidates_title ON candidates (title);
CREATE INDEX IF NOT EXISTS idx_shortlists_job ON shortlists (job_id);
`;

export async function migrate() {
  await pool.query(SQL);
  console.log("✓ Migration complete — tables ready.");
}

// Run + close the pool only when invoked directly (node src/migrate.js).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => pool.end())
    .catch((e) => { console.error("Migration failed:", e); process.exit(1); });
}
