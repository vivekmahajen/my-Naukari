# Naukri+ — A Better Job Platform

> Built with the **website-analyzer-builder** workflow: analyze Naukri.com → benchmark competitors → gap analysis → rebuild preserving Naukri's visual identity while closing every gap.

**Naukri+** is a working front-end prototype of a job platform that keeps Naukri's familiar
blue identity but fixes the six issues that show up again and again in real Naukri reviews:
spam listings, irrelevant recommendations, no application visibility, hidden salaries,
stale duplicate posts, and weak candidate support.

Open `index.html` in a browser — no build step required.

---

## Phase 1 — Target Analysis: Naukri.com

| Area | Findings |
|------|----------|
| **Identity** | Naukri blue wordmark, white cards on light-grey canvas, dense information layout |
| **Core features** | Keyword/location search, resume upload, recruiter CV database (78M+), job alerts, paid visibility |
| **Strengths** | ~62–70% market share, ~200k daily listings, deep entry/mid-tier reach, recruiter liquidity |
| **Architecture** | SSR + SPA hybrid, legacy widgets + newer React modules, heavy ad/tracking scripts |

## Phase 2 — Competitor Benchmarking

| Platform | Edge over Naukri |
|----------|------------------|
| **LinkedIn** | Transparent "X applicants · posted Yd ago", referral graph, employer branding |
| **Indeed** | Clean search, fresher listings, 1-click apply |
| **Foundit** | Personalized recommendations, salary ranges, skill/trend insights |
| **Wellfound / Instahyre / Hirist** | Upfront salary, verified employers, recruiter response SLAs |
| **Glassdoor** | Salary + company transparency, reviews |

## Phase 3 — Gap Analysis

| # | Gap (from real Naukri reviews) | Severity | Fix shipped in Naukri+ |
|---|--------------------------------|----------|------------------------|
| 1 | Spam / fraudulent listings | High | **Verified-employer badge** + report flow |
| 2 | Irrelevant recommendations | High | **Explainable AI match score** ("why this matched") |
| 3 | No application-status visibility | High | **Application tracker**: Applied → Viewed → Shortlisted → Decision |
| 4 | Hidden salaries | Medium | **Mandatory salary range** on every card |
| 5 | Outdated / duplicate posts | Medium | **Freshness badge** + auto-expiry indicator |
| 6 | Spammy calls / weak support | Medium | **In-app messaging** + contact controls |

## Phase 4 — Design System (preserved Naukri identity)

See `assets/css/styles.css` for tokens. Highlights:

- **Primary blue** `#1875e5` (Naukri-family) · **Navy** `#12283f`
- **Verified green** `#14a800` · **Canvas** `#f3f5f8` · white cards, soft shadows
- System sans-serif stack, dense-but-breathable card layout

## Phase 5 — Rebuild

| Page | What it demonstrates |
|------|----------------------|
| `index.html` | Hero search, trust signals, differentiators vs Naukri, featured verified jobs |
| `jobs.html` | Search + filters, match score, verified badge, salary, freshness on every card |
| `job.html` | Job detail with full **transparency panel** (applicants, salary, hiring timeline) |
| `dashboard.html` | Candidate **application tracker** with live status stages |

## Project structure

```
.
├── index.html          # Landing
├── jobs.html           # Search + listings
├── job.html            # Job detail (?id=)
├── dashboard.html      # Candidate application tracker
├── employer.html       # Employer ATS dashboard (applicants per job)
├── post-job.html       # Employer posting page
├── assets/
│   ├── css/styles.css  # Design system
│   └── js/
│       ├── data.js     # Mock jobs (offline fallback)
│       └── app.js      # API client + rendering / search / auth
├── server/             # Express + PostgreSQL + JWT API
│   ├── package.json
│   ├── .env.example
│   ├── data/
│   │   ├── universities.json   # 1,247 UGC universities (potential employers)
│   │   └── university_roles.json # 154 leadership role templates
│   └── src/
│       ├── index.js            # Routes
│       ├── db.js               # pg pool
│       ├── auth.js             # JWT helpers + middleware
│       ├── migrate.js          # Schema
│       ├── seed.js             # Demo data
│       ├── import_employers.js # Loads universities.json into employers
│       └── import_job_roles.js # Loads university_roles.json into job_roles
└── .claude/skills/website-analyzer-builder/SKILL.md
```

