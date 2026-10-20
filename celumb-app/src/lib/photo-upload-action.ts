"use server";

import {
  commitDirectPhonePhoto,
  prepareDirectPhonePhoto,
  type CommitPhotoResult,
  type PreparePhotoResult,
} from "@/lib/phone-photo-direct";
import { ingestPhonePhoto } from "@/lib/phone-photo-upload";

/** Same photo save as the upload route. Local installs still send the file here. */
export async function uploadPhonePhotoAction(formData: FormData): Promise<
  { ok: true; path: string; message: string } | { ok: false; error: string }
> {
  const result = await ingestPhonePhoto(formData);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, path: result.path, message: result.message };
}

/** Small request: a signed URL for one object. The photo bytes do not ride along. */
export async function preparePhonePhotoUpload(input: {
  slot: number;
  ext: string;
}): Promise<PreparePhotoResult> {
  return prepareDirectPhonePhoto({
    slot: Number(input?.slot),
    ext: String(input?.ext ?? ""),
  });
}

/** Small request: store the object path after the browser uploaded the file. */
export async function commitPhonePhotoPath(input: {
  slot: number;
  objectName: string;
  phoneId?: number;
}): Promise<CommitPhotoResult> {
  const rawId = input?.phoneId;
  const phoneId = rawId == null ? undefined : Number(rawId);
  return commitDirectPhonePhoto({
    slot: Number(input?.slot),
    objectName: String(input?.objectName ?? ""),
    phoneId:
      phoneId != null && Number.isInteger(phoneId) && phoneId > 0
        ? phoneId
        : undefined,
  });
}
