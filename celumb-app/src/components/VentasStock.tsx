"use client";

import { Fragment, useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { salesPostText, type SalesStockPhone } from "@/lib/sales-stock";
import { useToast } from "@/components/Toast";

type EstadoFilter = "all" | "disponible" | "vendido";

type Props = {
  phones: SalesStockPhone[];
};

function PhotoLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <button type="button" className="btn-link" disabled>
        {label}
      </button>
    );
  }
  return (
    <a
      className="btn-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function VentasStock({ phones }: Props) {
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoFilter>("disponible");
  const [marca, setMarca] = useState("all");
  const [open, setOpen] = useState(false);
  const [pub, setPub] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const brands = useMemo(() => {
    const set = new Set(phones.map((p) => p.brand).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [phones]);

  const filtered = useMemo(() => {
    return phones.filter((p) => {
      if (estado !== "all" && p.status !== estado) return false;
      if (marca !== "all" && p.brand !== marca) return false;
      return true;
    });
  }, [phones, estado, marca]);

  async function onPublish(phone: SalesStockPhone) {
    const text = salesPostText(phone);
    setPub(text);
    const copied = await copyText(text);
    if (copied) toast.success("Publicación copiada");
    else toast.error("No se pudo copiar. Copia el texto del recuadro.");
  }

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <h2 className="panel__title" style={{ margin: 0 }}>
          Stock · {filtered.length} equipo{filtered.length === 1 ? "" : "s"}
        </h2>
        <div className="stock-actions">
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            Filtrar
          </button>
        </div>
      </div>

      {open && (
        <div className="filter-bar" role="search">
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
            {filtered.length} de {phones.length}
          </p>
        </div>
      )}

      <div className="table-wrap">
        <table className="data ventas-stock">
          <thead>
            <tr>
              <th>No. Stock</th>
              <th>Estado</th>
              <th>Marca / Modelo</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Sin equipos con ese filtro.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const openRow = Boolean(expanded[p.id]);
                const detailsId = `ventas-more-${p.id}`;
                return (
                  <Fragment key={p.id}>
                    <tr className={openRow ? "ventas-main is-open" : "ventas-main"}>
                      <td data-label="No. Stock">
                        <strong>{p.stock_no || "—"}</strong>
                      </td>
                      <td data-label="Estado">
                        <span
                          className={
                            p.status === "disponible"
                              ? "badge badge-ok"
                              : "badge badge-sold"
                          }
                        >
                          {p.status === "disponible" ? "DISPONIBLE" : "VENDIDO"}
                        </span>
                      </td>
                      <td data-label="Marca / Modelo">
                        {p.brand} {p.model}
                      </td>
                      <td data-label="Precio">{formatMoney(p.suggested_price)}</td>
                      <td data-label="">
                        <button
                          type="button"
                          className="btn-link"
                          aria-expanded={openRow}
                          aria-controls={detailsId}
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [p.id]: !prev[p.id],
                            }))
                          }
                        >
                          {openRow ? "Ver menos" : "Ver más"}
                        </button>
                      </td>
                    </tr>
                    {openRow ? (
                      <tr className="ventas-detail-row" id={detailsId}>
                        <td colSpan={5} data-label="">
                          <div className="ventas-detail-grid">
                            <div>
                              <span>Compañía</span>
                              <strong>{p.carrier || "—"}</strong>
                            </div>
                            <div>
                              <span>Condición</span>
                              <strong>{p.condition_label || "—"}</strong>
                            </div>
                            <div>
                              <span>RAM</span>
                              <strong>{p.ram || "—"}</strong>
                            </div>
                            <div>
                              <span>Almacenamiento</span>
                              <strong>{p.storage || "—"}</strong>
                            </div>
                            <div>
                              <span>% batería</span>
                              <strong>
                                {p.battery_pct != null &&
                                Number.isFinite(p.battery_pct)
                                  ? `${p.battery_pct}%`
                                  : "—"}
                              </strong>
                            </div>
                            <div>
                              <span>Cargador</span>
                              <strong>{p.includes_charger || "—"}</strong>
                            </div>
                            <div className="ventas-detail-grid__actions">
                              <div className="ventas-actions">
                                <PhotoLink
                                  href={p.photo1_url}
                                  label="Descargar imagen 1"
                                />
                                <PhotoLink
                                  href={p.photo2_url}
                                  label="Descargar imagen 2"
                                />
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => onPublish(p)}
                                >
                                  Generar publicación para ventas
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pub != null && (
        <div
          className="modal-backdrop is-open"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPub(null);
          }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pub-title"
          >
            <div className="modal-panel__head">
              <div>
                <p className="modal-eyebrow">Ventas</p>
                <h2 id="pub-title" className="modal-panel__title">
                  Publicación para ventas
                </h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setPub(null)}
              >
                ×
              </button>
            </div>
            <pre className="pub-text">{pub}</pre>
            <div className="stock-actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const copied = await copyText(pub);
                  if (copied) toast.success("Publicación copiada");
                  else toast.error("No se pudo copiar. Selecciona el texto.");
                }}
              >
                Copiar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPub(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
