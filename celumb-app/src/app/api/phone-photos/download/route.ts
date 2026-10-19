import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { useCloudDb } from "@/lib/cloud-env";
import { storageObjectName } from "@/lib/phone-photo-storage";
import { getSalesPhoto } from "@/lib/queries";
import { PHOTO_BUCKET, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const PHOTO_DIR = path.join(process.cwd(), "data", "phone-photos");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

function extOf(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  return MIME[ext] ? ext : "jpg";
}

function safeFilename(stockNo: string, slot: 1 | 2, ext: string): string {
  const stock = stockNo.replace(/[^A-Za-z0-9_-]/g, "") || "foto";
  return `${stock}-foto${slot}.${ext}`;
}

/** Read the object stored in photo1_path / photo2_path. Same file Ventas downloads. */
async function loadPhoto(
  stored: string,
): Promise<{ bytes: Buffer; ext: string } | null> {
  const name = storageObjectName(stored);
  if (useCloudDb() && name) {
    const { data, error } = await supabaseAdmin()
      .storage.from(PHOTO_BUCKET)
      .download(name);
    if (!error && data) {
      return {
        bytes: Buffer.from(await data.arrayBuffer()),
        ext: extOf(name),
      };
    }
  }

  if (/^https?:\/\//i.test(stored)) {
    const remote = await fetch(stored);
    if (!remote.ok) return null;
    const bytes = Buffer.from(await remote.arrayBuffer());
    let ext = extOf(stored.split("?")[0]?.split("/").pop() || "");
    const ctype = remote.headers.get("content-type") || "";
    const fromType = Object.entries(MIME).find(([, mime]) =>
      ctype.startsWith(mime),
    );
    if (fromType) ext = fromType[0] === "jpeg" ? "jpg" : fromType[0];
    return { bytes, ext };
  }

  if (!name) return null;
  const root = path.resolve(PHOTO_DIR);
  const abs = path.resolve(root, name);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(abs)) return null;
  return { bytes: fs.readFileSync(abs), ext: extOf(name) };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const slot = url.searchParams.get("slot") === "2" ? 2 : 1;
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Equipo inválido" }, { status: 400 });
  }

  const photo = await getSalesPhoto(id, slot);
  if (!photo) {
    return NextResponse.json({ error: "Sin foto" }, { status: 404 });
  }

  const loaded = await loadPhoto(photo.photo_path);
  if (!loaded) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const { bytes, ext } = loaded;

  const filename = safeFilename(photo.stock_no, slot, ext);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
