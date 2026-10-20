import Link from "next/link";
import { AdquisicionForm } from "@/components/AdquisicionForm";
import { requireAdminPage } from "@/lib/auth";
import {
  getDashboardStats,
  listCreditAccounts,
  listLowish,
  listPhones,
  nextAccStockNo,
  nextStockNo,
} from "@/lib/queries";
import { formatMoney, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireAdminPage();
  const stats = await getDashboardStats();
  const available = (await listPhones("disponible")).slice(0, 5);
  const credits = (await listCreditAccounts())
    .filter((c) => c.liquidado !== "Si")
    .slice(0, 4);
  const aging = await listLowish();
  const suggested = await nextStockNo();
  const suggestedAcc = await nextAccStockNo();
  const today = todayISO();
  const monthLabel = (() => {
    const [y, m] = stats.monthPrefix.split("-");
    const names = [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ];
    const mi = Number(m) - 1;
    return `${names[mi] ?? m} ${y}`;
  })();

  return (
    <>
      <section className="hero" aria-label="CeluMB">
        <h1 className="hero__brand">CeluMB</h1>
        <p className="hero__tag">
          Inventario por No. de stock, ventas con utilidad y crédito con
          cobranza — el flujo de MB Celulares en un solo lugar.
        </p>
        <div className="hero__actions">
          <AdquisicionForm
            suggestedStockNo={suggested}
            suggestedAccStockNo={suggestedAcc}
            today={today}
            variant="hero"
          />
          <Link href="/inventario" className="btn btn-ghost">
            Ver inventario
          </Link>
          <Link href="/ventas" className="btn btn-ghost">
            Registrar venta
          </Link>
          <Link href="/credito#creditos-activos" className="btn btn-ghost">
            Ver créditos activos
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2 className="section__title">Resumen del negocio</h2>
            <p className="section__lede">
              Ventas del mes en primer plano, utilidad y margen, stock en piso y
              lo que falta liquidar a crédito.
            </p>
          </div>
        </div>

        <div className="stat-row stat-row--featured">
          <div className="stat stat--hero">
            <span className="stat__label">Ventas mensual · {monthLabel}</span>
            <span className="stat__value stat__value--lg">
              {formatMoney(stats.salesMonth)}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Utilidad mensual</span>
            <span
              className={
                stats.utilidadMonth >= 0
                  ? "stat__value money-pos"
                  : "stat__value money-neg"
              }
            >
              {formatMoney(stats.utilidadMonth)}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Utilidad</span>
            <span
              className={
                stats.utilidad >= 0
                  ? "stat__value money-pos"
                  : "stat__value money-neg"
              }
            >
              {formatMoney(stats.utilidad)}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Margen</span>
            <span
              className={
                stats.marginPct == null
                  ? "stat__value"
                  : stats.marginPct >= 0
                    ? "stat__value money-pos"
                    : "stat__value money-neg"
              }
            >
              {stats.marginPct == null ? "—" : `${stats.marginPct}%`}
            </span>
          </div>
        </div>

        <div className="stat-row stat-row--secondary">
          <div className="stat stat--muted">
            <span className="stat__label">Costo stock</span>
            <span className="stat__value stat__value--sm">
              {formatMoney(stats.stockCost)}
            </span>
          </div>
          <div className="stat stat--muted">
            <span className="stat__label">Valor de stock</span>
            <span className="stat__value stat__value--sm">
              {formatMoney(stats.stockValue)}
            </span>
          </div>
          <div className="stat stat--muted">
            <span className="stat__label">Por cobrar</span>
            <span className="stat__value stat__value--sm">
              {formatMoney(stats.receivable)}
            </span>
          </div>
          <div className="stat stat--muted">
            <span className="stat__label">Stock hoy</span>
            <span className="stat__value stat__value--sm">{stats.available}</span>
          </div>
          <div className="stat stat--muted">
            <span className="stat__label">Vendidos</span>
            <span className="stat__value stat__value--sm">{stats.sold}</span>
          </div>
          <div className="stat stat--muted">
            <span className="stat__label">Ventas totales</span>
            <span className="stat__value stat__value--sm">
              {formatMoney(stats.salesTotal)}
            </span>
          </div>
        </div>
      </section>

      <section className="section grid-2">
        <div className="panel">
          <h3 className="panel__title">Disponibles</h3>
          {available.length === 0 ? (
            <p className="muted">No hay equipos en piso.</p>
          ) : (
            <ul className="list-plain">
              {available.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.stock_no}</strong> · {p.brand} {p.model}
                  </span>
                  <span>{formatMoney(p.suggested_price)}</span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "0.9rem" }}>
            <Link href="/inventario" className="btn btn-solid">
              Ir a inventario
            </Link>
          </p>
        </div>

        <div className="panel">
          <h3 className="panel__title">Crédito y cobranza</h3>
          {credits.length === 0 ? (
            <p className="muted">Sin créditos abiertos.</p>
          ) : (
            <ul className="list-plain">
              {credits.map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>{c.debtor_name}</strong> · {c.stock_no}
                  </span>
                  <span className="money-neg">{formatMoney(c.balance)}</span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "0.9rem" }}>
            <Link href="/credito" className="btn btn-solid">
              Ir a crédito
            </Link>
          </p>
        </div>
      </section>

      {aging.length > 0 && (
        <section className="section">
          <div className="panel">
            <h3 className="panel__title">Tiempo en stock (disponibles)</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Precio</th>
                    <th>No. Stock</th>
                    <th>Equipo</th>
                    <th>Costo</th>
                    <th>Días</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Precio">
                        {formatMoney(p.suggested_price)}
                      </td>
                      <td data-label="No. Stock">{p.stock_no}</td>
                      <td data-label="Equipo">
                        {p.brand} {p.model}
                      </td>
                      <td data-label="Costo">{formatMoney(p.cost)}</td>
                      <td data-label="Días">
                        <span
                          className={
                            p.days >= 30 ? "badge badge-warn" : "badge badge-ok"
                          }
                        >
                          {p.days} d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
