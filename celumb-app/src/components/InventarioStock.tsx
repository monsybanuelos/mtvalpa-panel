"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Accessory, Phone } from "@/lib/db";
import { daysBetween, formatDate, formatMoney } from "@/lib/format";
import { AdquisicionForm } from "@/components/AdquisicionForm";
import { EditAccessoryModal } from "@/components/EditInventoryForms";
import { GenerarEtiquetaButton } from "@/components/GenerarEtiquetaButton";

type Props = {
  phones: Phone[];
  accessories: Accessory[];
  suggestedStockNo: string;
  suggestedAccStockNo: string;
  today: string;
};

type InventarioTipo = "celulares" | "accesorios";
type EstadoFilter = "all" | "disponible" | "vendido";


function photoSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const name = path.split("/").pop();
  return name ? `/api/phone-photos/${name}` : null;
}

export function InventarioStock({
  phones,
  accessories,
  suggestedStockNo,
  suggestedAccStockNo,
  today,
}: Props) {
  const [tipo, setTipo] = useState<InventarioTipo>("celulares");
  const [estado, setEstado] = useState<EstadoFilter>("disponible");
  const [marca, setMarca] = useState("all");
  const [open, setOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Accessory | null>(null);

  const brands = useMemo(() => {
    const set = new Set(phones.map((p) => p.brand).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [phones]);

  const filteredPhones = useMemo(() => {
    return phones.filter((p) => {
      if (estado !== "all" && p.status !== estado) return false;
      if (marca !== "all" && p.brand !== marca) return false;
      return true;
    });
  }, [phones, estado, marca]);

  const isPhones = tipo === "celulares";
  const visiblePhones = filteredPhones.length;
  const titleCount = isPhones
    ? `${visiblePhones} equipo${visiblePhones === 1 ? "" : "s"}`
    : `${accessories.length} SKUs`;

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <h2 className="panel__title" style={{ margin: 0 }}>
          Stock · {titleCount}
        </h2>
        <div className="stock-actions">
          <AdquisicionForm
            suggestedStockNo={suggestedStockNo}
            suggestedAccStockNo={suggestedAccStockNo}
            today={today}
            variant="stock-add"
            buttonLabel="Agregar manualmente"
            defaultItemKind={isPhones ? "celular" : "otro"}
          />
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            Filtrar
          </button>
          <a
            className="btn btn-primary"
            href="/compartir"
            target="_blank"
            rel="noopener noreferrer"
          >
            Compartir
          </a>
        </div>
      </div>

      {open && (
        <div className="filter-bar" role="search">
          <div className="field">
            <label htmlFor="filter_tipo">Tipo</label>
            <select
              id="filter_tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as InventarioTipo)}
            >
              <option value="celulares">Celulares (MB)</option>
              <option value="accesorios">Accesorios (ACC)</option>
            </select>
          </div>
          {isPhones && (
            <>
              <div className="field">
                <label htmlFor="filter_estado">Estado</label>
                <select
                  id="filter_estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoFilter)}
                >
                  <option value="all">Todos</option>
                  <option value="disponible">Disponible</option>
                  <option value="vendido">Vendido</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="filter_marca">Marca</label>
                <select
                  id="filter_marca"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <p className="filter-bar__count muted">
                {filteredPhones.length} de {phones.length}
              </p>
            </>
          )}
          {!isPhones && (
            <p className="filter-bar__count muted">
              {accessories.length} accesorios · códigos ACC001…
            </p>
          )}
        </div>
      )}

      {isPhones ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>No. Stock</th>
                <th>Estado</th>
                <th>Marca / Modelo</th>
                <th>Precio</th>
                <th>Compañia</th>
                <th>Condicion estetica</th>
                <th>RAM</th>
                <th>Almac.</th>
                <th>% bat.</th>
                <th>Incluye cargador</th>
                <th>Costo</th>
                <th>Margen</th>
                <th>Compra crédito</th>
                <th>Fotos</th>
                <th>IMEI</th>
                <th>Fecha</th>
                <th>Días</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredPhones.length === 0 ? (
                <tr>
                  <td colSpan={18} className="muted">
                    Sin equipos con ese filtro.
                  </td>
                </tr>
              ) : (
                filteredPhones.map((p) => {
                  const price = p.suggested_price;
                  const cost = p.cost;
                  const margenPct =
                    Number.isFinite(price) &&
                    price > 0 &&
                    Number.isFinite(cost)
                      ? Math.round(((price - cost) / price) * 1000) / 10
                      : null;
                  const onCredit = Number(p.compra_credito) === 1;
                  return (
                    <tr key={p.id}>
                      <td data-label="No. Stock">
                        <strong>{p.stock_no}</strong>
                      </td>
                      <td data-label="Estado">
                        <span
                          className={
                            p.status === "disponible"
                              ? "badge badge-ok"
                              : "badge badge-sold"
                          }
                        >
                          {p.status === "disponible"
                            ? "DISPONIBLE"
                            : "VENDIDO"}
                        </span>
                      </td>
                      <td data-label="Marca / Modelo">
                        {p.brand} {p.model}
                      </td>
                      <td data-label="Precio">{formatMoney(p.suggested_price)}</td>
                      <td data-label="Compañia">{p.carrier}</td>
                      <td data-label="Condicion estetica">{p.condition_label}</td>
                      <td data-label="RAM">{p.ram || "—"}</td>
                      <td data-label={"Almac."}>{p.storage || "—"}</td>
                      <td data-label={"% bat."}>
                        {p.battery_pct != null &&
                        Number.isFinite(p.battery_pct)
                          ? `${p.battery_pct}%`
                          : "—"}
                      </td>
                      <td data-label="Incluye cargador">{p.includes_charger}</td>
                      <td data-label="Costo">{formatMoney(p.cost)}</td>
                      <td
                        data-label="Margen"
                        className={
                          margenPct == null
                            ? ""
                            : margenPct >= 0
                              ? "money-pos"
                              : "money-neg"
                        }
                        title={
                          margenPct == null
                            ? undefined
                            : `$${Math.round(price - cost).toLocaleString("es-MX")}`
                        }
                      >
                        {margenPct == null ? "—" : `${margenPct}%`}
                      </td>
                      <td data-label="Compra crédito">
                        {onCredit ? (
                          <span
                            className="badge badge-credit"
                            title={
                              p.credito_origen
                                ? `${p.credito_origen} · ${formatMoney(p.credito_monto ?? 0)}`
                                : undefined
                            }
                          >
                            Crédito
                            {p.credito_monto != null
                              ? ` ${formatMoney(p.credito_monto)}`
                              : ""}
                            {p.credito_origen
                              ? ` · ${p.credito_origen}`
                              : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="Fotos">
                        <div className="stock-photos">
                          {p.photo1_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a
                              href={photoSrc(p.photo1_path) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Foto 1"
                            >
                              <img
                                src={photoSrc(p.photo1_path) || ""}
                                alt=""
                                className="stock-photos__thumb"
                              />
                            </a>
                          ) : null}
                          {p.photo2_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a
                              href={photoSrc(p.photo2_path) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Foto 2"
                            >
                              <img
                                src={photoSrc(p.photo2_path) || ""}
                                alt=""
                                className="stock-photos__thumb"
                              />
                            </a>
                          ) : null}
                          {!p.photo1_path && !p.photo2_path ? "—" : null}
                        </div>
                      </td>
                      <td data-label="IMEI">{p.imei || "—"}</td>
                      <td data-label="Fecha">{formatDate(p.acquired_at)}</td>
                      <td data-label="Días">{daysBetween(p.acquired_at)}</td>
                      <td data-label="">
                        <div className="stock-row-actions">
                          <Link
                            className="btn-link"
                            scroll
                            href={`/inventario/editar/${encodeURIComponent(p.stock_no)}`}
                          >
                            Editar
                          </Link>
                          <GenerarEtiquetaButton
                            phone={{
                              stock: p.stock_no,
                              model: p.model,
                              brand: p.brand,
                              price: p.suggested_price,
                              battery: p.battery_pct,
                              storage: p.storage,
                              ram: p.ram,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>No. Stock</th>
                <th>Catálogo</th>
                <th>Descripción</th>
                <th>Stock</th>
                <th>Costo u.</th>
                <th>$ Sugerido</th>
                <th>$ Máximo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accessories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Sin accesorios. Usa adquisición tipo «Otro» o espera el
                    stock que pase Jonax.
                  </td>
                </tr>
              ) : (
                accessories.map((a) => (
                  <tr key={a.id}>
                    <td data-label="No. Stock">
                      <strong>{a.stock_no || a.codigo}</strong>
                    </td>
                    <td data-label="Catálogo" className="muted">
                      {a.catalog_code || "—"}
                    </td>
                    <td data-label="Descripción">{a.descripcion}</td>
                    <td data-label="Stock">{a.qty}</td>
                    <td data-label={"Costo u."}>
                      {a.cost_unit != null ? formatMoney(a.cost_unit) : "—"}
                    </td>
                    <td data-label={"$ Sugerido"}>
                      {a.precio_sugerido != null
                        ? formatMoney(a.precio_sugerido)
                        : "—"}
                    </td>
                    <td data-label={"$ Máximo"}>
                      {a.precio_maximo != null
                        ? formatMoney(a.precio_maximo)
                        : "—"}
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setEditAcc(a)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editAcc ? (
        <EditAccessoryModal
          accessory={editAcc}
          open
          onClose={() => setEditAcc(null)}
        />
      ) : null}
    </div>
  );
}
