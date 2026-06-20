# Deploying Naukri+ to Vercel + Neon

This app is set up to deploy as:

- **Frontend** — the static HTML/CSS/JS at the repo root, served by Vercel.
- **API** — the Express app in `server/`, run as a Vercel **serverless function**
  via `api/index.js` (requests to `/api/*` are routed to it by `vercel.json`).
- **Database** — **Neon** serverless PostgreSQL.

Deployment is **zero-config**: static files at the repo root are served as-is,
and `/api/*` is routed to the Express function (`api/index.js`) by `vercel.json`.
The database is provisioned **once** with `npm run bootstrap` (step 4) — this is
more reliable than seeding during the build and also validates your connection
string. `bootstrap` is idempotent (migrate → seed only if empty → import the
1,247 universities + 154 roles), so it's safe to re-run any time.

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
   Leave Build & Output settings empty/default — `vercel.json` handles routing.
   Do **not** set a Build Command or an Output Directory.

## 3. Set Environment Variables — scope **Production** (and Preview)

In **Settings → Environment Variables**, add (tick the **Production** box):

| Name | Value |
|------|-------|
| `DATABASE_URL` | your Neon **pooled** connection string (from step 1) |
| `JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |

Notes:
- The name must be **exactly** `DATABASE_URL` (uppercase), and the **Production**
  scope must be ticked — a push to `main` is a Production deploy.
- After adding/changing env vars you must **redeploy** — existing deployments do
  not pick up env changes.
- `VERCEL` is set automatically by the platform; it tells the API not to start a
  local listener.
- `CORS_ORIGIN` is **not** needed — the frontend and API share one origin.
- SSL is auto-enabled for non-local databases (Neon). Override with
  `PGSSL=disable` / `PGSSL=require` only if needed.

## 4. Seed the database (one time)

From a clone of `main`, run the bootstrap against Neon. This also confirms your
connection string is valid before you rely on it in Vercel:

```bash
npm install
DATABASE_URL="<your-neon-pooled-url>" npm run bootstrap
```
You should see:
```
✓ Migration complete — tables ready.
→ Empty database — seeding demo data.
✓ Employers import: 1247 new ...
✓ Job roles import: 154 new ...
✓ Bootstrap complete.
```

## 5. Deploy

Click **Deploy** (or push to `main`). When it finishes, verify:
- `/api/health` → **`{"ok":true,"db":"up"}`** (function runs and reaches the DB)
- `/universities.html` → **search the 1,247 universities** (the goal)
- `/` — landing · `/jobs.html` — jobs

If `/api/health` shows source code or 404, the function isn't routing (check
`vercel.json`). If it shows `{"ok":false,"db":"down"}`, the function runs but
`DATABASE_URL` isn't set on the Production runtime (revisit step 3 + redeploy).

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
