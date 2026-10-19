#!/usr/bin/env node
/** Quick Supabase R/W smoke. Does not print secrets. */
import fs from "fs";
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

async function main() {
  const env = loadSecrets();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  const c = new pg.Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const phones = await c.query(
    `SELECT COUNT(*)::int AS c FROM phones WHERE status='disponible'`,
  );
  const stock = "MBCTEST";
  await c.query(`DELETE FROM ledger WHERE stock_no=$1`, [stock]);
  await c.query(`DELETE FROM phones WHERE stock_no=$1`, [stock]);
  await c.query(
    `INSERT INTO phones (
      stock_no, acquired_at, cost, suggested_price, margin_suggested,
      includes_charger, brand, model, carrier, condition_label, status
    ) VALUES ($1,'2026-10-19',1,2,1,'No','Test','Cloud','Liberado','A Bueno (9-10)','disponible')`,
    [stock],
  );
  const row = await c.query(
    `SELECT stock_no, brand FROM phones WHERE stock_no=$1`,
    [stock],
  );
  await c.query(`DELETE FROM phones WHERE stock_no=$1`, [stock]);
  await c.end();
  console.log(
    JSON.stringify({
      ok: true,
      disponible: phones.rows[0].c,
      wrote: row.rows[0],
    }),
  );
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e.message);
  process.exit(1);
});
