import { registerSupplierCredit } from "@/lib/actions";
import { requireAdminPage } from "@/lib/auth";
import { FlashForm } from "@/components/FlashForm";
import { CobranzaForm } from "@/components/CobranzaForm";
import { SupplierPaidToggle } from "@/components/SupplierPaidToggle";
import { UltimasCobranzas } from "@/components/UltimasCobranzas";
import {
  listAccessories,
  listCollections,
  listCreditAccounts,
  listPhones,
  listSupplierCredits,
} from "@/lib/queries";
import { formatDate, formatMoney, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

function liquidadoBadge(v: string) {
  if (v === "Si") return "badge badge-ok";
  if (v === "Retrasado") return "badge badge-warn";
  return "badge badge-sold";
}

function statusBadge(v: string) {
  if (v === "Si") return "badge badge-ok";
  if (v === "Retrasado") return "badge badge-warn";
  return "badge badge-sold";
}

export default async function CreditoPage() {
  await requireAdminPage();
  const accounts = await listCreditAccounts();
  const open = accounts.filter((a) => a.liquidado !== "Si");
  const delayed = accounts.filter((a) => a.liquidado === "Retrasado");
  const collections = await listCollections();
  const suppliers = await listSupplierCredits();
  const phones = await listPhones("all");
  const accessories = await listAccessories();
  const phoneStocks = phones.filter((p) => /^MBC\d+$/i.test(p.stock_no));
  const accStocks = accessories.filter((a) =>
    /^ACC\d+$/i.test((a.stock_no || a.codigo || "").trim()),
  );
  const unpaidSuppliers = suppliers.filter((s) => s.paid === "No");
  const today = todayISO();

  return (
    <>
      <section className="section" style={{ marginTop: 0 }}>
        <div className="section__head">
          <div>
            <h1 className="section__title">Crédito y cobranza</h1>
            <p className="section__lede">
              Cartera de clientes (Liquidado Si/No/Retrasado, Pago 1 monto,
              Pago 2/3 estado) y crédito de adquisición a acreedores.
            </p>
          </div>
        </div>

        <div className="stat-row" style={{ marginBottom: "1.2rem" }}>
          <div className="stat">
            <span className="stat__label">Créditos abiertos</span>
            <span className="stat__value">{open.length}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Retrasados</span>
            <span className="stat__value">{delayed.length}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Falta liquidar</span>
            <span className="stat__value">
              {formatMoney(open.reduce((s, a) => s + a.balance, 0))}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Deudas a acreedores</span>
            <span className="stat__value">
              {formatMoney(
                unpaidSuppliers.reduce((s, a) => s + a.amount, 0),
              )}
            </span>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <h2 className="panel__title">Registrar cobranza (cliente)</h2>
            <CobranzaForm
              accounts={open.map((a) => ({
                id: a.id,
                debtor_name: a.debtor_name,
                stock_no: a.stock_no || "",
                balance: a.balance,
                liquidado: a.liquidado,
              }))}
              today={today}
            />
          </div>

          <div className="panel">
            <h2 className="panel__title">Últimas cobranzas</h2>
            <UltimasCobranzas
              collections={collections.slice(0, 8).map((c) => ({
                id: c.id,
                amount: c.amount,
                paid_at: c.paid_at,
                debtor_name: c.debtor_name || "",
                stock_no: c.stock_no || "",
              }))}
            />
          </div>
        </div>
      </section>

      <section className="section" id="creditos-activos">
        <div className="panel">
          <h2 className="panel__title">
            Créditos activos · cuentas de clientes
          </h2>
          <p className="muted" style={{ marginTop: "-0.35rem" }}>
            Solo ventas de celulares con saldo pendiente (no accesorios).
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Número</th>
                  <th>No. Stock</th>
                  <th>Equipo</th>
                  <th>Tipo / plazo</th>
                  <th>Principal</th>
                  <th>Pago 1</th>
                  <th>Pago 2</th>
                  <th>Pago 3</th>
                  <th>Pagado</th>
                  <th>Falta liquidar</th>
                  <th>Fecha límite</th>
                  <th>Liquidado</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Nombre">
                      <strong>{a.debtor_name}</strong>
                    </td>
                    <td data-label="Número">{a.debtor_phone || "—"}</td>
                    <td data-label="No. Stock">{a.stock_no}</td>
                    <td data-label="Equipo">
                      {a.brand} {a.model}
                    </td>
                    <td data-label="Tipo / plazo">
                      <span className="badge badge-credit">
                        {a.payment_freq || a.credit_type}
                      </span>
                      {a.plazo_dias != null ? (
                        <span className="muted"> · {a.plazo_dias}d</span>
                      ) : null}
                    </td>
                    <td data-label="Principal">{formatMoney(a.principal)}</td>
                    <td data-label="Pago 1">
                      {a.pago1 != null ? formatMoney(a.pago1) : "—"}
                    </td>
                    <td data-label="Pago 2">
                      <span className={statusBadge(a.pago2_status || "No")}>
                        {a.pago2_status || "No"}
                      </span>
                    </td>
                    <td data-label="Pago 3">
                      <span className={statusBadge(a.pago3_status || "No")}>
                        {a.pago3_status || "No"}
                      </span>
                    </td>
                    <td data-label="Pagado">{formatMoney(a.paid_total)}</td>
                    <td
                      data-label="Falta liquidar"
                      className={a.balance > 0 ? "money-neg" : "money-pos"}
                    >
                      {formatMoney(a.balance)}
                    </td>
                    <td data-label="Fecha límite">{formatDate(a.due_date)}</td>
                    <td data-label="Liquidado">
                      <span className={liquidadoBadge(a.liquidado)}>
                        {a.liquidado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2 className="section__title">Crédito de adquisición</h2>
            <p className="section__lede">
              Deudas con acreedores al comprar mercancía (Form: Credito para
              adquisición).
            </p>
          </div>
        </div>
        <div className="grid-2">
          <div className="panel">
            <h3 className="panel__title">Registrar crédito de adquisición</h3>
            <FlashForm
              action={registerSupplierCredit}
              successMessage="Crédito de adquisición guardado."
            >
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="at">Fecha</label>
                  <input
                    id="at"
                    name="at"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="sup_amount">Cantidad</label>
                  <input
                    id="sup_amount"
                    name="amount"
                    type="number"
                    min={1}
                    step={1}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="creditor">Acreedor</label>
                  <input id="creditor" name="creditor" required />
                </div>
                <div className="field field-span">
                  <label htmlFor="sup_stock_no">No. Stock</label>
                  <select
                    id="sup_stock_no"
                    name="stock_no"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecciona un No. Stock…
                    </option>
                    {phoneStocks.length > 0 && (
                      <optgroup label="Celulares">
                        {phoneStocks.map((p) => (
                          <option key={`p-${p.id}`} value={p.stock_no}>
                            {p.stock_no} — {p.brand} {p.model}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {accStocks.length > 0 && (
                      <optgroup label="Accesorios">
                        {accStocks.map((a) => {
                          const code = (a.stock_no || a.codigo).toUpperCase();
                          return (
                            <option key={`a-${a.id}`} value={code}>
                              {code} — {a.descripcion}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                  <p className="field-hint">
                    Obligatorio. Celular (MBC) o accesorio (ACC) del inventario.
                  </p>
                </div>
                <fieldset className="field">
                  <legend>Pagado</legend>
                  <div className="choice-row">
                    {["No", "Si"].map((opt) => (
                      <label key={opt} className="choice">
                        <input
                          type="radio"
                          name="paid"
                          value={opt}
                          defaultChecked={opt === "No"}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="field field-span">
                  <label htmlFor="sup_comments">Comentarios</label>
                  <textarea id="sup_comments" name="comments" />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Guardar crédito de adquisición
                </button>
              </div>
            </FlashForm>
          </div>

          <div className="panel">
            <h3 className="panel__title">Deudas a acreedores</h3>
            {suppliers.length === 0 ? (
              <p className="muted">Sin créditos de adquisición.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Acreedor</th>
                      <th>Cantidad</th>
                      <th>No. Stock</th>
                      <th>Pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.id}>
                        <td data-label="Fecha">{formatDate(s.at)}</td>
                        <td data-label="Acreedor">
                          <strong>{s.creditor}</strong>
                        </td>
                        <td data-label="Cantidad" className="money-neg">
                          {formatMoney(s.amount)}
                        </td>
                        <td data-label="No. Stock">{s.stock_no || "—"}</td>
                        <td data-label="Pagado">
                          <SupplierPaidToggle
                            id={s.id}
                            paid={s.paid === "Si" ? "Si" : "No"}
                            today={today}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
