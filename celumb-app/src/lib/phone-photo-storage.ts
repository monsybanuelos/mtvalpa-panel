import fs from "node:fs";
import path from "node:path";
import { useCloudDb } from "./cloud-env";
import { updatePhonePhoto } from "./db";
import { updatePhonePhotoCloud } from "./cloud-mutate";
import { PHOTO_BUCKET, supabaseAdmin } from "./supabase-admin";

const PHOTO_DIR = path.join(process.cwd(), "data", "phone-photos");

/** Object key inside the phone-photos bucket, or the local file name. */
export function storageObjectName(
  photoPath: string | null | undefined,
): string | null {
  if (!photoPath) return null;
  const raw = photoPath.trim();
  if (!raw || raw.includes("..")) return null;
  const noQuery = raw.split("?")[0]?.split("#")[0] ?? "";
  const marker = `/${PHOTO_BUCKET}/`;
  const idx = noQuery.lastIndexOf(marker);
  const tail =
    idx >= 0 ? noQuery.slice(idx + marker.length) : noQuery.split("/").pop() || "";
  let name = tail;
  try {
    name = decodeURIComponent(tail);
  } catch {
    name = tail;
  }
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..")
  ) {
    return null;
  }
  return name;
}

export function sameStoredPhoto(
  previous: string | null | undefined,
  next: string | null | undefined,
): boolean {
  const a = storageObjectName(previous);
  const b = storageObjectName(next);
  return Boolean(a && b && a === b);
}

/** Remove one stored photo. Missing files are ignored. */
export async function deleteStoredPhoto(
  photoPath: string | null | undefined,
): Promise<void> {
  const name = storageObjectName(photoPath);
  if (!name) return;

  if (useCloudDb()) {
    const { error } = await supabaseAdmin().storage.from(PHOTO_BUCKET).remove([
      name,
    ]);
    if (error && !/not found|does not exist/i.test(error.message)) {
      throw new Error(error.message);
    }
    return;
  }

  const root = path.resolve(PHOTO_DIR);
  const abs = path.resolve(root, name);
  if (abs !== root && !abs.startsWith(root + path.sep)) return;
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

/**
 * Point the phone slot at `path`, then delete the previous Storage object.
 * The previous file is removed only after the new path is stored.
 * Callers must upload the new file first and delete that new file themselves
 * if this throws, so a failed save leaves the existing photo in place.
 */
export async function saveReplacedPhonePhoto(p: {
  phoneId: number;
  slot: 1 | 2;
  path: string;
}): Promise<void> {
  const { previous } = useCloudDb()
    ? await updatePhonePhotoCloud({
        id: p.phoneId,
        slot: p.slot,
        path: p.path,
      })
    : updatePhonePhoto(p.phoneId, p.slot, p.path);

  if (!previous || sameStoredPhoto(previous, p.path)) return;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await deleteStoredPhoto(previous);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  console.error(
    "No se pudo borrar la foto anterior:",
    lastError instanceof Error ? lastError.message : "error",
  );
}
