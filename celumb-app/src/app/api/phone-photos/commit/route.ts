import { NextResponse } from "next/server";
import { commitDirectPhonePhoto } from "@/lib/phone-photo-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only. Saves the object path after the browser stored the file. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slot = Number(url.searchParams.get("slot"));
  const objectName = url.searchParams.get("object") || "";
  const rawId = url.searchParams.get("phoneId");
  const phoneId = rawId ? Number(rawId) : undefined;
  const result = await commitDirectPhonePhoto({
    slot,
    objectName,
    phoneId:
      phoneId != null && Number.isInteger(phoneId) && phoneId > 0
        ? phoneId
        : undefined,
  });
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "private, no-store" },
  });
}
