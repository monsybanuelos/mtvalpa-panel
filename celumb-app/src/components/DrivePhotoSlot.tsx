"use client";

import { useRef, useState } from "react";
import { isAllowedDrivePhoto } from "@/lib/drive-browser";

type Props = {
  slot: 1 | 2;
  label: string;
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  clientId: string;
  disabled?: boolean;
  progress: number | null;
  uploaded: boolean;
  onFile: (file: File) => void;
  onNeedConfig: () => void;
  onRejectFile: (message: string) => void;
};

export function DrivePhotoSlot({
  slot,
  label,
  inputId,
  value,
  onChange,
  clientId,
  disabled,
  progress,
  uploaded,
  onFile,
  onNeedConfig,
  onRejectFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const uploading = progress != null;
  const slotName = `Foto ${slot}`;

  function openPicker() {
    if (!clientId.trim()) {
      onNeedConfig();
      return;
    }
    inputRef.current?.click();
  }

  function handleFile(file: File | null) {
    if (!file) return;
    if (!isAllowedDrivePhoto(file)) {
      onRejectFile("Elige una foto JPEG, PNG o HEIC.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (value.trim()) {
      setPendingFile(file);
      return;
    }
    onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="field field-span">
      <label htmlFor={inputId}>{label}</label>
      <div className="photo-link-row">
        <input
          id={inputId}
          type="text"
          inputMode="url"
          placeholder="https://drive.google.com/…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          disabled={disabled || uploading}
        />
        <button
          type="button"
          className="btn btn-solid photo-upload__btn"
          disabled={disabled || uploading || pendingFile != null}
          onClick={openPicker}
        >
          {uploading ? `Subiendo… ${progress}%` : "Subir a Drive"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
          className="photo-upload__input"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {!clientId.trim() && (
        <p className="field-hint">La conexión con Drive no está configurada.</p>
      )}
      {progress != null && (
        <div
          className="photo-upload__bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="photo-upload__bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
      {pendingFile && (
        <div className="photo-replace-warn" role="alert">
          <p>
            Ya hay un link de {slotName}. Si continúas, la nueva foto reemplaza
            ese link.
          </p>
          <div className="photo-replace-warn__actions">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => {
                const file = pendingFile;
                setPendingFile(null);
                if (inputRef.current) inputRef.current.value = "";
                onFile(file);
              }}
            >
              Reemplazar
            </button>
            <button
              type="button"
              className="btn btn-ghost-light"
              onClick={() => {
                setPendingFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {uploaded && !uploading && !pendingFile && (
        <p className="field-hint ok">Foto subida con éxito</p>
      )}
    </div>
  );
}
