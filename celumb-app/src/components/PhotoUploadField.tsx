"use client";

import { useId, useRef, useState } from "react";
import { uploadPhonePhotoAction } from "@/lib/photo-upload-action";

type Props = {
  slot: 1 | 2;
  label: string;
  value: string;
  /** When set, a successful upload replaces this phone's slot and drops the previous file. */
  phoneId?: number | string;
  /** Ask before replacing a photo that is already in this slot. */
  confirmReplace?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onChange: (path: string) => void;
  onSuccessMessage: (msg: string) => void;
  onErrorMessage: (msg: string) => void;
};

function isAllowedPhoto(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "image/heic" ||
    type === "image/heif"
  ) {
    return true;
  }
  return /\.(jpe?g|png|heic|heif)$/i.test(file.name);
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const TARGET_MAX_BYTES = 1.2 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

async function compressImage(file: File): Promise<Blob> {
  // iPhone photos are often HEIC. Draw them when the browser can, so the
  // upload is a JPEG the bucket already accepts. If it cannot, send the file.
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("La foto es demasiado grande (máx. 8 MB). Prueba otra o comprímela.");
    }
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = JPEG_QUALITY;
  let blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.45) {
    quality -= 0.08;
    blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
  }
  if (!blob) return file;
  return blob;
}

async function uploadWithProgress(
  blob: Blob,
  filename: string,
  slot: number,
  onProgress: (pct: number) => void,
  phoneId?: number | string,
): Promise<{ path: string; message?: string }> {
  // Posted with the page. The /api upload route is answered 429 by the CDN
  // before the app can store the file.
  onProgress(20);
  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("slot", String(slot));
  const id = Number(phoneId);
  if (Number.isInteger(id) && id > 0) fd.append("phoneId", String(id));
  const data = await uploadPhonePhotoAction(fd);
  if (!data.ok) throw new Error(data.error || "No se pudo subir la foto.");
  onProgress(100);
  return { path: data.path, message: data.message };
}

export function PhotoUploadField({
  slot,
  label,
  value,
  phoneId,
  confirmReplace,
  onBusyChange,
  onChange,
  onSuccessMessage,
  onErrorMessage,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<File | null>(null);
  const uploading = progress != null && progress < 100;
  const slotName = label.replace(/^Subir\s+/i, "") || `Foto ${slot}`;

  async function startUpload(file: File) {
    setPendingReplace(null);
    setProgress(0);
    onBusyChange?.(true);
    try {
      const compressed = await compressImage(file);
      setProgress(8);
      const localUrl = URL.createObjectURL(compressed);
      setPreview(localUrl);
      const baseName = file.name.replace(/\.[^.]+$/, "") || `foto${slot}`;
      const outName = `${baseName}.jpg`;
      const { path, message } = await uploadWithProgress(
        compressed,
        outName,
        slot,
        setProgress,
        phoneId,
      );
      onChange(path);
      setUploaded(true);
      onSuccessMessage(message || "Foto subida con éxito");
    } catch (e) {
      setPreview(null);
      setProgress(null);
      onErrorMessage(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setProgress(null), 1200);
    }
  }

  function handleFile(file: File | null) {
    if (!file) return;
    if (!isAllowedPhoto(file)) {
      onErrorMessage("Elige una foto JPEG, PNG o HEIC.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (confirmReplace && value.trim()) {
      setPendingReplace(file);
      return;
    }
    void startUpload(file);
  }

  function cancelReplace() {
    setPendingReplace(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const thumbUrl = value
    ? /^https?:\/\//i.test(value)
      ? value
      : `/api/phone-photos/${value.split("/").pop()}`
    : preview;

  return (
    <div className="field photo-upload">
      <label htmlFor={inputId}>{label}</label>
      <div className="photo-upload__row">
        <button
          type="button"
          className="btn btn-solid photo-upload__btn"
          disabled={uploading || pendingReplace != null}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? `Subiendo… ${progress}%` : label}
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
          className="photo-upload__input"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        {thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={`Vista previa foto ${slot}`}
            className="photo-upload__thumb"
          />
        )}
      </div>
      {progress != null && (
        <div
          className="photo-upload__bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="photo-upload__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {pendingReplace && (
        <div className="photo-replace-warn" role="alert">
          <p>
            Ya hay una {slotName}. Si continúas, la nueva imagen reemplaza la
            anterior y se borra el archivo viejo.
          </p>
          <div className="photo-replace-warn__actions">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => void startUpload(pendingReplace)}
            >
              Reemplazar
            </button>
            <button
              type="button"
              className="btn btn-ghost-light"
              onClick={cancelReplace}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {uploaded && value && progress == null && !pendingReplace && (
        <p className="field-hint ok">Foto subida con éxito</p>
      )}
    </div>
  );
}
