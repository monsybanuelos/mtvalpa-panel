#!/usr/bin/env node
/**
 * Migrate /agent/celumb/data/celumb.db → Supabase Postgres (pooler).
 * Loads secrets from CELUMB_SECRETS / Project store. Does NOT print secrets.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import pg from "pg";

function loadSecrets() {
  const p =
    process.env.CELUMB_SECRETS ||
    "/cursor/stores/bc-01a14ca7-e7cb-7201-8575-dd029e780eef/internal/supabase.secrets.env";
  const env = { ...process.env };
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!(k in env) || !env[k]) env[k] = v;
    }
  }
  return env;
}

function buildUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  throw new Error(
    "Missing DATABASE_URL (pooler URI). Direct db.*.supabase.co is IPv6-only from this VM.",
  );
}

const TABLES = [
  "phones",
  "accessories",
  "sales",
  "credit_accounts",
  "collections",
  "supplier_credits",
  "ledger",
];

async function main() {
  const env = loadSecrets();
  const url = buildUrl(env);
  const sqlitePath = path.resolve("data/celumb.db");
  if (!fs.existsSync(sqlitePath)) throw new Error("Missing " + sqlitePath);

  const schema = fs.readFileSync(
    path.resolve("scripts/supabase/schema.sql"),
    "utf8",
  );
  const sqlite = new Database(sqlitePath, { readonly: true });
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected via pooler");
  await client.query(schema);

  for (const t of [
    "collections",
    "credit_accounts",
    "sales",
    "ledger",
    "supplier_credits",
    "accessories",
    "phones",
  ]) {
    await client.query(`DELETE FROM ${t}`);
  }

  for (const table of TABLES) {
    let rows;
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch (e) {
      console.log(table, "SKIP sqlite", e.message.slice(0, 60));
      continue;
    }
    if (!rows.length) {
      console.log(table, 0);
      continue;
    }
    // Only insert columns that exist on Postgres
    const pgCols = (
      await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`,
        [table],
      )
    ).rows.map((r) => r.column_name);
    const cols = Object.keys(rows[0]).filter((c) => pgCols.includes(c));
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const insert = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;
    for (const row of rows) {
      await client.query(
        insert,
        cols.map((c) => row[c]),
      );
    }
    if (cols.includes("id")) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
      );
    }
    console.log(table, rows.length);
  }

  await client.end();
  console.log("Migration complete");
}

main().catch((e) => {
  console.error("MIGRATE_FAILED:", e.code || "", e.message);
  process.exit(1);
});
