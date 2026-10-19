"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCollection,
  updateCollection,
  type ActionResult,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { formatDate, formatMoney } from "@/lib/format";

type CollectionRow = {
  id: number;
  amount: number;
  paid_at: string;
  debtor_name: string;
  stock_no: string;
};

type Props = {
  collections: CollectionRow[];
};

export function UltimasCobranzas({ collections }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  if (collections.length === 0) {
    return <p className="muted">Sin movimientos aún.</p>;
  }

  return (
    <ul className="list-plain list-cobranzas">
      {collections.map((c) => (
        <li key={c.id} className="cobranza-row">
          {editingId === c.id ? (
            <CobranzaEditRow
              collection={c}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <span>
                {formatDate(c.paid_at)} · {c.debtor_name} · {c.stock_no}
              </span>
              <span className="cobranza-row__right">
                <span className="money-pos">{formatMoney(c.amount)}</span>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => setEditingId(c.id)}
                >
                  Editar
                </button>
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function CobranzaEditRow({
  collection,
  onDone,
  onCancel,
}: {
  collection: CollectionRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const lastHandled = useRef<ActionResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        return await updateCollection(formData);
      } catch (e) {
        const digest = String((e as { digest?: string })?.digest || "");
        if (digest.startsWith("NEXT_")) throw e;
        return {
          ok: false as const,
          error:
            e instanceof Error
              ? e.message
              : "No se pudo actualizar la cobranza.",
        };
      }
    },
    null as ActionResult | null,
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        return await deleteCollection(formData);
      } catch (e) {
        const digest = String((e as { digest?: string })?.digest || "");
        if (digest.startsWith("NEXT_")) throw e;
        return {
          ok: false as const,
          error:
            e instanceof Error ? e.message : "No se pudo borrar la cobranza.",
        };
      }
    },
    null as ActionResult | null,
  );

  useEffect(() => {
    const state = updateState || deleteState;
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      toast.success(state.message || "Listo.");
      router.refresh();
      onDone();
    } else {
      toast.error(state.error || "No se pudo guardar.");
    }
  }, [updateState, deleteState, toast, router, onDone]);

  const pending = updatePending || deletePending;

  return (
    <div className="cobranza-edit">
      <span className="cobranza-edit__meta muted">
        {formatDate(collection.paid_at)} · {collection.debtor_name} ·{" "}
        {collection.stock_no}
      </span>
      <form
        action={updateAction}
        className="cobranza-edit__form"
        onSubmit={() => {
          lastHandled.current = null;
        }}
      >
        <input type="hidden" name="id" value={collection.id} />
        <label className="sr-only" htmlFor={`edit-amt-${collection.id}`}>
          Cantidad
        </label>
        <input
          id={`edit-amt-${collection.id}`}
          name="amount"
          type="number"
          min={1}
          step={1}
          defaultValue={Math.round(collection.amount)}
          required
          disabled={pending}
          className="cobranza-edit__amount"
        />
        <button
          type="submit"
          className="btn btn-solid btn-compact"
          disabled={pending}
        >
          {updatePending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost-light btn-compact"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </form>
      {confirmDelete ? (
        <form
          action={deleteAction}
          className="cobranza-edit__delete"
          onSubmit={() => {
            lastHandled.current = null;
          }}
        >
          <input type="hidden" name="id" value={collection.id} />
          <span className="muted">¿Borrar esta cobranza?</span>
          <button
            type="submit"
            className="btn btn-danger btn-compact"
            disabled={pending}
          >
            {deletePending ? "Borrando…" : "Confirmar borrar"}
          </button>
          <button
            type="button"
            className="btn btn-ghost-light btn-compact"
            disabled={pending}
            onClick={() => setConfirmDelete(false)}
          >
            No
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-link btn-link-danger"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
        >
          Borrar
        </button>
      )}
    </div>
  );
}
