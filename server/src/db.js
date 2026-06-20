import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

// Accept whatever the host/integration provides. Manual setups use DATABASE_URL;
// the Vercel↔Neon/Postgres integration injects POSTGRES_URL / *_PRISMA_URL /
// *_UNPOOLED instead. Prefer pooled connection strings.
export const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";

// node-postgres lets a `sslmode=...` query param in the connection string
// OVERWRITE the ssl options object (see brianc/node-postgres#2375), which breaks
// hosted certs with "self-signed certificate in certificate chain". Strip those
// params and control SSL solely via the ssl option below.
function stripSslParams(cs) {
  if (!cs) return cs;
  try {
    const u = new URL(cs);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return cs.replace(/[?&](sslmode|ssl|channel_binding)=[^&]*/gi, "");
  }
}

// Hosted Postgres (Neon, etc.) requires SSL; local development does not.
// Override with PGSSL=disable / PGSSL=require if auto-detection is wrong.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const ssl =
  process.env.PGSSL === "disable" ? false
  : process.env.PGSSL === "require" ? { rejectUnauthorized: false }
  : isLocal ? false
  : { rejectUnauthorized: false };

export const pool = new Pool({ connectionString: stripSslParams(connectionString), ssl });

export const query = (text, params) => pool.query(text, params);
