import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { canAcquire, requireSession } from "@/lib/auth";
import { useCloudDb } from "@/lib/cloud-env";
import { q1 } from "@/lib/pg";
import {
  PHOTO_BUCKET,
  publicPhotoUrl,
  supabaseAdmin,
} from "@/lib/supabase-admin";
import { saveReplacedPhonePhoto } from "@/lib/phone-photo-storage";

const MAX_BYTES = 8 * 1024 * 1024;

/** Names this app creates. The browser cannot choose another object. */
const OBJECT_NAME =
  /^adq-[12]-\d{10,16}-[a-f0-9]{16}\.(jpg|png|heic|heif)$/;

const EXTS = ["jpg", "png", "heic", "heif"] as const;
type PhotoExt = (typeof EXTS)[number];

export type PreparePhotoResult =
  | { ok: true; objectName: string; signedUrl: string }
  | { ok: false; error: string; fallback?: boolean };

export type CommitPhotoResult =
  | { ok: true; path: string; message: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireSession();
    if (!canAcquire(session.role)) {
      return { ok: false, error: "Solo Admin puede subir fotos de adquisición." };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Debes iniciar sesión.";
    return { ok: false, error: msg };
  }
}

function asExt(value: string): PhotoExt | null {
  const ext = value.toLowerCase();
  return (EXTS as readonly string[]).includes(ext) ? (ext as PhotoExt) : null;
}

/**
 * Mint a one-object upload URL. The file itself never passes through this server.
 */
export async function prepareDirectPhonePhoto(input: {
  slot: number;
  ext: string;
}): Promise<PreparePhotoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (!useCloudDb()) {
    return { ok: false, error: "local", fallback: true };
  }
  const slot = input.slot === 2 ? 2 : input.slot === 1 ? 1 : 0;
  if (slot !== 1 && slot !== 2) return { ok: false, error: "Foto no válida." };
  const ext = asExt(input.ext);
  if (!ext) return { ok: false, error: "Formato no soportado. Usa JPEG, PNG o HEIC." };

  const objectName = `adq-${slot}-${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const { data, error } = await supabaseAdmin()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(objectName);
  if (error || !data?.signedUrl) {
    return { ok: false, error: "No se pudo preparar la subida." };
  }
  return { ok: true, objectName, signedUrl: data.signedUrl };
}

/**
 * After the browser has stored the object, point the phone at its public URL.
 * With no phoneId, return the URL so a new acquisition can save it with the form.
 */
export async function commitDirectPhonePhoto(input: {
  slot: number;
  objectName: string;
  phoneId?: number;
}): Promise<CommitPhotoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (!useCloudDb()) {
    return { ok: false, error: "No se pudo guardar la foto." };
  }
  const slot = input.slot === 2 ? 2 : input.slot === 1 ? 1 : 0;
  if (slot !== 1 && slot !== 2) return { ok: false, error: "Foto no válida." };
  const objectName = String(input.objectName || "").trim();
  if (!OBJECT_NAME.test(objectName) || !objectName.startsWith(`adq-${slot}-`)) {
    return { ok: false, error: "La foto no se guardó. Intenta subirla otra vez." };
  }

  const row = await q1<{ size: string | number; mimetype: string }>(
    `SELECT COALESCE((metadata->>'size')::bigint, 0) AS size,
            COALESCE(metadata->>'mimetype', '') AS mimetype
     FROM storage.objects
     WHERE bucket_id = $1 AND name = $2`,
    [PHOTO_BUCKET, objectName],
  );
  const size = Number(row?.size ?? 0);
  if (!row || !Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return { ok: false, error: "La foto no se guardó. Intenta subirla otra vez." };
  }

  const path = publicPhotoUrl(objectName);
  const phoneId = input.phoneId;
  if (phoneId != null) {
    if (!Number.isInteger(phoneId) || phoneId <= 0) {
      return { ok: false, error: "Equipo no válido." };
    }
    try {
      await saveReplacedPhonePhoto({ phoneId, slot, path });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar la foto.";
      if (msg === "NOT_FOUND") return { ok: false, error: "Equipo no encontrado." };
      return { ok: false, error: msg };
    }
    revalidatePath("/inventario");
    revalidatePath("/inventario/editar", "layout");
  }

  return { ok: true, path, message: "Foto subida con éxito" };
}
