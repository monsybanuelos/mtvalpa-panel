import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession, canAcquire } from "@/lib/auth";
import { useCloudDb } from "@/lib/cloud-env";
import {
  deleteStoredPhoto,
  saveReplacedPhonePhoto,
} from "@/lib/phone-photo-storage";
import { PHOTO_BUCKET, publicPhotoUrl, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;
const PHOTO_DIR = path.join(process.cwd(), "data", "phone-photos");

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);

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

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!canAcquire(session.role)) {
      return NextResponse.json(
        { ok: false, error: "Solo Admin puede subir fotos de adquisición." },
        { status: 403 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") ?? "1");
    const slotNum: 1 | 2 = slot === "2" ? 2 : 1;
    const phoneIdRaw = String(form.get("phoneId") ?? "").trim();
    let phoneId: number | null = null;
    if (phoneIdRaw) {
      const n = Number(phoneIdRaw);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json(
          { ok: false, error: "Equipo no válido." },
          { status: 400 },
        );
      }
      phoneId = n;
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Archivo requerido." },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La foto es demasiado grande (máx. 3 MB). Prueba otra o comprímela.",
        },
        { status: 400 },
      );
    }
    const type = (file.type || "").toLowerCase();
    const nameOk = /\.(jpe?g|png|heic|heif)$/i.test(file.name || "");
    if ((!type && !nameOk) || (type && !ALLOWED.has(type) && !nameOk)) {
      return NextResponse.json(
        { ok: false, error: "Formato no soportado. Usa JPEG, PNG o HEIC." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = extFor(type, file.name || "photo.jpg");
    const id = randomBytes(8).toString("hex");
    const filename = `adq-${slotNum}-${Date.now()}-${id}.${ext}`;

    let storedPath: string;
    let publicUrl: string;

    if (useCloudDb()) {
      const sb = supabaseAdmin();
      const { error } = await sb.storage.from(PHOTO_BUCKET).upload(filename, buf, {
        contentType: ALLOWED.has(type) ? type : "image/jpeg",
        upsert: false,
      });
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 },
        );
      }
      storedPath = publicPhotoUrl(filename);
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
          return NextResponse.json(
            { ok: false, error: "Equipo no encontrado." },
            { status: 404 },
          );
        }
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
      }
      revalidatePath("/inventario");
    }

    return NextResponse.json({
      ok: true,
      path: storedPath,
      url: publicUrl,
      message: "Foto subida con éxito",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al subir";
    const status =
      msg.includes("sesión") || msg.includes("iniciar") ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
