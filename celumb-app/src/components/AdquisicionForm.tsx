"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  acquireAccessory,
  acquirePhone,
  type ActionResult,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { PhotoUploadField } from "@/components/PhotoUploadField";

const CHARGER_OPTIONS = ["Si", "No", "Se incluira en venta"] as const;
const CONDITION_OPTIONS = [
  "AA Nuevo",
  "A Bueno (9-10)",
  "B Regular (8)",
  "C Con marcas de uso (7)",
] as const;
const CARRIER_PRESETS = ["Liberado", "Telcel"] as const;

type ItemKind = "celular" | "otro";

type Props = {
  suggestedStockNo: string;
  suggestedAccStockNo?: string;
  today: string;
  /** nav = global header amber CTA; hero / toolbar = page CTAs; stock-add = Stock toolbar */
  variant?: "nav" | "toolbar" | "hero" | "inline" | "stock-add";
  buttonLabel?: string;
  defaultItemKind?: ItemKind;
};

export function AdquisicionForm({
  suggestedStockNo,
  suggestedAccStockNo = "ACC001",
  today,
  variant = "toolbar",
  buttonLabel = "Registrar adquisición",
  defaultItemKind,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [itemKind, setItemKind] = useState<ItemKind>(
    defaultItemKind ?? "celular",
  );
  const [carrierMode, setCarrierMode] = useState<"Liberado" | "Telcel" | "otra">(
    "Liberado",
  );
  const [fechaVal, setFechaVal] = useState(today);
  const [stockVal, setStockVal] = useState(suggestedStockNo);
  const [costVal, setCostVal] = useState("");
  const [priceVal, setPriceVal] = useState("");
  const [compraCredito, setCompraCredito] = useState(false);
  const [creditoAt, setCreditoAt] = useState(today);
  const [creditoPaid, setCreditoPaid] = useState<"No" | "Si">("No");
  const [accStockVal, setAccStockVal] = useState(suggestedAccStockNo);
  const [catalogVal, setCatalogVal] = useState("");
  const [descVal, setDescVal] = useState("");
  const [qtyVal, setQtyVal] = useState("1");
  const [costUnitVal, setCostUnitVal] = useState("");
  const [precioSugVal, setPrecioSugVal] = useState("");
  const [precioMaxVal, setPrecioMaxVal] = useState("");
  const [photo1Path, setPhoto1Path] = useState("");
  const [photo2Path, setPhoto2Path] = useState("");
  const [, startTransition] = useTransition();
  const lastHandledRef = useRef<ActionResult | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const costNum = costVal === "" ? NaN : Number(costVal);
  const priceNum = priceVal === "" ? NaN : Number(priceVal);
  const marginReady =
    Number.isFinite(costNum) && Number.isFinite(priceNum) && priceNum >= 0;
  const marginAmount = marginReady ? priceNum - costNum : null;
  const marginPct =
    marginReady && priceNum > 0
      ? Math.round(((priceNum - costNum) / priceNum) * 1000) / 10
      : null;

  function resetFormLocal() {
    setCarrierMode("Liberado");
    setFechaVal(today);
    setStockVal(suggestedStockNo);
    setCostVal("");
    setPriceVal("");
    setCompraCredito(false);
    setCreditoAt(today);
    setCreditoPaid("No");
    setAccStockVal(suggestedAccStockNo);
    setCatalogVal("");
    setDescVal("");
    setQtyVal("1");
    setCostUnitVal("");
    setPrecioSugVal("");
    setPrecioMaxVal("");
    setPhoto1Path("");
    setPhoto2Path("");
    setItemKind(defaultItemKind ?? "celular");
  }

  function openModal() {
    resetFormLocal();
    lastHandledRef.current = null;
    setOpen(true);
  }

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      try {
        const kind = String(formData.get("item_kind") ?? "celular");
        formData.set("ingreso_tipo", "Adquisición");
        if (kind === "otro") {
          return await acquireAccessory(formData);
        }
        const mode = String(formData.get("carrier_mode") ?? "");
        if (mode === "otra") {
          const other = String(formData.get("carrier_other") ?? "").trim();
          formData.set("carrier", other || "Otro");
        } else {
          formData.set("carrier", mode || "Liberado");
        }
        return await acquirePhone(formData);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "No se pudo guardar. Intenta de nuevo.";
        return { ok: false as const, error: msg };
      }
    },
    null as ActionResult | null,
  );

  useEffect(() => {
    if (!state || state === lastHandledRef.current) return;
    lastHandledRef.current = state;
    if (state.ok) {
      const code = state.stock_no || stockVal || suggestedStockNo;
      toast.success(`Registrado ${code}`);
      setOpen(false);
      resetFormLocal();
      startTransition(() => router.refresh());
    } else {
      toast.error(state.error);
    }
  }, [state, suggestedStockNo, stockVal, toast, router, startTransition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ctaClass =
    variant === "nav"
      ? "btn btn-primary btn-nav-cta"
      : variant === "hero"
        ? "btn btn-primary"
        : variant === "inline" || variant === "stock-add"
          ? "btn btn-solid"
          : "btn btn-primary btn-cta";

  return (
    <>
      <button
        type="button"
        className={ctaClass}
        onClick={openModal}
        aria-haspopup="dialog"
      >
        {buttonLabel}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="modal-panel__head">
                <div>
                  <p className="modal-eyebrow">Tipo de ingreso · Adquisición</p>
                  <h2 id={titleId} className="modal-panel__title">
                    Registrar adquisición
                  </h2>
                  <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                    Celular = MBC##. Otro = accesorio ACC001… (catálogo AMB
                    opcional).
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>

              <form
                action={formAction}
                className="adq-form"
                noValidate
                onSubmit={(e) => {
                  lastHandledRef.current = null;
                  if (!fechaVal.trim()) {
                    e.preventDefault();
                    toast.error("La fecha es obligatoria.");
                    return;
                  }
                  if (itemKind === "otro") {
                    if (!accStockVal.trim()) {
                      e.preventDefault();
                      toast.error("El No. stock ACC### es obligatorio.");
                      return;
                    }
                    if (!descVal.trim()) {
                      e.preventDefault();
                      toast.error("La descripción es obligatoria.");
                      return;
                    }
                    const qty = Number(qtyVal);
                    if (!Number.isFinite(qty) || qty <= 0) {
                      e.preventDefault();
                      toast.error("La cantidad debe ser mayor a 0.");
                      return;
                    }
                  } else {
                    if (!stockVal.trim()) {
                      e.preventDefault();
                      toast.error("El No. de stock es obligatorio.");
                      return;
                    }
                    const costEmpty = costVal.trim() === "";
                    const priceEmpty = priceVal.trim() === "";
                    if (costEmpty || priceEmpty) {
                      e.preventDefault();
                      toast.error(
                        "Costo y Precio inicial sugerido son obligatorios (sin datos).",
                      );
                      return;
                    }
                  }
                  if (compraCredito) {
                    const fd = new FormData(e.currentTarget);
                    const monto = String(fd.get("credito_monto") ?? "").trim();
                    const acreedor = String(
                      fd.get("credito_origen") ?? fd.get("creditor") ?? "",
                    ).trim();
                    const fechaCr = String(fd.get("credito_at") ?? "").trim();
                    if (!fechaCr) {
                      e.preventDefault();
                      toast.error(
                        "Crédito de adquisición: la Fecha es obligatoria.",
                      );
                      return;
                    }
                    if (!monto || Number(monto) <= 0) {
                      e.preventDefault();
                      toast.error(
                        "Crédito de adquisición: la Cantidad es obligatoria.",
                      );
                      return;
                    }
                    if (!acreedor) {
                      e.preventDefault();
                      toast.error(
                        "Crédito de adquisición: el Acreedor es obligatorio.",
                      );
                      return;
                    }
                  }
                }}
              >
                <input type="hidden" name="ingreso_tipo" value="Adquisición" />
                <input type="hidden" name="item_kind" value={itemKind} />

                <fieldset className="field field-span">
                  <legend>¿Qué adquieres?</legend>
                  <div className="choice-row" role="radiogroup">
                    <label className="choice">
                      <input
                        type="radio"
                        name="item_kind_ui"
                        checked={itemKind === "celular"}
                        onChange={() => setItemKind("celular")}
                      />
                      <span>Celular</span>
                    </label>
                    <label className="choice">
                      <input
                        type="radio"
                        name="item_kind_ui"
                        checked={itemKind === "otro"}
                        onChange={() => setItemKind("otro")}
                      />
                      <span>Otro</span>
                    </label>
                  </div>
                  <p className="field-hint">
                    Celular → MBC##. Otro → ACC001… (filtro Accesorios). KPIs
                    solo cuentan celulares.
                  </p>
                </fieldset>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="acquired_at">Fecha</label>
                    <input
                      id="acquired_at"
                      name="acquired_at"
                      type="date"
                      required
                      value={fechaVal}
                      onChange={(e) => setFechaVal(e.target.value)}
                    />
                  </div>

                  {itemKind === "celular" ? (
                    <>
                      <div className="field">
                        <label htmlFor="stock_no">No. Stock</label>
                        <input
                          id="stock_no"
                          name="stock_no"
                          value={stockVal}
                          onChange={(e) =>
                            setStockVal(e.target.value.toUpperCase())
                          }
                          required
                          placeholder={suggestedStockNo}
                          aria-describedby="stock_no_hint"
                        />
                        <p id="stock_no_hint" className="field-hint">
                          Sugerido: {suggestedStockNo} — puedes editarlo
                        </p>
                      </div>
                      <div className="field">
                        <label htmlFor="cost">Costo</label>
                        <input
                          id="cost"
                          name="cost"
                          type="number"
                          min={0}
                          step={1}
                          value={costVal}
                          onChange={(e) => setCostVal(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="suggested_price">
                          Precio inicial sugerido
                        </label>
                        <input
                          id="suggested_price"
                          name="suggested_price"
                          type="number"
                          min={0}
                          step={1}
                          value={priceVal}
                          onChange={(e) => setPriceVal(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="margin_display">Margen</label>
                        <input
                          id="margin_display"
                          type="text"
                          readOnly
                          className="input-locked"
                          value={
                            marginAmount == null
                              ? "—"
                              : `$${Math.round(marginAmount).toLocaleString("es-MX")}${
                                  marginPct != null ? ` (${marginPct}%)` : ""
                                }`
                          }
                          aria-describedby="margin_hint"
                        />
                        <input
                          type="hidden"
                          name="margin_suggested"
                          value={marginAmount ?? ""}
                        />
                        <p id="margin_hint" className="field-hint">
                          Precio − costo (se guarda con el equipo)
                        </p>
                      </div>

                      <fieldset className="field field-span">
                        <legend>Incluye cargador</legend>
                        <div className="choice-row" role="radiogroup">
                          {CHARGER_OPTIONS.map((opt) => (
                            <label key={opt} className="choice">
                              <input
                                type="radio"
                                name="includes_charger"
                                value={opt}
                                defaultChecked={opt === "Si"}
                                required
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label htmlFor="acc_stock_no">No. Stock</label>
                        <input
                          id="acc_stock_no"
                          name="stock_no"
                          value={accStockVal}
                          onChange={(e) =>
                            setAccStockVal(e.target.value.toUpperCase())
                          }
                          required
                          placeholder={suggestedAccStockNo}
                        />
                        <p className="field-hint">
                          Sugerido: {suggestedAccStockNo} (secuencia ACC###)
                        </p>
                      </div>
                      <div className="field">
                        <label htmlFor="qty">Cantidad</label>
                        <input
                          id="qty"
                          name="qty"
                          type="number"
                          min={1}
                          step={1}
                          value={qtyVal}
                          onChange={(e) => setQtyVal(e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="catalog_code">Catálogo (AMB)</label>
                        <input
                          id="catalog_code"
                          name="catalog_code"
                          value={catalogVal}
                          onChange={(e) => setCatalogVal(e.target.value)}
                          placeholder="B V8 USB (opcional)"
                        />
                      </div>
                      <div className="field field-span">
                        <label htmlFor="descripcion">Descripción</label>
                        <input
                          id="descripcion"
                          name="descripcion"
                          value={descVal}
                          onChange={(e) => setDescVal(e.target.value)}
                          required
                          placeholder="CABLE USB NORMAL TRENZADO SIN CAJA"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cost_unit">Costo unitario</label>
                        <input
                          id="cost_unit"
                          name="cost_unit"
                          type="number"
                          min={0}
                          step={0.01}
                          value={costUnitVal}
                          onChange={(e) => setCostUnitVal(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="precio_sugerido">$ Sugerido</label>
                        <input
                          id="precio_sugerido"
                          name="precio_sugerido"
                          type="number"
                          min={0}
                          step={1}
                          value={precioSugVal}
                          onChange={(e) => setPrecioSugVal(e.target.value)}
                          placeholder="Lista LP"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="precio_maximo">$ Máximo sug.</label>
                        <input
                          id="precio_maximo"
                          name="precio_maximo"
                          type="number"
                          min={0}
                          step={1}
                          value={precioMaxVal}
                          onChange={(e) => setPrecioMaxVal(e.target.value)}
                          placeholder="Lista LP"
                        />
                      </div>
                    </>
                  )}

                  {itemKind === "celular" && (
                    <>
                      <div className="field">
                        <label htmlFor="brand">Marca</label>
                        <input
                          id="brand"
                          name="brand"
                          required
                          placeholder="Samsung"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="model">Modelo</label>
                        <input
                          id="model"
                          name="model"
                          required
                          placeholder="Galaxy A07"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="imei">IMEI</label>
                        <input id="imei" name="imei" placeholder="Opcional" />
                      </div>

                      <fieldset className="field field-span">
                        <legend>Compañia</legend>
                        <div className="choice-row" role="radiogroup">
                          {CARRIER_PRESETS.map((opt) => (
                            <label key={opt} className="choice">
                              <input
                                type="radio"
                                name="carrier_mode"
                                value={opt}
                                checked={carrierMode === opt}
                                onChange={() => setCarrierMode(opt)}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                          <label className="choice">
                            <input
                              type="radio"
                              name="carrier_mode"
                              value="otra"
                              checked={carrierMode === "otra"}
                              onChange={() => setCarrierMode("otra")}
                            />
                            <span>Otra</span>
                          </label>
                        </div>
                        {carrierMode === "otra" && (
                          <input
                            name="carrier_other"
                            className="carrier-other"
                            placeholder="Escribe la compañía"
                            required
                          />
                        )}
                      </fieldset>

                      <fieldset className="field field-span">
                        <legend>Condicion estetica</legend>
                        <div
                          className="choice-row choice-row--wrap"
                          role="radiogroup"
                        >
                          {CONDITION_OPTIONS.map((opt) => (
                            <label key={opt} className="choice">
                              <input
                                type="radio"
                                name="condition_label"
                                value={opt}
                                defaultChecked={opt === "A Bueno (9-10)"}
                                required
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="field">
                        <label htmlFor="ram">RAM</label>
                        <input id="ram" name="ram" placeholder="4 / 4 + 1" />
                      </div>
                      <div className="field">
                        <label htmlFor="storage">Almacenamiento</label>
                        <input id="storage" name="storage" placeholder="128" />
                      </div>
                      <div className="field">
                        <label htmlFor="battery_pct">% de batería</label>
                        <input
                          id="battery_pct"
                          name="battery_pct"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          placeholder="85"
                        />
                      </div>
                    </>
                  )}

                  <div className="field field-span">
                    <label htmlFor="comments">Comentarios</label>
                    <textarea id="comments" name="comments" />
                  </div>

                  {itemKind === "celular" && (
                    <div className="field-span photo-upload-grid">
                      <input type="hidden" name="photo1_path" value={photo1Path} />
                      <input type="hidden" name="photo2_path" value={photo2Path} />
                      <PhotoUploadField
                        slot={1}
                        label="Subir Foto 1"
                        value={photo1Path}
                        onChange={setPhoto1Path}
                        onSuccessMessage={(m) => toast.success(m)}
                        onErrorMessage={(m) => toast.error(m)}
                      />
                      <PhotoUploadField
                        slot={2}
                        label="Subir Foto 2"
                        value={photo2Path}
                        onChange={setPhoto2Path}
                        onSuccessMessage={(m) => toast.success(m)}
                        onErrorMessage={(m) => toast.error(m)}
                      />
                    </div>
                  )}

                  {/* Crédito de adquisición — default OFF; menú completo al marcar */}
                  <div className="field field-span">
                    <div className="field-check">
                      <input
                        id="compra_credito"
                        name="compra_credito"
                        type="checkbox"
                        checked={compraCredito}
                        onChange={(e) => {
                          setCompraCredito(e.target.checked);
                          if (e.target.checked && !creditoAt) {
                            setCreditoAt(fechaVal || today);
                          }
                        }}
                      />
                      <label htmlFor="compra_credito">
                        Crédito de adquisición
                      </label>
                    </div>
                    <p className="field-hint">
                      Por defecto no seleccionado. Al marcar, registra la deuda
                      en cartera de acreedores.
                    </p>
                  </div>
                </div>

                <div
                  id="adq-credito-adquisicion"
                  className="venta-credito-fields"
                  hidden={!compraCredito}
                  aria-hidden={!compraCredito}
                >
                  <p className="credit-block-label">
                    Registrar crédito de adquisición
                  </p>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="credito_at">Fecha</label>
                      <input
                        id="credito_at"
                        name="credito_at"
                        type="date"
                        value={creditoAt || fechaVal || today}
                        onChange={(e) => setCreditoAt(e.target.value)}
                        required={compraCredito}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="credito_monto">Cantidad</label>
                      <input
                        id="credito_monto"
                        name="credito_monto"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Monto adeudado"
                        required={compraCredito}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="credito_origen">Acreedor</label>
                      <input
                        id="credito_origen"
                        name="credito_origen"
                        placeholder="Nombre del acreedor"
                        required={compraCredito}
                      />
                    </div>
                    <fieldset className="field">
                      <legend>Pagado</legend>
                      <div className="choice-row" role="radiogroup">
                        {(["No", "Si"] as const).map((opt) => (
                          <label key={opt} className="choice">
                            <input
                              type="radio"
                              name="credito_paid"
                              value={opt}
                              checked={creditoPaid === opt}
                              onChange={() => setCreditoPaid(opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="field field-span">
                      <label htmlFor="credito_comments">Comentarios</label>
                      <textarea
                        id="credito_comments"
                        name="credito_comments"
                        placeholder="Notas del crédito / acreedor"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pending}
                  >
                    {pending ? "Guardando…" : "Registrar adquisición"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-solid"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
                <div className="form-status" aria-live="polite">
                  {pending && <span className="muted">Guardando…</span>}
                  {!pending && state?.ok && (
                    <span className="ok">
                      Registrado {state.stock_no || stockVal}
                    </span>
                  )}
                  {!pending && state && !state.ok && (
                    <span className="err">{state.error}</span>
                  )}
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
