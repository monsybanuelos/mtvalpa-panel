"use client";

import type { Accessory } from "@/lib/db";
import { formatMoney } from "@/lib/format";

type Props = {
  accessories: Accessory[];
};

export function AccesoriosStock({ accessories }: Props) {
  const totalUnits = accessories.reduce((s, a) => s + (a.qty || 0), 0);

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <h2 className="panel__title" style={{ margin: 0 }}>
          Accesorios · {accessories.length} SKUs · {totalUnits} piezas
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          Inventario separado de celulares · códigos AMB/LP (no MBC##)
        </p>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Stock</th>
              <th>Costo u.</th>
              <th>$ Sugerido</th>
              <th>$ Máximo</th>
            </tr>
          </thead>
          <tbody>
            {accessories.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Sin accesorios. Registra una adquisición tipo «Otro» o
                  reinicia la DB para cargar el seed del Excel.
                </td>
              </tr>
            ) : (
              accessories.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.codigo}</strong>
                  </td>
                  <td>{a.descripcion}</td>
                  <td>{a.qty}</td>
                  <td>
                    {a.cost_unit != null ? formatMoney(a.cost_unit) : "—"}
                  </td>
                  <td>
                    {a.precio_sugerido != null
                      ? formatMoney(a.precio_sugerido)
                      : "—"}
                  </td>
                  <td>
                    {a.precio_maximo != null
                      ? formatMoney(a.precio_maximo)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
