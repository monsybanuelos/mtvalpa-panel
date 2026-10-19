import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { requireSession, canAcquire } from "@/lib/auth";
import { useCloudDb } from "@/lib/cloud-env";
import { PHOTO_BUCKET, publicPhotoUrl, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;
const PHOTO_DIR = path.join(process.cwd(), "data", "phone-photos");

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
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
    const type = (file.type || "image/jpeg").toLowerCase();
    if (type && !ALLOWED.has(type) && !type.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: "Formato no soportado. Usa una foto del iPhone." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = extFor(type, file.name || "photo.jpg");
    const id = randomBytes(8).toString("hex");
    const filename = `adq-${slot}-${Date.now()}-${id}.${ext}`;

    if (useCloudDb()) {
      const sb = supabaseAdmin();
      const { error } = await sb.storage.from(PHOTO_BUCKET).upload(filename, buf, {
        contentType: type.startsWith("image/") ? type : "image/jpeg",
        upsert: true,
      });
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 },
        );
      }
      const url = publicPhotoUrl(filename);
      return NextResponse.json({
        ok: true,
        path: url,
        url,
        message: "Foto subida con éxito",
      });
    }

    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    const abs = path.join(PHOTO_DIR, filename);
    fs.writeFileSync(abs, buf);
    const rel = `phone-photos/${filename}`;
    return NextResponse.json({
      ok: true,
      path: rel,
      url: `/api/phone-photos/${filename}`,
      message: "Foto subida con éxito",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al subir";
    const status =
      msg.includes("sesión") || msg.includes("iniciar") ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
