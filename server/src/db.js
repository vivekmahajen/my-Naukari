import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;
const url = process.env.DATABASE_URL || "";

// Hosted Postgres (Neon, etc.) requires SSL; local development does not.
// Override with PGSSL=disable / PGSSL=require if auto-detection is wrong.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const ssl =
  process.env.PGSSL === "disable" ? false
  : process.env.PGSSL === "require" ? { rejectUnauthorized: false }
  : isLocal ? false
  : { rejectUnauthorized: false };

export const pool = new Pool({ connectionString: url, ssl });

export const query = (text, params) => pool.query(text, params);
