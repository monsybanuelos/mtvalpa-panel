"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordCollection, type ActionResult } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { formatMoney } from "@/lib/format";

type OpenAccount = {
  id: number;
  debtor_name: string;
  stock_no: string;
  balance: number;
  liquidado: string;
};

type Props = {
  accounts: OpenAccount[];
  today: string;
};

export function CobranzaForm({ accounts, today }: Props) {
  const toast = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<ActionResult | null>(null);

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        return await recordCollection(formData);
      } catch (e) {
        const digest = String((e as { digest?: string })?.digest || "");
        if (digest.startsWith("NEXT_")) throw e;
        const msg =
          e instanceof Error
            ? e.message
            : "No se pudo registrar el pago. Intenta de nuevo.";
        return { ok: false as const, error: msg };
      }
    },
    null as ActionResult | null,
  );

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      const msg =
        state.message ||
        "Cobranza registrada correctamente.";
      toast.success(msg);
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(state.error || "No se pudo registrar el pago.");
    }
  }, [state, toast, router]);

  if (accounts.length === 0) {
    return <p className="muted">No hay créditos pendientes.</p>;
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      data-pending={pending ? "true" : "false"}
      onSubmit={(e) => {
        lastHandled.current = null;
        const fd = new FormData(e.currentTarget);
        const creditId = String(fd.get("credit_id") ?? "").trim();
        const amountRaw = String(fd.get("amount") ?? "").trim();
        if (!creditId) {
          e.preventDefault();
          toast.error("Selecciona una cuenta / acreedor.");
          return;
        }
        if (!amountRaw || Number(amountRaw) <= 0) {
          e.preventDefault();
          toast.error("La cantidad / pagado es obligatoria.");
          return;
        }
      }}
    >
      <fieldset disabled={pending} className="flash-fieldset">
        <div className="form-grid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="credit_id">Cuenta / nombre</label>
            <select id="credit_id" name="credit_id" required defaultValue="">
              <option value="" disabled>
                Selecciona…
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.debtor_name} — {a.stock_no} (faltan{" "}
                  {formatMoney(a.balance)})
                  {a.liquidado === "Retrasado" ? " · Retrasado" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Cantidad / pagado</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={1}
              step={1}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="paid_at">Fecha</label>
            <input
              id="paid_at"
              name="paid_at"
              type="date"
              defaultValue={today}
            />
          </div>
          <div className="field">
            <label htmlFor="set_liquidado">Liquidado (opcional)</label>
            <select id="set_liquidado" name="set_liquidado" defaultValue="">
              <option value="">Automático</option>
              <option>Si</option>
              <option>No</option>
              <option>Retrasado</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="note">Comentarios</label>
            <textarea id="note" name="note" />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-solid" disabled={pending}>
            {pending ? "Registrando pago…" : "Registrar pago"}
          </button>
        </div>
      </fieldset>
      <div className="form-status" aria-live="polite">
        {pending && <span className="muted">Registrando pago…</span>}
        {!pending && state?.ok && (
          <span className="ok">
            {state.message || "Cobranza registrada correctamente."}
          </span>
        )}
        {!pending && state && !state.ok && (
          <span className="err">{state.error}</span>
        )}
      </div>
    </form>
  );
}