## Backend (Express + PostgreSQL + JWT auth)

The frontend is wired to a real API in `server/`. It falls back to the bundled
mock data when the API is unreachable, so the static site still works offline.

### API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/auth/register` | – | Create candidate or employer account |
| `POST` | `/api/auth/login` | – | Log in, returns JWT |
| `GET`  | `/api/auth/me` | Bearer | Current user |
| `GET`  | `/api/jobs` | – | List/search jobs (`?q=&location=&category=&remote=&verified=true&fresh=true`) |
| `GET`  | `/api/jobs/:id` | – | Single job |
| `POST` | `/api/jobs` | Employer | Post a job (salary range required) |
| `GET`  | `/api/employer/jobs` | Employer | My posted jobs (with live applicant counts) |
| `GET`  | `/api/employer/jobs/:id/applicants` | Employer | Applicants for one of my jobs (ATS) |
| `PATCH`| `/api/applications/:id` | Employer | Move an applicant's stage/status (syncs to candidate) |
| `GET`  | `/api/applications` | Bearer | My applications + live stages |
| `POST` | `/api/applications` | Bearer | Apply to a job (deduped) |
| `GET`  | `/api/employers` | – | Potential-employer directory (`?q=&state=&type=&limit=&offset=`) |
| `GET`  | `/api/employers/:id` | – | Single potential employer |
| `GET`  | `/api/job-roles/categories` | – | Role categories with counts |
| `GET`  | `/api/job-roles` | – | University leadership role catalog (`?q=&group=&category=&seniority=&status=`) |
| `GET`  | `/api/job-roles/:id` | – | Single role |
| `PATCH`| `/api/job-roles/:id` | Employer | Fill in a role's description later |

### Database schema

`users` (candidate/employer + bcrypt hash) · `jobs` (salary required by CHECK
constraint) · `applications` (unique per user+job, stage/status tracking) ·
`employers` (directory of **potential employers** such as universities; unique on
`lower(name)`, claimable by a user). Seeded from `server/data/universities.json`
(1,247 UGC-listed universities) via `npm run import:employers` — idempotent.

`job_roles` (catalog of **154 standard university leadership positions** across 11
categories — Apex, Academic, School/Faculty, Department, Administrative, Research,
Student Affairs, Online/ODL, Industry, Accreditation, Specialized). Reusable role
templates; `description` is **nullable by design and added later**, with a
`description_status` workflow (`pending → draft → published`). Seeded from
`server/data/university_roles.json` via `npm run import:roles` — idempotent and
never overwrites a description that was filled in later.

### Setup & run

```bash
# 1. Start PostgreSQL and create the database + role
#    (in this environment Postgres 16 is already configured as below)
createdb naukriplus   # or use your own DATABASE_URL

# 2. Backend
cd server
cp .env.example .env          # adjust DATABASE_URL / JWT_SECRET
npm install
npm run setup                 # migrate + seed (8 jobs, demo users)
npm start                     # API on http://localhost:4000

# 3. Frontend (separate terminal, from repo root)
python3 -m http.server 8000   # visit http://localhost:8000
```

**Demo logins:** `aarav@example.com` (candidate) · `employer@acme.com` (employer) — password `password123`.

The frontend's API base defaults to `http://localhost:4000/api`; override in the
browser with `localStorage.setItem('naukriplus_api', 'https://your-api/api')`.

## Run (frontend only / offline)

```bash
# Any static server, or just open the file — falls back to mock data:
python3 -m http.server 8000   # then visit http://localhost:8000
```
