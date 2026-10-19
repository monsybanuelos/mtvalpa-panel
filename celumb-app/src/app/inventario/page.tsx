import { AdquisicionForm } from "@/components/AdquisicionForm";
import { InventarioStock } from "@/components/InventarioStock";
import {
  listAccessories,
  listPhones,
  nextAccStockNo,
  nextStockNo,
  listLedger,
} from "@/lib/queries";
import { formatDate, formatMoney, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const phones = await listPhones("all");
  const accessories = await listAccessories();
  const suggested = await nextStockNo();
  const suggestedAcc = await nextAccStockNo();
  const ledger = await listLedger(12);
  const today = todayISO();

  return (
    <>
      <section className="section" style={{ marginTop: 0 }}>
        <div className="section__head section__head--cta">
          <div>
            <h1 className="section__title">Inventario</h1>
            <p className="section__lede">
              Stock por defecto = celulares (MBC##). Filtrar → Accesorios (ACC)
              para ver ACC001…. KPIs solo celulares.
            </p>
          </div>
          <AdquisicionForm
            suggestedStockNo={suggested}
            suggestedAccStockNo={suggestedAcc}
            today={today}
            variant="toolbar"
          />
        </div>
      </section>

      <section className="section">
        <InventarioStock
          phones={phones}
          accessories={accessories}
          suggestedStockNo={suggested}
          suggestedAccStockNo={suggestedAcc}
          today={today}
        />
      </section>

      <section className="section">
        <div className="panel">
          <h2 className="panel__title">
            Movimientos (adquisición / venta / cobranza)
          </h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo de ingreso</th>
                  <th>No. Stock</th>
                  <th>Monto</th>
                  <th>Disponible</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Fecha">{formatDate(e.at)}</td>
                    <td data-label="Tipo de ingreso">
                      {e.kind === "adquisicion"
                        ? "Adquisición"
                        : e.kind === "adquisicion_accesorio"
                          ? "Adquisición accesorio"
                          : e.kind === "venta"
                            ? "Venta"
                            : e.kind === "cobranza"
                              ? "Cobranza"
                              : e.kind === "credito_adquisicion"
                                ? "Crédito adquisición"
                                : e.kind === "pago_acreedor"
                                  ? "Pago acreedor"
                                  : e.kind}
                    </td>
                    <td data-label="No. Stock">{e.stock_no || "—"}</td>
                    <td
                      data-label="Monto"
                      className={e.amount < 0 ? "money-neg" : "money-pos"}
                    >
                      {formatMoney(e.amount)}
                    </td>
                    <td data-label="Disponible">
                      {e.available_after == null ? "—" : e.available_after}
                    </td>
                    <td data-label="Nota">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
