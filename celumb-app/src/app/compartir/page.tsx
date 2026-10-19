import { PrintButtonClient } from "@/components/PrintButtonClient";
import { listAvailablePhones } from "@/lib/queries";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompartirPage() {
  const phones = await listAvailablePhones();
  const generated = new Date().toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="share-page">
      <header className="share-head">
        <div>
          <p className="share-brand">CeluMB · MB Celulares</p>
          <h1 className="share-title">Equipos disponibles</h1>
          <p className="share-meta">
            {phones.length} equipo{phones.length === 1 ? "" : "s"} · generado{" "}
            {generated}
          </p>
        </div>
        <div className="share-actions no-print">
          <PrintButtonClient />
        </div>
      </header>

      {phones.length === 0 ? (
        <p className="muted">No hay equipos disponibles por ahora.</p>
      ) : (
        <div className="table-wrap share-table-wrap">
          <table className="data share-table">
            <thead>
              <tr>
                <th>No. Stock</th>
                <th>Marca / Modelo</th>
                <th>Precio</th>
                <th>Condición</th>
                <th>RAM</th>
                <th>Almac.</th>
                <th>% bat.</th>
                <th>Compañía</th>
                <th>Cargador</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((p) => (
                <tr key={p.id}>
                  <td data-label="No. Stock">
                    <strong>{p.stock_no}</strong>
                  </td>
                  <td data-label="Marca / Modelo">
                    {p.brand} {p.model}
                  </td>
                  <td data-label="Precio">{formatMoney(p.suggested_price)}</td>
                  <td data-label="Condición">{p.condition_label}</td>
                  <td data-label="RAM">{p.ram || "—"}</td>
                  <td data-label={"Almac."}>{p.storage || "—"}</td>
                  <td data-label={"% bat."}>
                    {p.battery_pct != null && Number.isFinite(p.battery_pct)
                      ? `${p.battery_pct}%`
                      : "—"}
                  </td>
                  <td data-label="Compañía">{p.carrier}</td>
                  <td data-label="Cargador">{p.includes_charger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="share-foot muted">
        Lista de stock disponible — sin costos ni equipos vendidos.
      </p>
    </div>
  );
}
