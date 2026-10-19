"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateAccessory, type ActionResult } from "@/lib/actions";
import type { Accessory } from "@/lib/db";
import { useToast } from "@/components/Toast";

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
