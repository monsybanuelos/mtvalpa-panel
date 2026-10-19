"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateAccessory,
  updatePhone,
  type ActionResult,
} from "@/lib/actions";
import type { Accessory, Phone } from "@/lib/db";
import { PhotoUploadField } from "@/components/PhotoUploadField";
import { useToast } from "@/components/Toast";

const CONDITIONS = [
  "AA Nuevo",
  "A Bueno (9-10)",
  "B Regular (8)",
  "C Con marcas de uso (7)",
] as const;

const CHARGERS = ["Si", "No", "Se incluira en venta"] as const;

function useSaveAction(
  action: (fd: FormData) => Promise<ActionResult>,
  onDone: () => void,
) {
  const toast = useToast();
  const router = useRouter();
  const lastHandled = useRef<ActionResult | null>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        return await action(formData);
      } catch (e) {
        const digest = String((e as { digest?: string })?.digest || "");
        if (digest.startsWith("NEXT_")) throw e;
        return {
          ok: false as const,
          error:
            e instanceof Error ? e.message : "No se pudo guardar.",
        };
      }
    },
    null as ActionResult | null,
  );

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      toast.success(state.message || "Guardado.");
      router.refresh();
      onDone();
    } else {
      toast.error(state.error || "No se pudo guardar.");
    }
  }, [state, toast, router, onDone]);

  return { state, formAction, pending, resetMarker: () => { lastHandled.current = null; } };
}

type PhoneEditProps = {
  phone: Phone;
  open: boolean;
  onClose: () => void;
};

export function EditPhoneModal({ phone, open, onClose }: PhoneEditProps) {
  const toast = useToast();
  const router = useRouter();
  const [photo1, setPhoto1] = useState(phone.photo1_path || "");
  const [photo2, setPhoto2] = useState(phone.photo2_path || "");
  const [photoBusy, setPhotoBusy] = useState(0);
  const { formAction, pending, resetMarker } = useSaveAction(
    updatePhone,
    onClose,
  );
  const locked = pending || photoBusy > 0;

  function onPhotoBusy(busy: boolean) {
    setPhotoBusy((n) => Math.max(0, n + (busy ? 1 : -1)));
  }

  if (!open) return null;

  return (
    <div
      className="modal-backdrop is-open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-phone-title"
      >
        <div className="modal-panel__head">
          <div>
            <p className="modal-eyebrow">Inventario · celular</p>
            <h2 id="edit-phone-title" className="modal-panel__title">
              Editar {phone.stock_no}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={locked}
          >
            ×
          </button>
        </div>
        <form
          action={formAction}
          noValidate
          onSubmit={() => resetMarker()}
        >
          <input type="hidden" name="id" value={phone.id} />
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
                <input
                  id="edit_imei"
                  name="imei"
                  defaultValue={phone.imei || ""}
                />
              </div>
              <div className="field field-span">
                <label htmlFor="edit_comments">Comentarios</label>
                <textarea
                  id="edit_comments"
                  name="comments"
                  defaultValue={phone.comments || ""}
                />
              </div>
              <div className="field-span photo-upload-grid">
                <PhotoUploadField
                  slot={1}
                  label="Subir Foto 1"
                  value={photo1}
                  phoneId={phone.id}
                  onBusyChange={onPhotoBusy}
                  onChange={(path) => {
                    setPhoto1(path);
                    router.refresh();
                  }}
                  onSuccessMessage={(m) => toast.success(m)}
                  onErrorMessage={(m) => toast.error(m)}
                />
                <PhotoUploadField
                  slot={2}
                  label="Subir Foto 2"
                  value={photo2}
                  phoneId={phone.id}
                  onBusyChange={onPhotoBusy}
                  onChange={(path) => {
                    setPhoto2(path);
                    router.refresh();
                  }}
                  onSuccessMessage={(m) => toast.success(m)}
                  onErrorMessage={(m) => toast.error(m)}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-solid" disabled={locked}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                className="btn btn-ghost-light"
                onClick={onClose}
                disabled={locked}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

type AccEditProps = {
  accessory: Accessory;
  open: boolean;
  onClose: () => void;
};

export function EditAccessoryModal({
  accessory,
  open,
  onClose,
}: AccEditProps) {
  const { formAction, pending, resetMarker } = useSaveAction(
    updateAccessory,
    onClose,
  );
  const code = accessory.stock_no || accessory.codigo;

  if (!open) return null;

  return (
    <div
      className="modal-backdrop is-open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-acc-title"
      >
        <div className="modal-panel__head">
          <div>
            <p className="modal-eyebrow">Inventario · accesorio</p>
            <h2 id="edit-acc-title" className="modal-panel__title">
              Editar {code}
            </h2>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              El código ACC### no se renumera
              {accessory.catalog_code
                ? ` · catálogo ${accessory.catalog_code}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={pending}
          >
            ×
          </button>
        </div>
        <form
          action={formAction}
          noValidate
          onSubmit={() => resetMarker()}
        >
          <input type="hidden" name="id" value={accessory.id} />
          <fieldset disabled={pending} className="flash-fieldset">
            <div className="form-grid">
              <div className="field field-span">
                <label htmlFor="edit_acc_desc">Descripción</label>
                <input
                  id="edit_acc_desc"
                  name="descripcion"
                  defaultValue={accessory.descripcion}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="edit_acc_qty">Stock</label>
                <input
                  id="edit_acc_qty"
                  name="qty"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={accessory.qty}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="edit_acc_cost">Costo u.</label>
                <input
                  id="edit_acc_cost"
                  name="cost_unit"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={
                    accessory.cost_unit != null
                      ? Math.round(accessory.cost_unit)
                      : ""
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="edit_acc_sug">$ Sugerido</label>
                <input
                  id="edit_acc_sug"
                  name="precio_sugerido"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={
                    accessory.precio_sugerido != null
                      ? Math.round(accessory.precio_sugerido)
                      : ""
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="edit_acc_max">$ Máximo</label>
                <input
                  id="edit_acc_max"
                  name="precio_maximo"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={
                    accessory.precio_maximo != null
                      ? Math.round(accessory.precio_maximo)
                      : ""
                  }
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-solid" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                className="btn btn-ghost-light"
                onClick={onClose}
                disabled={pending}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
