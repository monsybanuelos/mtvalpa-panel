import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession, canAcquire } from "@/lib/auth";
import { useCloudDb } from "@/lib/cloud-env";
import {
  deleteStoredPhoto,
  saveReplacedPhonePhoto,
  storageContentType,
  uploadPhonePhotoObject,
} from "@/lib/phone-photo-storage";

const MAX_BYTES = 8 * 1024 * 1024;
const PHOTO_DIR = path.join(process.cwd(), "data", "phone-photos");

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);

export type PhonePhotoUploadResult =
  | { ok: true; path: string; url: string; message: string }
  | { ok: false; error: string; status: number };

function extFor(type: string, name: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("heic") || type.includes("heif")) return "heic";
  const fromName = name.split(".").pop()?.toLowerCase();
  if (
    fromName &&
    ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"].includes(fromName)
  ) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "jpg";
}

/** Store one admin photo and, when phoneId is set, write that phone's slot. */
export async function ingestPhonePhoto(
  form: FormData,
): Promise<PhonePhotoUploadResult> {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Debes iniciar sesión.";
    const status = msg.includes("sesión") || msg.includes("iniciar") ? 401 : 500;
    return { ok: false, error: msg, status };
  }
  if (!canAcquire(session.role)) {
    return {
      ok: false,
      error: "Solo Admin puede subir fotos de adquisición.",
      status: 403,
    };
  }

  const file = form.get("file");
  const slot = String(form.get("slot") ?? "1");
  const slotNum: 1 | 2 = slot === "2" ? 2 : 1;
  const phoneIdRaw = String(form.get("phoneId") ?? "").trim();
  let phoneId: number | null = null;
  if (phoneIdRaw) {
    const n = Number(phoneIdRaw);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: "Equipo no válido.", status: 400 };
    }
    phoneId = n;
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Archivo requerido.", status: 400 };
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return {
      ok: false,
      error: "La foto es demasiado grande (máx. 8 MB). Prueba otra o comprímela.",
      status: 400,
    };
  }
  const type = (file.type || "").toLowerCase();
  const nameOk = /\.(jpe?g|png|heic|heif)$/i.test(file.name || "");
  if ((!type && !nameOk) || (type && !ALLOWED.has(type) && !nameOk)) {
    return {
      ok: false,
      error: "Formato no soportado. Usa JPEG, PNG o HEIC.",
      status: 400,
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extFor(type, file.name || "photo.jpg");
  const id = randomBytes(8).toString("hex");
  const filename = `adq-${slotNum}-${Date.now()}-${id}.${ext}`;

  let storedPath: string;
  let publicUrl: string;

  if (useCloudDb()) {
    try {
      storedPath = await uploadPhonePhotoObject(
        filename,
        buf,
        storageContentType(type, ext),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir la foto.";
      return { ok: false, error: message, status: 500 };
    }
    publicUrl = storedPath;
  } else {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    const abs = path.join(PHOTO_DIR, filename);
    fs.writeFileSync(abs, buf);
    storedPath = `phone-photos/${filename}`;
    publicUrl = `/api/phone-photos/${filename}`;
  }

  if (phoneId) {
    try {
      await saveReplacedPhonePhoto({
        phoneId,
        slot: slotNum,
        path: storedPath,
      });
    } catch (err) {
      await deleteStoredPhoto(storedPath).catch(() => undefined);
      const msg = err instanceof Error ? err.message : "No se pudo guardar la foto.";
      if (msg === "NOT_FOUND") {
        return { ok: false, error: "Equipo no encontrado.", status: 404 };
      }
      return { ok: false, error: msg, status: 500 };
    }
    revalidatePath("/inventario");
    revalidatePath("/inventario/editar", "layout");
  }

  return {
    ok: true,
    path: storedPath,
    url: publicUrl,
    message: "Foto subida con éxito",
  };
}
