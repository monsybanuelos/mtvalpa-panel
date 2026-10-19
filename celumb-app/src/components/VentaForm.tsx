"use client";

import { useMemo, useState } from "react";
import { FlashForm } from "@/components/FlashForm";
import { registerSale } from "@/lib/actions";
import { formatMoney } from "@/lib/format";

type PhoneOpt = {
  id: number;
  stock_no: string;
  brand: string;
  model: string;
  suggested_price: number;
};

type Props = {
  phones: PhoneOpt[];
  today: string;
};

const PAY_FREQ = ["Semanal", "Quincenal", "Mensual"] as const;

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function VentaForm({ phones, today }: Props) {
  const [saleType, setSaleType] = useState<"Contado" | "Credito">("Contado");
  const [soldAt, setSoldAt] = useState(today);
  const [plazo, setPlazo] = useState("30");
  const [dueDate, setDueDate] = useState(() => addDaysISO(today, 30));

  const suggestedDue = useMemo(() => {
    const n = Number(plazo);
    if (!Number.isFinite(n) || n <= 0) return dueDate;
    return addDaysISO(soldAt || today, n);
  }, [plazo, soldAt, today, dueDate]);

  const isCredit = saleType === "Credito";

  return (
    <FlashForm
      action={registerSale}
      successMessage="Venta registrada correctamente."
      pendingLabel="Registrando venta…"
    >
      <div className="form-grid">
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="phone_id">No. de Stock</label>
          <select id="phone_id" name="phone_id" required defaultValue="">
            <option value="" disabled>
              Selecciona…
            </option>
            {phones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.stock_no} — {p.brand} {p.model} (sug.{" "}
                {formatMoney(p.suggested_price)})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sold_at">Fecha</label>
          <input
            id="sold_at"
            name="sold_at"
            type="date"
            value={soldAt}
            onChange={(e) => {
              setSoldAt(e.target.value);
              const n = Number(plazo);
              if (Number.isFinite(n) && n > 0) {
                setDueDate(addDaysISO(e.target.value || today, n));
              }
            }}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="amount">Monto venta</label>
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
          <label htmlFor="customer">Cliente</label>
          <input id="customer" name="customer" required placeholder="Cliente" />
        </div>

        <fieldset className="field field-span" style={{ gridColumn: "1 / -1" }}>
          <legend>Tipo de venta</legend>
          <div className="choice-row" role="radiogroup">
            {(["Contado", "Credito"] as const).map((opt) => (
              <label key={opt} className="choice">
                <input
                  type="radio"
                  name="sale_type"
                  value={opt}
                  checked={saleType === opt}
                  onChange={() => setSaleType(opt)}
                />
                <span>{opt === "Credito" ? "Crédito" : opt}</span>
              </label>
            ))}
          </div>
          <p className="field-hint">
            Contado = pago al momento. Crédito = genera cuenta por cobrar.
          </p>
        </fieldset>
      </div>

      {/* Bloque crédito FUERA del flex form-actions; siempre en flujo normal */}
      <div
        id="venta-credito-fields"
        className="venta-credito-fields"
        hidden={!isCredit}
        aria-hidden={!isCredit}
      >
        <p className="credit-block-label">Datos del crédito</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="debtor_phone">Número teléfono</label>
            <input
              id="debtor_phone"
              name="debtor_phone"
              type="tel"
              inputMode="tel"
              placeholder="457…"
              required={isCredit}
            />
          </div>
          <div className="field">
            <label htmlFor="plazo_dias">Plazo en días</label>
            <input
              id="plazo_dias"
              name="plazo_dias"
              type="number"
              min={1}
              step={1}
              value={plazo}
              onChange={(e) => {
                setPlazo(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) {
                  setDueDate(addDaysISO(soldAt || today, n));
                }
              }}
              required={isCredit}
            />
          </div>
          <fieldset className="field field-span" style={{ gridColumn: "1 / -1" }}>
            <legend>Tipo de pago</legend>
            <div className="choice-row" role="radiogroup">
              {PAY_FREQ.map((opt, i) => (
                <label key={opt} className="choice">
                  <input
                    type="radio"
                    name="payment_freq"
                    value={opt}
                    defaultChecked={i === 0}
                    required={isCredit}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="due_date">Fecha límite de pago</label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              value={dueDate || suggestedDue}
              onChange={(e) => setDueDate(e.target.value)}
              required={isCredit}
            />
          </div>
          <div className="field field-span" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="credit_comments">Comentarios</label>
            <textarea
              id="credit_comments"
              name="comments"
              placeholder="Notas del crédito / cobranza"
            />
          </div>
        </div>
        <input type="hidden" name="liquidado" value="No" />
        <input type="hidden" name="pago2_status" value="No" />
        <input type="hidden" name="pago3_status" value="No" />
      </div>

      {!isCredit && (
        <div className="form-grid" style={{ marginTop: "0.75rem" }}>
          <div className="field">
            <label htmlFor="extra_costs">Costos extraordinarios</label>
            <input
              id="extra_costs"
              name="extra_costs"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
            />
          </div>
          <div className="field field-span" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="comments">Comentarios</label>
            <textarea id="comments" name="comments" />
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-solid">
          Guardar venta
        </button>
      </div>
    </FlashForm>
  );
}
