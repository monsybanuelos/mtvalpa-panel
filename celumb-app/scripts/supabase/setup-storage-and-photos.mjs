#!/usr/bin/env node
/**
 * Create Storage bucket `phone-photos` and upload local data/phone-photos/*.
 * Uses HTTPS service role (works when direct Postgres storage admin is awkward).
 * Does NOT print secrets.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
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

const BUCKET = "phone-photos";

async function main() {
  const env = loadSecrets();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or service role key");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ensure bucket via Storage API
  const { data: buckets, error: listErr } = await sb.storage.listBuckets();
  if (listErr) throw listErr;
  const exists = (buckets || []).some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    if (error) throw error;
    console.log("bucket_created", BUCKET, "public=true");
  } else {
    console.log("bucket_exists", BUCKET);
  }

  const dir = path.resolve("data/phone-photos");
  if (!fs.existsSync(dir)) {
    console.log("no local photos dir");
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  let uploaded = 0;
  for (const file of files) {
    const abs = path.join(dir, file);
    const buf = fs.readFileSync(abs);
    const contentType = file.endsWith(".png")
      ? "image/png"
      : file.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    const { error } = await sb.storage.from(BUCKET).upload(file, buf, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.log("upload_fail", file, error.message);
      continue;
    }
    uploaded++;
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(file);
    // Point phones.photo*_path at storage public URL when filename matches
    if (env.DATABASE_URL) {
      const client = new pg.Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      const publicUrl = pub.publicUrl;
      await client.query(
        `UPDATE phones SET photo1_path = $1
         WHERE photo1_path IS NOT NULL AND photo1_path LIKE '%' || $2`,
        [publicUrl, file],
      );
      await client.query(
        `UPDATE phones SET photo2_path = $1
         WHERE photo2_path IS NOT NULL AND photo2_path LIKE '%' || $2`,
        [publicUrl, file],
      );
      await client.end();
    }
    console.log("uploaded", file);
  }
  console.log("photos_uploaded", uploaded, "of", files.length);
}

main().catch((e) => {
  console.error("STORAGE_FAILED:", e.message || e);
  process.exit(1);
});
