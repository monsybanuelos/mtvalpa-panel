import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { getSalesPhoto } from "@/lib/queries";

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

  const stored = photo.photo_path;
  let bytes: Buffer;
  let ext = "jpg";

  if (/^https?:\/\//i.test(stored)) {
    const remote = await fetch(stored);
    if (!remote.ok) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    bytes = Buffer.from(await remote.arrayBuffer());
    const fromUrl = stored.split("?")[0]?.split("/").pop() || "";
    ext = extOf(fromUrl);
    const ctype = remote.headers.get("content-type") || "";
    const fromType = Object.entries(MIME).find(([, mime]) =>
      ctype.startsWith(mime),
    );
    if (fromType) ext = fromType[0] === "jpeg" ? "jpg" : fromType[0];
  } else {
    const safe = path.basename(stored);
    if (!safe || safe.includes("..")) {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }
    const abs = path.join(PHOTO_DIR, safe);
    if (!abs.startsWith(PHOTO_DIR) || !fs.existsSync(abs)) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    bytes = fs.readFileSync(abs);
    ext = extOf(safe);
  }

  const filename = safeFilename(photo.stock_no, slot, ext);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
