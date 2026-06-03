import "server-only";
import { neon } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// Postgres-backed key/value store (Neon).
//
// Each "collection" (services, agents, marketplace, …) is stored as one JSONB
// row keyed by name. This mirrors the old JSON-file model but persists durably
// — works on Vercel's read-only filesystem, survives cold starts + redeploys.
// ---------------------------------------------------------------------------

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.STORAGE_POSTGRES_URL ||
  process.env.STORAGE_URL;

const sql = url ? neon(url) : null;

export function hasDb(): boolean {
  return !!sql;
}

let ready: Promise<void> | null = null;
function ensure() {
  if (!sql) throw new Error("No Postgres connection string — set DATABASE_URL (or POSTGRES_URL).");
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS app_kv (key text PRIMARY KEY, value jsonb NOT NULL)`;
    })();
  }
  return ready;
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  await ensure();
  const rows = (await sql!`SELECT value FROM app_kv WHERE key = ${key}`) as { value: T }[];
  return rows.length ? rows[0].value : fallback;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await ensure();
  await sql!`INSERT INTO app_kv (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
