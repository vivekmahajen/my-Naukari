#!/bin/bash
# SessionStart hook for Naukri+ — prepares the backend for Claude Code on the web:
# starts PostgreSQL, ensures the DB + role, installs deps, migrates, seeds (once),
# and launches the API. Synchronous + idempotent (safe on startup/resume/compact).
set -euo pipefail

# Web-only: do nothing on local machines.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SERVER_DIR="$PROJECT_DIR/server"
DB_NAME="naukriplus"
DB_USER="naukri"
DB_PASS="naukri_dev_pw"

log() { echo "[session-start] $*"; }

# 1. Start PostgreSQL (no-op if already running).
log "Starting PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 20); do
  if su postgres -c "pg_isready -q" 2>/dev/null; then break; fi
  sleep 1
done

# 2. Ensure role + database exist (idempotent).
log "Ensuring database role and schema..."
if ! su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1; then
  su postgres -c "psql -c \"CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'\""
fi
if ! su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1; then
  su postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}\""
fi

# 3. Create server/.env from the template if missing (it is git-ignored).
if [ ! -f "$SERVER_DIR/.env" ]; then
  log "Creating server/.env from .env.example..."
  cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
fi

# 4. Install backend dependencies (npm install benefits from container caching).
log "Installing backend dependencies..."
cd "$SERVER_DIR"
npm install --no-audit --no-fund

# 5. Migrate (idempotent) and seed only when the DB is empty (preserves data on resume).
log "Running migrations..."
npm run migrate
JOB_COUNT="$(PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -tAc 'SELECT count(*) FROM jobs' 2>/dev/null || echo 0)"
if [ "${JOB_COUNT:-0}" = "0" ]; then
  log "Seeding demo data..."
  npm run seed
else
  log "Data already present (${JOB_COUNT} jobs) — skipping seed."
fi

# Import potential-employer directory (universities); idempotent (ON CONFLICT DO NOTHING).
log "Importing employer directory..."
npm run import:employers

# Import the university leadership role catalog; idempotent (descriptions preserved).
log "Importing job-role catalog..."
npm run import:roles

# 6. Start the API in the background if it is not already serving.
if curl -sf http://localhost:4000/api/health >/dev/null 2>&1; then
  log "API already running on :4000."
else
  log "Starting API server on :4000..."
  nohup node "$SERVER_DIR/src/index.js" > /tmp/naukri-api.log 2>&1 &
  disown 2>/dev/null || true
fi

# 7. Expose config to the session shell.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo "export PORT=4000"
  } >> "$CLAUDE_ENV_FILE"
fi

log "Setup complete. Frontend: python3 -m http.server 8000  ·  API: http://localhost:4000"
