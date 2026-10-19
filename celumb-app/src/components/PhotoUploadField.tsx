"use client";

import { useId, useRef, useState } from "react";

type Props = {
  slot: 1 | 2;
  label: string;
  value: string;
  onChange: (path: string) => void;
  onSuccessMessage: (msg: string) => void;
  onErrorMessage: (msg: string) => void;
};

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const TARGET_MAX_BYTES = 1.2 * 1024 * 1024;

async function compressImage(file: File): Promise<Blob> {
  // HEIC/HEIF: muchos navegadores no dibujan en canvas — subir original si falla
  const tryCanvas = !/heic|heif/i.test(file.type) && !/\.heic$/i.test(file.name);

  if (!tryCanvas) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error("Foto HEIC demasiado grande. Elige otra o convierte a JPEG.");
    }
    return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error("No se pudo procesar la foto. Prueba otra imagen.");
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

function uploadWithProgress(
  blob: Blob,
  filename: string,
  slot: number,
  onProgress: (pct: number) => void,
): Promise<{ path: string; message?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/phone-photos/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => {
      const data = xhr.response as {
        ok?: boolean;
        path?: string;
        error?: string;
        message?: string;
      } | null;
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data.path) {
        onProgress(100);
        resolve({ path: data.path, message: data.message });
      } else {
        reject(new Error(data?.error || `Error al subir (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al subir la foto."));
    const fd = new FormData();
    fd.append("file", blob, filename);
    fd.append("slot", String(slot));
    xhr.send(fd);
  });
}

export function PhotoUploadField({
  slot,
  label,
  value,
  onChange,
  onSuccessMessage,
  onErrorMessage,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const uploading = progress != null && progress < 100;

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) {
      onErrorMessage("Elige una imagen (foto del iPhone).");
      return;
    }
    setProgress(0);
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
      );
      onChange(path);
      onSuccessMessage(message || "Foto subida con éxito");
    } catch (e) {
      setProgress(null);
      onChange("");
      onErrorMessage(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      // leave progress at 100 briefly then clear bar
      setTimeout(() => setProgress(null), 1200);
    }
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
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? `Subiendo… ${progress}%` : label}
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
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
      {value && progress == null && (
        <p className="field-hint ok">Foto subida con éxito</p>
      )}
    </div>
  );
}
