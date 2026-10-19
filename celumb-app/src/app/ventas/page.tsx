import { VentaForm } from "@/components/VentaForm";
import {
  incomeByChannel,
  listAvailablePhones,
  listSales,
} from "@/lib/queries";
import { formatDate, formatMoney, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const available = await listAvailablePhones();
  const sales = await listSales();
  const byChannel = await incomeByChannel();
  const today = todayISO();

  return (
    <>
      <section className="section" style={{ marginTop: 0 }}>
        <div className="section__head">
          <div>
            <h1 className="section__title">Ventas / ingresos</h1>
            <p className="section__lede">
              Venta / salida de mercancía — Tipo de venta Contado o Credito,
              alineado al Google Form de MB Celulares.
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <h2 className="panel__title">Registrar venta</h2>
            {available.length === 0 ? (
              <p className="muted">
                No hay equipos disponibles. Registra una adquisición primero.
              </p>
            ) : (
              <VentaForm
                phones={available.map((p) => ({
                  id: p.id,
                  stock_no: p.stock_no,
                  brand: p.brand,
                  model: p.model,
                  suggested_price: p.suggested_price,
                }))}
                today={today}
              />
            )}
          </div>

          <div className="panel">
            <h2 className="panel__title">Ingresos por tipo</h2>
            {byChannel.length === 0 ? (
              <p className="muted">Aún no hay ventas.</p>
            ) : (
              <ul className="list-plain">
                {byChannel.map((c) => (
                  <li key={c.channel}>
                    <span>
                      {c.channel} · {c.n} venta{c.n === 1 ? "" : "s"}
                    </span>
                    <span className="money-pos">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <h2 className="panel__title">Historial de ventas</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>No. Stock</th>
                  <th>Equipo</th>
                  <th>Monto venta</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Extra</th>
                  <th>Margen</th>
                  <th>Tiempo stock</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Fecha">{formatDate(s.sold_at)}</td>
                    <td data-label="No. Stock">
                      <strong>{s.stock_no}</strong>
                    </td>
                    <td data-label="Equipo">
                      {s.brand} {s.model}
                    </td>
                    <td data-label="Monto venta">{formatMoney(s.amount)}</td>
                    <td data-label="Cliente">{s.customer}</td>
                    <td data-label="Tipo">
                      <span
                        className={
                          s.channel === "Credito"
                            ? "badge badge-credit"
                            : "badge badge-ok"
                        }
                      >
                        {s.channel}
                      </span>
                    </td>
                    <td data-label="Extra">{formatMoney(s.extra_costs || 0)}</td>
                    <td
                      data-label="Margen"
                      className={
                        s.margen >= 0 ? "money-pos" : "money-neg"
                      }
                    >
                      {formatMoney(s.margen)}
                    </td>
                    <td data-label="Tiempo stock">{s.days_in_stock} d</td>
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
