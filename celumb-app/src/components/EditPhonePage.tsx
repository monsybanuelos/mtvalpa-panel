"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePhone, type ActionResult } from "@/lib/actions";
import type { Phone } from "@/lib/db";
import { DrivePhotoSlot } from "@/components/DrivePhotoSlot";
import { GenerarEtiquetaButton } from "@/components/GenerarEtiquetaButton";
import { useToast } from "@/components/Toast";
import {
  beginDriveSignIn,
  claimPendingDriveUpload,
  driveFileName,
  drivePhotoMime,
  readDriveToken,
  uploadPhotoToDrive,
  type DriveSlot,
} from "@/lib/drive-browser";
import type { PhoneLabelInput } from "@/lib/phone-label";

const CONDITIONS = [
  "AA Nuevo",
  "A Bueno (9-10)",
  "B Regular (8)",
  "C Con marcas de uso (7)",
] as const;

const CHARGERS = ["Si", "No", "Se incluira en venta"] as const;

export function EditPhonePage({
  phone,
  googleClientId,
}: {
  phone: Phone;
  googleClientId: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [photo1, setPhoto1] = useState(phone.photo1_path || "");
  const [photo2, setPhoto2] = useState(phone.photo2_path || "");
  const photoRef = useRef({ photo1: phone.photo1_path || "", photo2: phone.photo2_path || "" });
  const [driveSlot, setDriveSlot] = useState<DriveSlot | null>(null);
  const [drivePct, setDrivePct] = useState<number | null>(null);
  const [uploadedSlot, setUploadedSlot] = useState<DriveSlot | null>(null);
  const lastHandled = useRef<ActionResult | null>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        return await updatePhone(formData);
      } catch (e) {
        const digest = String((e as { digest?: string })?.digest || "");
        if (digest.startsWith("NEXT_")) throw e;
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "No se pudo guardar.",
        };
      }
    },
    null as ActionResult | null,
  );
  const locked = pending || driveSlot != null;
  const formRef = useRef<HTMLFormElement>(null);
  photoRef.current = { photo1, photo2 };

  async function savePhotoLink(slot: DriveSlot, url: string) {
    const next1 = slot === 1 ? url : photoRef.current.photo1;
    const next2 = slot === 2 ? url : photoRef.current.photo2;
    photoRef.current = { photo1: next1, photo2: next2 };
    setPhoto1(next1);
    setPhoto2(next2);
    const fd = new FormData();
    const form = formRef.current;
    if (form) {
      for (const el of form.querySelectorAll("input, select, textarea")) {
        if (
          !(
            el instanceof HTMLInputElement ||
            el instanceof HTMLSelectElement ||
            el instanceof HTMLTextAreaElement
          )
        ) {
          continue;
        }
        if (!el.name || el.type === "file") continue;
        fd.append(el.name, el.value);
      }
    }
    fd.set("id", String(phone.id));
    fd.set("photo1_path", next1);
    fd.set("photo2_path", next2);
    const result = await updatePhone(fd);
    if (!result.ok) throw new Error(result.error || "No se pudo guardar el link.");
  }

  async function uploadDriveFile(slot: DriveSlot, file: File) {
    const clientId = googleClientId.trim();
    if (!clientId) {
      toast.error("La conexión con Drive no está configurada.");
      return;
    }
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
      toast.error("La foto es demasiado grande (máx. 25 MB).");
      return;
    }
    const mime = drivePhotoMime(file);
    const fileName = driveFileName(phone.stock_no, slot, mime);
    if (!readDriveToken()) {
      try {
        await beginDriveSignIn({
          clientId,
          stockNo: phone.stock_no,
          slot,
          file,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo abrir Google.");
      }
      return;
    }
    setUploadedSlot(null);
    setDriveSlot(slot);
    setDrivePct(0);
    try {
      const url = await uploadPhotoToDrive({
        token: readDriveToken() || "",
        file,
        fileName,
        mime,
        onProgress: setDrivePct,
      });
      await savePhotoLink(slot, url);
      setUploadedSlot(slot);
      toast.success("Foto subida con éxito");
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo subir la foto.";
      if (message === "AUTH") {
        try {
          await beginDriveSignIn({
            clientId,
            stockNo: phone.stock_no,
            slot,
            file,
          });
          return;
        } catch (signInError) {
          toast.error(
            signInError instanceof Error
              ? signInError.message
              : "La sesión de Google expiró.",
          );
        }
      } else {
        toast.error(message);
      }
    } finally {
      setDrivePct(null);
      setDriveSlot(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!googleClientId.trim() || !readDriveToken()) return;
    void claimPendingDriveUpload(phone.stock_no).then((pending) => {
      if (cancelled || !pending) return;
      const file = new File([pending.file], pending.fileName, { type: pending.mime });
      void uploadDriveFile(pending.slot, file);
    });
    return () => {
      cancelled = true;
    };
    // Resume once when this stock's edit page opens after Google redirects back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.stock_no]);

  function readLabel(): PhoneLabelInput {
    const fd = new FormData(formRef.current ?? undefined);
    const battery = String(fd.get("battery_pct") ?? "").trim();
    return {
      stock: String(fd.get("stock_no") || phone.stock_no).trim(),
      model: String(fd.get("model") || phone.model).trim(),
      brand: String(fd.get("brand") || phone.brand).trim(),
      price: String(fd.get("suggested_price") ?? phone.suggested_price),
      battery,
      storage: String(fd.get("storage") ?? ""),
      ram: String(fd.get("ram") ?? ""),
    };
  }

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  }, []);

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      toast.success(state.message || "Guardado.");
      router.push("/inventario");
      router.refresh();
    } else {
      toast.error(state.error || "No se pudo guardar.");
    }
  }, [state, toast, router]);

  return (
    <div className="edit-phone-page">
      <Link href="/inventario" className="btn btn-solid edit-phone-page__back">
        Regresar
      </Link>
      <p className="modal-eyebrow">Inventario · celular</p>
      <h1 className="section__title">Editar {phone.stock_no}</h1>
      <p className="section__lede">
        Información de este número de stock.
      </p>
      <form
        ref={formRef}
        className="panel edit-phone-page__form"
        action={formAction}
        noValidate
        onSubmit={() => {
          lastHandled.current = null;
        }}
      >
        <input type="hidden" name="id" value={phone.id} />
        <input type="hidden" name="photo1_path" value={photo1} />
        <input type="hidden" name="photo2_path" value={photo2} />
        <fieldset disabled={pending} className="flash-fieldset">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="edit_stock_no">No. Stock</label>
              <input
                id="edit_stock_no"
                name="stock_no"
                defaultValue={phone.stock_no}
                required
              />
              <p className="field-hint">
                Puedes corregirlo si no está duplicado
              </p>
            </div>
            <div className="field">
              <label htmlFor="edit_status">Estado</label>
              <select
                id="edit_status"
                name="status"
                defaultValue={phone.status}
              >
                <option value="disponible">Disponible</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit_brand">Marca</label>
              <input
                id="edit_brand"
                name="brand"
                defaultValue={phone.brand}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit_model">Modelo</label>
              <input
                id="edit_model"
                name="model"
                defaultValue={phone.model}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit_price">Precio</label>
              <input
                id="edit_price"
                name="suggested_price"
                type="number"
                min={0}
                step={1}
                defaultValue={Math.round(phone.suggested_price)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit_cost">Costo</label>
              <input
                id="edit_cost"
                name="cost"
                type="number"
                min={0}
                step={1}
                defaultValue={Math.round(phone.cost)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit_carrier">Compañía</label>
              <input
                id="edit_carrier"
                name="carrier"
                defaultValue={phone.carrier}
              />
            </div>
            <div className="field">
              <label htmlFor="edit_condition">Condición estética</label>
              <select
                id="edit_condition"
                name="condition_label"
                defaultValue={phone.condition_label}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit_ram">RAM</label>
              <input id="edit_ram" name="ram" defaultValue={phone.ram || ""} />
            </div>
            <div className="field">
              <label htmlFor="edit_storage">Almacenamiento</label>
              <input
                id="edit_storage"
                name="storage"
                defaultValue={phone.storage || ""}
              />
            </div>
            <div className="field">
              <label htmlFor="edit_bat">% batería</label>
              <input
                id="edit_bat"
                name="battery_pct"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={
                  phone.battery_pct != null ? phone.battery_pct : ""
                }
              />
            </div>
            <div className="field">
              <label htmlFor="edit_charger">Incluye cargador</label>
              <select
                id="edit_charger"
                name="includes_charger"
                defaultValue={phone.includes_charger}
              >
                {CHARGERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit_imei">IMEI</label>
              <input id="edit_imei" name="imei" defaultValue={phone.imei || ""} />
            </div>
            <div className="field field-span">
              <label htmlFor="edit_comments">Comentarios</label>
              <textarea
                id="edit_comments"
                name="comments"
                defaultValue={phone.comments || ""}
              />
            </div>
            <DrivePhotoSlot
              slot={1}
              label="Link de Foto 1"
              inputId="edit_photo1"
              value={photo1}
              onChange={setPhoto1}
              clientId={googleClientId}
              disabled={locked}
              progress={driveSlot === 1 ? drivePct : null}
              uploaded={uploadedSlot === 1}
              onFile={(file) => void uploadDriveFile(1, file)}
              onNeedConfig={() =>
                toast.error("La conexión con Drive no está configurada.")
              }
              onRejectFile={(message) => toast.error(message)}
            />
            <DrivePhotoSlot
              slot={2}
              label="Link de Foto 2"
              inputId="edit_photo2"
              value={photo2}
              onChange={setPhoto2}
              clientId={googleClientId}
              disabled={locked}
              progress={driveSlot === 2 ? drivePct : null}
              uploaded={uploadedSlot === 2}
              onFile={(file) => void uploadDriveFile(2, file)}
              onNeedConfig={() =>
                toast.error("La conexión con Drive no está configurada.")
              }
              onRejectFile={(message) => toast.error(message)}
            />
          </div>
          <div className="form-actions">
            <GenerarEtiquetaButton
              className="btn btn-ghost-light"
              phone={{
                stock: phone.stock_no,
                model: phone.model,
                brand: phone.brand,
                price: phone.suggested_price,
                battery: phone.battery_pct,
                storage: phone.storage,
                ram: phone.ram,
              }}
              readPhone={readLabel}
            />
            <button type="submit" className="btn btn-solid" disabled={locked}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <Link
              href="/inventario"
              className={`btn btn-ghost-light${locked ? " is-disabled" : ""}`}
              aria-disabled={locked}
              onClick={(e) => {
                if (locked) e.preventDefault();
              }}
            >
              Regresar
            </Link>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
