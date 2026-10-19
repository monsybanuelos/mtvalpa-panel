import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cloudEnv } from "./cloud-env";

let cached: SupabaseClient | null = null;

/** Service-role client for Storage + server writes. Never expose to the browser. */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const env = cloudEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / service role key missing");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const PHOTO_BUCKET = "phone-photos";

export function publicPhotoUrl(filename: string): string {
  const env = cloudEnv();
  return `${env.SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${filename}`;
}
