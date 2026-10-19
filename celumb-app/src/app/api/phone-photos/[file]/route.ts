import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";

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

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { file } = await ctx.params;
  const safe = path.basename(file || "");
  if (!safe || safe !== file || safe.includes("..")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const abs = path.join(PHOTO_DIR, safe);
  if (!abs.startsWith(PHOTO_DIR) || !fs.existsSync(abs)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const ext = safe.split(".").pop()?.toLowerCase() || "jpg";
  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
