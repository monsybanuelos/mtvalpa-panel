import fs from "node:fs";
import path from "node:path";

let cached: Record<string, string> | null = null;

/** Load env from process + optional Project secrets file (never log values). */
export function cloudEnv(): Record<string, string> {
  if (cached) return cached;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.length) out[k] = v;
  }
  const candidates = [
    process.env.CELUMB_SECRETS,
    "/cursor/stores/bc-01a14ca7-e7cb-7201-8575-dd029e780eef/internal/supabase.secrets.env",
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        if (!(k in out) || !out[k]) out[k] = v;
      }
    } catch {
      /* ignore */
    }
  }

  // Build DATABASE_URL from pieces if needed
  if (!out.DATABASE_URL && out.SUPABASE_PASSWORD && out.SUPABASE_PROJECT_REF) {
    const host =
      out.SUPABASE_DB_HOST || "aws-1-us-west-2.pooler.supabase.com";
    const port = out.SUPABASE_DB_PORT || "6543";
    const user = `postgres.${out.SUPABASE_PROJECT_REF}`;
    out.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(out.SUPABASE_PASSWORD)}@${host}:${port}/postgres`;
  }

  cached = out;
  return out;
}

export function useCloudDb(): boolean {
  const e = cloudEnv();
  return Boolean(e.DATABASE_URL || e.SUPABASE_SERVICE_ROLE_KEY);
}
