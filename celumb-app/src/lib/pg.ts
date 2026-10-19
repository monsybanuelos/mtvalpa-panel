import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { cloudEnv } from "./cloud-env";

declare global {
  // eslint-disable-next-line no-var
  var __celumbPgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.__celumbPgPool) return globalThis.__celumbPgPool;
  const env = cloudEnv();
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL missing — set Supabase pooler URI in env/secrets.",
    );
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
  });
  globalThis.__celumbPgPool = pool;
  return pool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}

export async function withTx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}
