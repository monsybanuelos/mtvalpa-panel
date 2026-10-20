import { NextResponse } from "next/server";
import { ingestPhonePhoto } from "@/lib/phone-photo-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const result = await ingestPhonePhoto(form);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      path: result.path,
      url: result.url,
      message: result.message,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al subir";
    const status =
      msg.includes("sesión") || msg.includes("iniciar") ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
