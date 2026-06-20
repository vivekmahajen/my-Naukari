# Deploying Naukri+ to Vercel + Neon

This app is set up to deploy as:

- **Frontend** — the static HTML/CSS/JS at the repo root, served by Vercel.
- **API** — the Express app in `server/`, run as a Vercel **serverless function**
  via `api/index.js` (requests to `/api/*` are routed to it by `vercel.json`).
- **Database** — **Neon** serverless PostgreSQL.

On every deploy, Vercel runs `npm run vercel-build` → `server/src/bootstrap.js`,
which **migrates the schema, seeds demo data only if the DB is empty, then loads
the 1,247 universities and 154 leadership roles**. It is idempotent, so it never
wipes existing data on later deploys.

---

## 1. Create the Neon database

1. Sign in at <https://neon.tech> and create a project (any region near you).
2. Open **Connection Details** and copy the **pooled** connection string. It
   looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```
   Use the host that contains **`-pooler`** — it suits serverless functions best.

## 2. Import the repo into Vercel

1. Sign in at <https://vercel.com> → **Add New… → Project** → import
   `vivekmahajen/my-naukari`.
2. **Framework Preset:** `Other` (it's a static site + serverless functions).
   Leave Build/Output settings as detected — `vercel.json` already sets the
   build command. Do **not** set an Output Directory.

## 3. Set Environment Variables (Production **and** Preview)

| Name | Value |
|------|-------|
| `DATABASE_URL` | your Neon **pooled** connection string (from step 1) |
| `JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |

Notes:
- `DATABASE_URL` must be set **before the first deploy** — the build step seeds
  the database and will fail without it.
- `VERCEL` is set automatically by the platform; it tells the API not to start a
  local listener.
- `CORS_ORIGIN` is **not** needed — the frontend and API share one origin.
- SSL is auto-enabled for non-local databases (Neon). Override with
  `PGSSL=disable` / `PGSSL=require` only if needed.

## 4. Deploy

Click **Deploy**. On the first build you should see the bootstrap output in the
logs:
```
✓ Migration complete — tables ready.
→ Empty database — seeding demo data.
✓ Employers import: 1247 new ...
✓ Job roles import: 154 new ...
✓ Bootstrap complete.
```
When it finishes, open the site:
- `/` — landing
- `/universities.html` — **search the 1,247 universities** (this is what you
  wanted live after deploy)
- `/jobs.html` — jobs
- API health check: `/api/health`

Demo logins: `aarav@example.com` / `employer@acme.com` — password `password123`.

---

## Re-seeding / running the bootstrap manually

You can run the exact same provisioning from your machine against Neon:

```bash
npm install
DATABASE_URL="<neon-pooled-url>" npm run bootstrap
```

This skips the demo seed if the DB already has jobs, and re-imports the
universities/roles idempotently.

## Local development (unchanged)

```bash
cd server && npm install && npm run setup && npm start   # API on :4000
python3 -m http.server 8000                              # frontend on :8000
```
The frontend auto-targets `http://localhost:4000/api` on localhost and `/api`
when deployed.

---

## Notes & caveats

- The repo is public, so serving source files statically exposes nothing new;
  secrets live only in Vercel environment variables, never in the repo.
- If you prefer **not** to seed on every deploy, remove `"buildCommand"` from
  `vercel.json` and run `npm run bootstrap` once manually instead.
- Neon free-tier databases can auto-suspend when idle; the first request after
  idle may be slightly slow while it wakes.
