"use server";

import { ingestPhonePhoto } from "@/lib/phone-photo-upload";

/** Same photo save as the upload route, posted with the page instead of /api. */
export async function uploadPhonePhotoAction(formData: FormData): Promise<
  { ok: true; path: string; message: string } | { ok: false; error: string }
> {
  const result = await ingestPhonePhoto(formData);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, path: result.path, message: result.message };
}
