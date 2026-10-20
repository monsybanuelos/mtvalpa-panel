import { NextResponse } from "next/server";
import { prepareDirectPhonePhoto } from "@/lib/phone-photo-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only. Returns a signed Storage URL. The photo is not in this request. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slot = Number(url.searchParams.get("slot"));
  const ext = url.searchParams.get("ext") || "";
  const result = await prepareDirectPhonePhoto({ slot, ext });
  const status = result.ok ? 200 : result.fallback ? 200 : 400;
  return NextResponse.json(result, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
