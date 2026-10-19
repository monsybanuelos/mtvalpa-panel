"use server";

import { revalidatePath } from "next/cache";
import {
  canAcquire,
  canManageSupplierCredit,
  requireSession,
} from "./auth";
import { getDb, nextAccStockNo, nextStockNo } from "./db";
import { useCloudDb } from "./cloud-env";
import * as cloudMut from "./cloud-mutate";
import {
  nextAccStockNo as nextAccStockNoCloud,
  nextStockNo as nextStockNoCloud,
} from "./db-cloud";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/inventario");
  revalidatePath("/ventas");
  revalidatePath("/credito");
}

export type ActionResult =
  | { ok: true; stock_no?: string; message?: string }
  | { ok: false; error: string };

async function requireAdminResult(): Promise<ActionResult | null> {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      return { ok: false, error: "Solo Admin puede hacer esta operación." };
    }
    return null;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Debes iniciar sesión.",
    };
  }
}

const CHARGER_OK = new Set(["Si", "No", "Se incluira en venta"]);
const CONDITION_OK = new Set([
  "AA Nuevo",
  "A Bueno (9-10)",
  "B Regular (8)",
  "C Con marcas de uso (7)",
]);
const STATUS3 = new Set(["Si", "No", "Retrasado"]);
const SALE_TYPE = new Set(["Contado", "Credito"]);

export async function acquirePhone(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Debes iniciar sesión.",
    };
  }
  if (!canAcquire(session.role)) {
    return { ok: false, error: "Solo Admin puede registrar adquisiciones." };
  }
  const stockRaw = String(formData.get("stock_no") ?? "").trim().toUpperCase();
  const stock_no =
    stockRaw ||
    (useCloudDb() ? await nextStockNoCloud() : nextStockNo());
  const acquired_at = String(formData.get("acquired_at") ?? "").trim();
  const costRaw = String(formData.get("cost") ?? "").trim();
  const priceRaw = String(formData.get("suggested_price") ?? "").trim();
  const cost = costRaw === "" ? NaN : Number(costRaw);
  const suggested_price = priceRaw === "" ? NaN : Number(priceRaw);
  const includes_charger_raw = String(
    formData.get("includes_charger") ?? "",
  ).trim();
  const includes_charger =
    includes_charger_raw === "on"
      ? "Si"
      : CHARGER_OK.has(includes_charger_raw)
        ? includes_charger_raw
        : "";
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const imei = String(formData.get("imei") ?? "").trim() || null;
  const carrier = String(formData.get("carrier") ?? "").trim() || "Liberado";
  const condition_label = String(
    formData.get("condition_label") ?? "",
  ).trim();
  const ram = String(formData.get("ram") ?? "").trim() || null;
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const batteryRaw = String(formData.get("battery_pct") ?? "").trim();
  let battery_pct: number | null = null;
  if (batteryRaw !== "") {
    const n = Number(batteryRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, error: "% de batería debe ser entre 0 y 100." };
    }
    battery_pct = n;
  }
  const comments = String(formData.get("comments") ?? "").trim() || null;

  if (!acquired_at) {
    return { ok: false, error: "La fecha es obligatoria." };
  }
  if (!stock_no) {
    return { ok: false, error: "El No. de stock es obligatorio." };
  }
  if (costRaw === "" || priceRaw === "") {
    return {
      ok: false,
      error: "Costo y Precio inicial sugerido son obligatorios (sin datos).",
    };
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, error: "El costo debe ser un número válido." };
  }
  if (!Number.isFinite(suggested_price) || suggested_price < 0) {
    return {
      ok: false,
      error: "El precio inicial sugerido debe ser un número válido.",
    };
  }
  if (!brand || !model) {
    return { ok: false, error: "Marca y modelo son obligatorios." };
  }
  const margin_suggested = suggested_price - cost;
  if (!includes_charger) {
    return {
      ok: false,
      error: "Incluye cargador: elige Si, No o Se incluira en venta.",
    };
  }
  if (!CONDITION_OK.has(condition_label)) {
    return { ok: false, error: "Condición estética inválida." };
  }

  const compraCredito =
    formData.get("compra_credito") === "on" ||
    formData.get("compra_credito") === "1" ||
    formData.get("compra_credito") === "Si";
  const creditoMontoRaw = String(formData.get("credito_monto") ?? "").trim();
  const creditoOrigen = String(
    formData.get("credito_origen") ?? formData.get("creditor") ?? "",
  ).trim();
  const creditoAt =
    String(formData.get("credito_at") ?? "").trim() || acquired_at;
  const creditoPaidRaw = String(formData.get("credito_paid") ?? "No").trim();
  const creditoPaid = creditoPaidRaw === "Si" ? "Si" : "No";
  const creditoComments =
    String(formData.get("credito_comments") ?? "").trim() || null;
  /** Vincula al stock de esta adquisición (sin campo en el formulario). */
  const creditoStockNo = stock_no;
  let credito_monto: number | null = null;
  if (compraCredito) {
    if (!creditoAt) {
      return {
        ok: false,
        error: "Crédito de adquisición: la Fecha es obligatoria.",
      };
    }
    if (!creditoMontoRaw) {
      return {
        ok: false,
        error: "Crédito de adquisición: la Cantidad es obligatoria.",
      };
    }
    credito_monto = Number(creditoMontoRaw);
    if (!Number.isFinite(credito_monto) || credito_monto <= 0) {
      return {
        ok: false,
        error: "Crédito de adquisición: la Cantidad debe ser un número válido.",
      };
    }
    if (!creditoOrigen) {
      return {
        ok: false,
        error: "Crédito de adquisición: el Acreedor es obligatorio.",
      };
    }
  }

  const photo1_path =
    String(formData.get("photo1_path") ?? "").trim() || null;
  const photo2_path =
    String(formData.get("photo2_path") ?? "").trim() || null;

  if (useCloudDb()) {
    try {
      await cloudMut.acquirePhoneCloud({
        stock_no,
        acquired_at,
        cost,
        suggested_price,
        margin_suggested,
        includes_charger,
        brand,
        model,
        imei,
        carrier,
        condition_label,
        ram,
        storage,
        battery_pct,
        comments,
        compraCredito,
        credito_monto,
        creditoOrigen,
        creditoAt,
        creditoPaid,
        creditoComments,
        photo1_path,
        photo2_path,
      });
      revalidateAll();
      return { ok: true, stock_no };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      if (msg.includes("UNIQUE")) {
        return {
          ok: false,
          error: `Ese No. de stock (${stock_no}) ya existe. Elige otro.`,
        };
      }
      return { ok: false, error: msg };
    }
  }

  try {
    const db = getDb();
    const dup = db
      .prepare(`SELECT id FROM phones WHERE stock_no = ? COLLATE NOCASE`)
      .get(stock_no);
    if (dup) {
      return {
        ok: false,
        error: `Ese No. de stock (${stock_no}) ya existe. Elige otro.`,
      };
    }

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO phones (
          stock_no, acquired_at, cost, suggested_price, margin_suggested, includes_charger,
          brand, model, imei, carrier, condition_label, ram, storage, battery_pct, comments,
          compra_credito, credito_monto, credito_origen, photo1_path, photo2_path, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponible')`,
      ).run(
        stock_no,
        acquired_at,
        cost,
        suggested_price,
        margin_suggested,
        includes_charger,
        brand,
        model,
        imei,
        carrier,
        condition_label,
        ram,
        storage,
        battery_pct,
        comments,
        compraCredito ? 1 : 0,
        compraCredito ? credito_monto : null,
        compraCredito ? creditoOrigen : null,
        photo1_path,
        photo2_path,
      );

      const available = (
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM phones WHERE status = 'disponible'`,
          )
          .get() as { c: number }
      ).c;

      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'adquisicion', ?, ?, ?, ?)`,
      ).run(
        `${acquired_at}T12:00:00`,
        stock_no,
        -cost,
        available,
        `Adquisición ${brand} ${model}${compraCredito ? ` (crédito · ${creditoOrigen})` : ""}`,
      );

      if (compraCredito && credito_monto != null && creditoOrigen) {
        const note =
          creditoComments || `Crédito de adquisición · ${creditoStockNo}`;
        db.prepare(
          `INSERT INTO supplier_credits (at, amount, creditor, paid, comments, stock_no)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          creditoAt,
          credito_monto,
          creditoOrigen,
          creditoPaid,
          note,
          creditoStockNo,
        );
        db.prepare(
          `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
           VALUES (?, 'credito_adquisicion', ?, ?, NULL, ?)`,
        ).run(
          `${creditoAt}T12:00:00`,
          creditoStockNo,
          -credito_monto,
          `Crédito adquisición — ${creditoOrigen}${creditoPaid === "Si" ? " (ya pagado)" : ""}`,
        );
        if (creditoPaid === "Si") {
          db.prepare(
            `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
             VALUES (?, 'pago_acreedor', ?, ?, NULL, ?)`,
          ).run(
            `${creditoAt}T12:00:00`,
            creditoStockNo,
            credito_monto,
            `Pago a acreedor ${creditoOrigen}`,
          );
        }
      }
    });
    tx();
    revalidateAll();
    return { ok: true, stock_no };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar";
    if (msg.includes("UNIQUE")) {
      return {
        ok: false,
        error: `Ese No. de stock (${stock_no}) ya existe. Elige otro.`,
      };
    }
    return { ok: false, error: msg };
  }
}

/** Alta / reposición de accesorio (código Excel AMB/LP — no MBC##). */
export async function acquireAccessory(
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Debes iniciar sesión.",
    };
  }
  if (!canAcquire(session.role)) {
    return { ok: false, error: "Solo Admin puede registrar adquisiciones." };
  }

  const stockRaw = String(formData.get("stock_no") ?? formData.get("codigo") ?? "")
    .trim()
    .toUpperCase();
  const catalog_code =
    String(formData.get("catalog_code") ?? "").trim() || null;
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const acquired_at = String(formData.get("acquired_at") ?? "").trim();
  const qtyRaw = String(formData.get("qty") ?? "").trim();
  const costRaw = String(formData.get("cost_unit") ?? "").trim();
  const priceRaw = String(formData.get("precio_sugerido") ?? "").trim();
  const maxRaw = String(formData.get("precio_maximo") ?? "").trim();
  const comments = String(formData.get("comments") ?? "").trim() || null;
  const qty = Number(qtyRaw);
  const cost_unit = costRaw === "" ? null : Number(costRaw);
  const precio_sugerido = priceRaw === "" ? null : Number(priceRaw);
  const precio_maximo = maxRaw === "" ? null : Number(maxRaw);

  if (/^MBC\d+/i.test(stockRaw)) {
    return {
      ok: false,
      error: "Ese código parece de celular (MBC##). Elige tipo Celular.",
    };
  }
  let stock_no: string;
  let catalog = catalog_code;
  if (!stockRaw) {
    stock_no = useCloudDb() ? await nextAccStockNoCloud() : nextAccStockNo();
  } else if (/^ACC\d+$/i.test(stockRaw)) {
    stock_no = stockRaw.toUpperCase();
  } else {
    // Código AMB/LP pegado como stock → ACC### nuevo + catálogo
    catalog = catalog || stockRaw;
    stock_no = useCloudDb() ? await nextAccStockNoCloud() : nextAccStockNo();
  }

  if (!descripcion) {
    return { ok: false, error: "La descripción es obligatoria." };
  }
  if (!acquired_at) {
    return { ok: false, error: "La fecha es obligatoria." };
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: "La cantidad debe ser un número mayor a 0." };
  }
  if (cost_unit != null && (!Number.isFinite(cost_unit) || cost_unit < 0)) {
    return { ok: false, error: "Costo unitario inválido." };
  }
  if (
    precio_sugerido != null &&
    (!Number.isFinite(precio_sugerido) || precio_sugerido < 0)
  ) {
    return { ok: false, error: "Precio sugerido inválido." };
  }
  if (
    precio_maximo != null &&
    (!Number.isFinite(precio_maximo) || precio_maximo < 0)
  ) {
    return { ok: false, error: "Precio máximo inválido." };
  }

  const compraCredito =
    formData.get("compra_credito") === "on" ||
    formData.get("compra_credito") === "1" ||
    formData.get("compra_credito") === "Si";
  const creditoMontoRaw = String(formData.get("credito_monto") ?? "").trim();
  const creditoOrigen = String(
    formData.get("credito_origen") ?? formData.get("creditor") ?? "",
  ).trim();
  const creditoAt =
    String(formData.get("credito_at") ?? "").trim() || acquired_at;
  const creditoPaid =
    String(formData.get("credito_paid") ?? "No").trim() === "Si" ? "Si" : "No";
  const creditoComments =
    String(formData.get("credito_comments") ?? "").trim() || null;
  let credito_monto: number | null = null;
  if (compraCredito) {
    if (!creditoAt) {
      return {
        ok: false,
        error: "Crédito de adquisición: la Fecha es obligatoria.",
      };
    }
    if (!creditoMontoRaw) {
      return {
        ok: false,
        error: "Crédito de adquisición: la Cantidad es obligatoria.",
      };
    }
    credito_monto = Number(creditoMontoRaw);
    if (!Number.isFinite(credito_monto) || credito_monto <= 0) {
      return {
        ok: false,
        error: "Crédito de adquisición: la Cantidad debe ser un número válido.",
      };
    }
    if (!creditoOrigen) {
      return {
        ok: false,
        error: "Crédito de adquisición: el Acreedor es obligatorio.",
      };
    }
  }

  if (useCloudDb()) {
    try {
      await cloudMut.acquireAccessoryCloud({
        stock_no,
        catalog_code: catalog,
        codigo: stock_no,
        descripcion,
        qty,
        cost_unit,
        precio_sugerido,
        precio_maximo,
        comments,
      });
      if (compraCredito && credito_monto != null && creditoOrigen) {
        await cloudMut.registerSupplierCreditCloud({
          at: creditoAt,
          amount: credito_monto,
          creditor: creditoOrigen,
          paid: creditoPaid,
          comments:
            creditoComments || `Crédito de adquisición · ${stock_no}`,
          stock_no,
        });
      }
      revalidateAll();
      return { ok: true, stock_no };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar",
      };
    }
  }

  try {
    const db = getDb();
    const existing = db
      .prepare(
        `SELECT * FROM accessories
         WHERE stock_no = ? COLLATE NOCASE
            OR codigo = ? COLLATE NOCASE
            OR (? IS NOT NULL AND catalog_code = ? COLLATE NOCASE)`,
      )
      .get(stock_no, stock_no, catalog, catalog) as
      | {
          id: number;
          stock_no: string | null;
          codigo: string;
          qty: number;
        }
      | undefined;

    // Si matcheó por catálogo AMB, reponer ese ACC; si es alta nueva y stock libre
    const resolvedStock = (
      existing
        ? (existing.stock_no || existing.codigo || stock_no).toUpperCase()
        : stock_no
    );

    const spend =
      cost_unit != null && Number.isFinite(cost_unit) ? cost_unit * qty : 0;

    const tx = db.transaction(() => {
      if (existing) {
        db.prepare(
          `UPDATE accessories SET
             descripcion = ?,
             qty = qty + ?,
             cost_unit = COALESCE(?, cost_unit),
             precio_sugerido = COALESCE(?, precio_sugerido),
             precio_maximo = COALESCE(?, precio_maximo),
             catalog_code = COALESCE(?, catalog_code),
             comments = COALESCE(?, comments),
             updated_at = datetime('now')
           WHERE id = ?`,
        ).run(
          descripcion,
          qty,
          cost_unit,
          precio_sugerido,
          precio_maximo,
          catalog,
          comments,
          existing.id,
        );
      } else {
        db.prepare(
          `INSERT INTO accessories (
             codigo, stock_no, catalog_code, descripcion, qty,
             cost_unit, precio_sugerido, precio_maximo, comments
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          resolvedStock,
          resolvedStock,
          catalog,
          descripcion,
          qty,
          cost_unit,
          precio_sugerido,
          precio_maximo,
          comments,
        );
      }

      // available_after = stock de celulares (KPI phone-only); no mezclar qty accesorios
      const phonesDisponibles = (
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM phones WHERE status = 'disponible'`,
          )
          .get() as { c: number }
      ).c;

      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'adquisicion_accesorio', ?, ?, ?, ?)`,
      ).run(
        `${acquired_at}T12:00:00`,
        resolvedStock,
        -spend,
        phonesDisponibles,
        `Accesorio ${resolvedStock}${catalog ? ` · ${catalog}` : ""} · +${qty} · ${descripcion}`,
      );

      if (compraCredito && credito_monto != null && creditoOrigen) {
        const note =
          creditoComments ||
          `Crédito de adquisición · accesorio ${resolvedStock}`;
        /** Vincula al stock de esta adquisición (sin campo en el formulario). */
        const linkStock = resolvedStock;
        db.prepare(
          `INSERT INTO supplier_credits (at, amount, creditor, paid, comments, stock_no)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          creditoAt,
          credito_monto,
          creditoOrigen,
          creditoPaid,
          note,
          linkStock,
        );
        db.prepare(
          `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
           VALUES (?, 'credito_adquisicion', ?, ?, NULL, ?)`,
        ).run(
          `${creditoAt}T12:00:00`,
          linkStock,
          -credito_monto,
          `Crédito adquisición accesorio — ${creditoOrigen}${creditoPaid === "Si" ? " (ya pagado)" : ""}`,
        );
        if (creditoPaid === "Si") {
          db.prepare(
            `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
             VALUES (?, 'pago_acreedor', ?, ?, NULL, ?)`,
          ).run(
            `${creditoAt}T12:00:00`,
            linkStock,
            credito_monto,
            `Pago a acreedor ${creditoOrigen}`,
          );
        }
      }
    });
    tx();
    revalidateAll();
    return { ok: true, stock_no: resolvedStock };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar";
    return { ok: false, error: msg };
  }
}

export async function registerSale(formData: FormData): Promise<ActionResult> {
  const denied = await requireAdminResult();
  if (denied) return denied;
  const phone_id = Number(formData.get("phone_id"));
  const sold_at = String(formData.get("sold_at") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const sale_type = String(formData.get("sale_type") ?? "Contado").trim();
  const customer = String(formData.get("customer") ?? "").trim();
  const extra_costs = Number(formData.get("extra_costs") ?? 0) || 0;
  const comments = String(formData.get("comments") ?? "").trim() || null;

  // Credit block (Form)
  const debtor_name =
    String(formData.get("debtor_name") ?? "").trim() || customer;
  const debtor_phone = String(formData.get("debtor_phone") ?? "").trim() || null;
  const payment_freq =
    String(formData.get("payment_freq") ?? "").trim() || null;
  const plazoRaw = String(formData.get("plazo_dias") ?? "").trim();
  const plazo_dias =
    plazoRaw === "" ? null : Number(plazoRaw);
  const credit_type =
    String(formData.get("credit_type") ?? "").trim() ||
    payment_freq ||
    "Crédito";
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const liquidado = String(formData.get("liquidado") ?? "No").trim();
  const pago1Raw = formData.get("pago1");
  const pago1 =
    pago1Raw === null || String(pago1Raw).trim() === ""
      ? null
      : Number(pago1Raw);
  const pago2_status = String(formData.get("pago2_status") ?? "No").trim();
  const pago3_status = String(formData.get("pago3_status") ?? "No").trim();
  const PAY_FREQ = new Set(["Semanal", "Quincenal", "Mensual"]);

  if (!SALE_TYPE.has(sale_type)) {
    return { ok: false, error: "Tipo de venta: Contado o Credito." };
  }
  if (!phone_id || !sold_at || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Equipo, fecha y monto de venta son obligatorios.",
    };
  }
  if (!customer) {
    return { ok: false, error: "Cliente es obligatorio." };
  }

  const isCredit = sale_type === "Credito";
  if (isCredit) {
    if (!debtor_name) {
      return { ok: false, error: "Cliente (crédito) es obligatorio." };
    }
    if (!debtor_phone) {
      return { ok: false, error: "Número teléfono es obligatorio en Crédito." };
    }
    if (
      plazo_dias == null ||
      !Number.isFinite(plazo_dias) ||
      plazo_dias <= 0
    ) {
      return { ok: false, error: "Plazo en días es obligatorio." };
    }
    if (!payment_freq || !PAY_FREQ.has(payment_freq)) {
      return {
        ok: false,
        error: "Tipo de pago: Semanal, Quincenal o Mensual.",
      };
    }
    if (!due_date) {
      return { ok: false, error: "Fecha límite de pago es obligatoria." };
    }
    if (!STATUS3.has(liquidado)) {
      return { ok: false, error: "Liquidado: Si, No o Retrasado." };
    }
    if (!STATUS3.has(pago2_status) || !STATUS3.has(pago3_status)) {
      return { ok: false, error: "Pago 2 / Pago 3: Si, No o Retrasado." };
    }
    if (pago1 != null && (!Number.isFinite(pago1) || pago1 < 0)) {
      return { ok: false, error: "Pago 1 debe ser un monto válido." };
    }
  }

  if (useCloudDb()) {
    try {
      await cloudMut.registerSaleCloud({
        phone_id,
        sold_at,
        amount,
        customer,
        sale_type,
        extra_costs,
        comments,
        isCredit,
        debtor_name,
        debtor_phone,
        credit_type,
        plazo_dias,
        payment_freq,
        due_date,
        liquidado,
        pago1,
        pago2_status,
        pago3_status,
      });
      revalidateAll();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "PHONE_NOT_FOUND")
        return { ok: false, error: "Equipo no encontrado." };
      if (msg === "ALREADY_SOLD")
        return { ok: false, error: "Ese No. de stock ya está vendido." };
      return {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo registrar la venta.",
      };
    }
  }

  const db = getDb();
  const phone = db
    .prepare(`SELECT * FROM phones WHERE id = ?`)
    .get(phone_id) as
    | {
        id: number;
        stock_no: string;
        status: string;
        brand: string;
        model: string;
        cost: number;
      }
    | undefined;

  if (!phone) return { ok: false, error: "Equipo no encontrado." };
  if (phone.status !== "disponible") {
    return { ok: false, error: "Ese No. de stock ya está vendido." };
  }

  const margin = amount - phone.cost - (extra_costs || 0);

  try {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE phones SET status = 'vendido' WHERE id = ?`).run(
        phone_id,
      );

      const sale = db
        .prepare(
          `INSERT INTO sales (phone_id, sold_at, amount, customer, channel, extra_costs, margin, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
        )
        .get(
          phone_id,
          sold_at,
          amount,
          customer,
          sale_type,
          extra_costs,
          margin,
          comments,
        ) as { id: number };

      const available = (
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM phones WHERE status = 'disponible'`,
          )
          .get() as { c: number }
      ).c;

      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'venta', ?, ?, ?, ?)`,
      ).run(
        `${sold_at}T12:00:00`,
        phone.stock_no,
        amount,
        available,
        `Venta ${sale_type} — ${customer}`,
      );

      if (isCredit) {
        const initialPaid =
          pago1 && pago1 > 0 ? Math.min(pago1, amount) : 0;
        let balance = amount - initialPaid;
        let liq = liquidado;
        if (balance <= 0) {
          balance = 0;
          liq = "Si";
        }

        const credit = db
          .prepare(
            `INSERT INTO credit_accounts (
              sale_id, debtor_name, debtor_phone, credit_type, plazo_dias, payment_freq,
              principal, paid_total, balance, pago1, pago2_status, pago3_status,
              due_date, liquidado, comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
          )
          .get(
            sale.id,
            debtor_name,
            debtor_phone,
            credit_type,
            plazo_dias,
            payment_freq,
            amount,
            initialPaid,
            balance,
            pago1,
            pago2_status,
            pago3_status,
            due_date,
            liq,
            comments,
          ) as { id: number };

        if (initialPaid > 0) {
          db.prepare(
            `INSERT INTO collections (credit_id, amount, paid_at, note)
             VALUES (?, ?, ?, ?)`,
          ).run(credit.id, initialPaid, `${sold_at}T12:00:00`, "Pago 1");
          db.prepare(
            `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
             VALUES (?, 'cobranza', ?, ?, NULL, ?)`,
          ).run(
            `${sold_at}T12:00:00`,
            phone.stock_no,
            initialPaid,
            `Cobranza ${debtor_name}`,
          );
        }
      }
    });
    tx();
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo registrar la venta.",
    };
  }
}

export async function recordCollection(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await requireAdminResult();
  if (denied) return denied;
  const credit_id = Number(formData.get("credit_id"));
  const amount = Number(formData.get("amount"));
  const paid_at =
    String(formData.get("paid_at") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const note = String(formData.get("note") ?? "").trim() || null;
  const set_liquidado = String(formData.get("set_liquidado") ?? "").trim();

  if (!credit_id || !Number.isFinite(credit_id) || credit_id <= 0) {
    return { ok: false, error: "Selecciona una cuenta / acreedor." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "La cantidad / pagado es obligatoria." };
  }

  if (useCloudDb()) {
    try {
      const info = await cloudMut.recordCollectionCloud({
        credit_id,
        amount,
        paid_at,
        note,
        set_liquidado,
        status3: STATUS3,
      });
      revalidateAll();
      const amtLabel = `$${Math.round(amount).toLocaleString("es-MX")}`;
      return {
        ok: true,
        message: info.done
          ? `Cobranza registrada: ${amtLabel} · ${info.debtor_name} · ${info.stock_no} (liquidado).`
          : `Cobranza registrada: ${amtLabel} · ${info.debtor_name} · ${info.stock_no}.`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND")
        return { ok: false, error: "Cuenta no encontrada." };
      if (msg === "ALREADY_PAID")
        return { ok: false, error: "Este crédito ya está liquidado (Si)." };
      if (msg === "OVERPAY")
        return {
          ok: false,
          error: "El monto supera lo que falta liquidar.",
        };
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "No se pudo registrar la cobranza. Intenta de nuevo.",
      };
    }
  }

  const db = getDb();
  try {
    const account = db
      .prepare(
        `SELECT ca.*, p.stock_no
         FROM credit_accounts ca
         JOIN sales s ON s.id = ca.sale_id
         JOIN phones p ON p.id = s.phone_id
         WHERE ca.id = ?`,
      )
      .get(credit_id) as
      | {
          id: number;
          balance: number;
          paid_total: number;
          liquidado: string;
          stock_no: string;
          debtor_name: string;
        }
      | undefined;

    if (!account) return { ok: false, error: "Cuenta no encontrada." };
    if (account.liquidado === "Si") {
      return { ok: false, error: "Este crédito ya está liquidado (Si)." };
    }
    if (amount > account.balance + 0.01) {
      return {
        ok: false,
        error: `El monto ($${Math.round(amount).toLocaleString("es-MX")}) supera lo que falta liquidar ($${Math.round(account.balance).toLocaleString("es-MX")}).`,
      };
    }

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO collections (credit_id, amount, paid_at, note)
         VALUES (?, ?, ?, ?)`,
      ).run(credit_id, amount, `${paid_at}T12:00:00`, note);

      const paid_total = account.paid_total + amount;
      const balance = Math.max(0, account.balance - amount);
      let liquidado = account.liquidado;
      if (balance <= 0) liquidado = "Si";
      else if (STATUS3.has(set_liquidado)) liquidado = set_liquidado;
      else if (liquidado === "Retrasado" && balance > 0) {
        /* keep Retrasado until cleared */
      } else {
        liquidado = "No";
      }

      db.prepare(
        `UPDATE credit_accounts
         SET paid_total = ?, balance = ?, liquidado = ?
         WHERE id = ?`,
      ).run(paid_total, balance, liquidado, credit_id);

      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'cobranza', ?, ?, NULL, ?)`,
      ).run(
        `${paid_at}T12:00:00`,
        account.stock_no,
        amount,
        `Cobranza ${account.debtor_name}`,
      );
    });
    tx();
    revalidateAll();
    const amtLabel = `$${Math.round(amount).toLocaleString("es-MX")}`;
    const done = account.balance - amount <= 0;
    return {
      ok: true,
      message: done
        ? `Cobranza registrada: ${amtLabel} · ${account.debtor_name} · ${account.stock_no} (liquidado).`
        : `Cobranza registrada: ${amtLabel} · ${account.debtor_name} · ${account.stock_no}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "No se pudo registrar la cobranza. Intenta de nuevo.",
    };
  }
}

/** Recalcula paid_total / balance / liquidado desde la suma de cobranzas. */
function syncCreditFromCollections(
  db: ReturnType<typeof getDb>,
  credit_id: number,
) {
  const account = db
    .prepare(
      `SELECT id, principal, liquidado FROM credit_accounts WHERE id = ?`,
    )
    .get(credit_id) as
    | { id: number; principal: number; liquidado: string }
    | undefined;
  if (!account) return null;

  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS paid_total
       FROM collections WHERE credit_id = ?`,
    )
    .get(credit_id) as { paid_total: number };

  const paid_total = Number(row.paid_total) || 0;
  const balance = Math.max(0, account.principal - paid_total);
  let liquidado = account.liquidado;
  if (balance <= 0) liquidado = "Si";
  else if (liquidado === "Si") liquidado = "No";

  db.prepare(
    `UPDATE credit_accounts
     SET paid_total = ?, balance = ?, liquidado = ?
     WHERE id = ?`,
  ).run(paid_total, balance, liquidado, credit_id);

  return { paid_total, balance, liquidado };
}

function matchLedgerCobranza(
  db: ReturnType<typeof getDb>,
  stock_no: string,
  amount: number,
  debtor_name: string,
) {
  return db
    .prepare(
      `SELECT id FROM ledger
       WHERE kind = 'cobranza' AND stock_no = ? AND amount = ? AND note = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(stock_no, amount, `Cobranza ${debtor_name}`) as
    | { id: number }
    | undefined;
}

export async function updateCollection(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await requireAdminResult();
  if (denied) return denied;

  const id = Number(formData.get("id"));
  const amount = Number(formData.get("amount"));
  if (!id || !Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Cobranza no válida." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "La cantidad debe ser mayor a 0." };
  }

  if (useCloudDb()) {
    try {
      const col = await cloudMut.updateCollectionCloud({ id, amount });
      revalidateAll();
      return {
        ok: true,
        message: `Cobranza actualizada: $${Math.round(amount).toLocaleString("es-MX")} · ${col.debtor_name} · ${col.stock_no}.`,
      };
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_FOUND")
        return { ok: false, error: "Cobranza no encontrada." };
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  }

  const db = getDb();
  try {
    const col = db
      .prepare(
        `SELECT col.*, ca.debtor_name, ca.principal, ca.balance, ca.paid_total,
                p.stock_no
         FROM collections col
         JOIN credit_accounts ca ON ca.id = col.credit_id
         JOIN sales s ON s.id = ca.sale_id
         JOIN phones p ON p.id = s.phone_id
         WHERE col.id = ?`,
      )
      .get(id) as
      | {
          id: number;
          credit_id: number;
          amount: number;
          debtor_name: string;
          principal: number;
          stock_no: string;
        }
      | undefined;

    if (!col) return { ok: false, error: "Cobranza no encontrada." };

    const others = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM collections WHERE credit_id = ? AND id != ?`,
      )
      .get(col.credit_id, id) as { total: number };
    const othersTotal = Number(others.total) || 0;
    if (othersTotal + amount > col.principal + 0.01) {
      return {
        ok: false,
        error: `El monto supera el principal (máx. $${Math.round(col.principal - othersTotal).toLocaleString("es-MX")}).`,
      };
    }

    const tx = db.transaction(() => {
      const oldAmount = col.amount;
      db.prepare(`UPDATE collections SET amount = ? WHERE id = ?`).run(
        amount,
        id,
      );
      syncCreditFromCollections(db, col.credit_id);
      const ledger = matchLedgerCobranza(
        db,
        col.stock_no,
        oldAmount,
        col.debtor_name,
      );
      if (ledger) {
        db.prepare(`UPDATE ledger SET amount = ? WHERE id = ?`).run(
          amount,
          ledger.id,
        );
      }
    });
    tx();
    revalidateAll();
    return {
      ok: true,
      message: `Cobranza actualizada: $${Math.round(amount).toLocaleString("es-MX")} · ${col.debtor_name} · ${col.stock_no}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "No se pudo actualizar la cobranza.",
    };
  }
}

export async function deleteCollection(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await requireAdminResult();
  if (denied) return denied;

  const id = Number(formData.get("id"));
  if (!id || !Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Cobranza no válida." };
  }

  if (useCloudDb()) {
    try {
      const col = await cloudMut.deleteCollectionCloud(id);
      revalidateAll();
      return {
        ok: true,
        message: `Cobranza eliminada: $${Math.round(col.amount).toLocaleString("es-MX")} · ${col.debtor_name} · ${col.stock_no}.`,
      };
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_FOUND")
        return { ok: false, error: "Cobranza no encontrada." };
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  }

  const db = getDb();
  try {
    const col = db
      .prepare(
        `SELECT col.*, ca.debtor_name, p.stock_no
         FROM collections col
         JOIN credit_accounts ca ON ca.id = col.credit_id
         JOIN sales s ON s.id = ca.sale_id
         JOIN phones p ON p.id = s.phone_id
         WHERE col.id = ?`,
      )
      .get(id) as
      | {
          id: number;
          credit_id: number;
          amount: number;
          debtor_name: string;
          stock_no: string;
        }
      | undefined;

    if (!col) return { ok: false, error: "Cobranza no encontrada." };

    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM collections WHERE id = ?`).run(id);
      syncCreditFromCollections(db, col.credit_id);
      const ledger = matchLedgerCobranza(
        db,
        col.stock_no,
        col.amount,
        col.debtor_name,
      );
      if (ledger) {
        db.prepare(`DELETE FROM ledger WHERE id = ?`).run(ledger.id);
      }
    });
    tx();
    revalidateAll();
    return {
      ok: true,
      message: `Cobranza eliminada: $${Math.round(col.amount).toLocaleString("es-MX")} · ${col.debtor_name} · ${col.stock_no}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "No se pudo borrar la cobranza.",
    };
  }
}

const INVENTORY_STOCK_RE = /^(MBC\d+|ACC\d+)$/;
const STOCK_NOT_FOUND =
  "No. Stock no encontrado. Elige un celular (MBC) o un accesorio (ACC) del inventario.";

function resolveLocalInventoryStock(
  db: ReturnType<typeof getDb>,
  raw: string,
): string | null {
  const code = raw.trim().toUpperCase();
  if (!INVENTORY_STOCK_RE.test(code)) return null;
  const phone = db
    .prepare(`SELECT stock_no FROM phones WHERE UPPER(stock_no) = ?`)
    .get(code) as { stock_no: string } | undefined;
  if (phone?.stock_no) return phone.stock_no;
  const acc = db
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(stock_no), ''), codigo) AS stock_no
       FROM accessories
       WHERE UPPER(COALESCE(NULLIF(TRIM(stock_no), ''), codigo)) = ?
          OR UPPER(codigo) = ?
       LIMIT 1`,
    )
    .get(code, code) as { stock_no: string } | undefined;
  const found = acc?.stock_no?.trim().toUpperCase();
  if (found && INVENTORY_STOCK_RE.test(found)) return found;
  return null;
}

export async function registerSupplierCredit(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageSupplierCredit(session.role)) {
    return {
      ok: false,
      error: "Solo Admin puede registrar crédito de adquisición.",
    };
  }
  const at = String(formData.get("at") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const creditor = String(formData.get("creditor") ?? "").trim();
  const paidRaw = String(formData.get("paid") ?? "No").trim();
  const paid = paidRaw || "No";
  const comments = String(formData.get("comments") ?? "").trim() || null;
  const stockRaw = String(formData.get("stock_no") ?? "").trim();

  if (!at || !creditor || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Fecha, cantidad y acreedor son obligatorios.",
    };
  }
  if (paid !== "Si" && paid !== "No") {
    return { ok: false, error: "Pagado: Si o No." };
  }
  if (!stockRaw) {
    return { ok: false, error: "No. Stock es obligatorio." };
  }

  if (useCloudDb()) {
    try {
      await cloudMut.registerSupplierCreditCloud({
        at,
        amount,
        creditor,
        paid,
        comments,
        stock_no: stockRaw,
      });
      revalidateAll();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  }

  const db = getDb();
  const stock_no = resolveLocalInventoryStock(db, stockRaw);
  if (!stock_no) {
    return { ok: false, error: STOCK_NOT_FOUND };
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO supplier_credits (at, amount, creditor, paid, comments, stock_no)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(at, amount, creditor, paid, comments, stock_no);

    db.prepare(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES (?, 'credito_adquisicion', ?, ?, NULL, ?)`,
    ).run(
      `${at}T12:00:00`,
      stock_no,
      -amount,
      `Crédito adquisición — ${creditor}${paid === "Si" ? " (ya pagado)" : ""}`,
    );

    if (paid === "Si") {
      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'pago_acreedor', ?, ?, NULL, ?)`,
      ).run(
        `${at}T12:00:00`,
        stock_no,
        amount,
        `Pago a acreedor ${creditor}`,
      );
    }
  });
  tx();
  revalidateAll();
  return { ok: true };
}

export async function markSupplierPaid(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageSupplierCredit(session.role)) {
    return { ok: false, error: "Solo Admin puede marcar pagos a acreedores." };
  }
  const id = Number(formData.get("id"));
  const paid_at =
    String(formData.get("paid_at") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);

  if (!id) return { ok: false, error: "Cuenta inválida." };

  if (useCloudDb()) {
    try {
      await cloudMut.markSupplierPaidCloud(id, paid_at);
      revalidateAll();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return { ok: false, error: "No encontrado." };
      if (msg === "ALREADY_PAID")
        return { ok: false, error: "Ya está marcado como pagado." };
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  }

  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM supplier_credits WHERE id = ?`)
    .get(id) as
    | {
        id: number;
        amount: number;
        creditor: string;
        paid: string;
        stock_no: string | null;
      }
    | undefined;

  if (!row) return { ok: false, error: "No encontrado." };
  if (row.paid === "Si") {
    return { ok: false, error: "Ya está marcado como pagado." };
  }

  const tx = db.transaction(() => {
    db.prepare(`UPDATE supplier_credits SET paid = 'Si' WHERE id = ?`).run(id);
    db.prepare(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES (?, 'pago_acreedor', ?, ?, NULL, ?)`,
    ).run(
      `${paid_at}T12:00:00`,
      row.stock_no,
      row.amount,
      `Pago a acreedor ${row.creditor}`,
    );
  });
  tx();
  revalidateAll();
  return { ok: true };
}

export async function setSupplierPaid(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageSupplierCredit(session.role)) {
    return { ok: false, error: "Solo Admin puede marcar pagos a acreedores." };
  }
  const id = Number(formData.get("id"));
  const paid = String(formData.get("paid") ?? "").trim();
  const paid_at =
    String(formData.get("paid_at") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);

  if (!id) return { ok: false, error: "Cuenta inválida." };
  if (paid !== "Si" && paid !== "No") {
    return { ok: false, error: "Pagado: Si o No." };
  }

  const message =
    paid === "Si" ? "Marcado como pagado." : "Marcado como no pagado.";

  if (useCloudDb()) {
    try {
      await cloudMut.setSupplierPaidCloud(id, paid, paid_at);
      revalidateAll();
      return { ok: true, message };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return { ok: false, error: "No encontrado." };
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  }

  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM supplier_credits WHERE id = ?`)
    .get(id) as
    | {
        id: number;
        amount: number;
        creditor: string;
        paid: string;
        stock_no: string | null;
      }
    | undefined;

  if (!row) return { ok: false, error: "No encontrado." };
  if (row.paid === paid) {
    revalidateAll();
    return { ok: true, message };
  }

  const note = `Pago a acreedor ${row.creditor}`;
  const tx = db.transaction(() => {
    db.prepare(`UPDATE supplier_credits SET paid = ? WHERE id = ?`).run(
      paid,
      id,
    );
    if (paid === "Si") {
      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'pago_acreedor', ?, ?, NULL, ?)`,
      ).run(`${paid_at}T12:00:00`, row.stock_no, row.amount, note);
      return;
    }
    db.prepare(
      `DELETE FROM ledger WHERE id = (
         SELECT id FROM ledger
         WHERE kind = 'pago_acreedor'
           AND amount = ?
           AND note = ?
           AND COALESCE(stock_no, '') = COALESCE(?, '')
         ORDER BY id DESC
         LIMIT 1
       )`,
    ).run(row.amount, note, row.stock_no);
  });
  tx();
  revalidateAll();
  return { ok: true, message };
}

export async function updatePhone(
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Debes iniciar sesión.",
    };
  }
  if (!canAcquire(session.role)) {
    return { ok: false, error: "Solo Admin puede editar inventario." };
  }

  const id = Number(formData.get("id"));
  if (!id || !Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Equipo no válido." };
  }

  const stock_no = String(formData.get("stock_no") ?? "")
    .trim()
    .toUpperCase();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const cost = Number(formData.get("cost"));
  const suggested_price = Number(formData.get("suggested_price"));
  const statusRaw = String(formData.get("status") ?? "").trim();
  const status = statusRaw === "vendido" ? "vendido" : "disponible";
  const carrier = String(formData.get("carrier") ?? "").trim() || "Liberado";
  const condition_label =
    String(formData.get("condition_label") ?? "").trim() ||
    "A Bueno (9-10)";
  const ram = String(formData.get("ram") ?? "").trim() || null;
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const batRaw = String(formData.get("battery_pct") ?? "").trim();
  const battery_pct = batRaw === "" ? null : Number(batRaw);
  const includes_charger =
    String(formData.get("includes_charger") ?? "").trim() || "No";
  const comments = String(formData.get("comments") ?? "").trim() || null;
  const imei = String(formData.get("imei") ?? "").trim() || null;

  if (!stock_no) {
    return { ok: false, error: "El No. de stock es obligatorio." };
  }
  if (!brand || !model) {
    return { ok: false, error: "Marca y modelo son obligatorios." };
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, error: "Costo inválido." };
  }
  if (!Number.isFinite(suggested_price) || suggested_price < 0) {
    return { ok: false, error: "Precio inválido." };
  }
  if (!CHARGER_OK.has(includes_charger)) {
    return { ok: false, error: "Incluye cargador: valor no válido." };
  }
  if (!CONDITION_OK.has(condition_label)) {
    return { ok: false, error: "Condición estética no válida." };
  }
  if (
    battery_pct != null &&
    (!Number.isFinite(battery_pct) || battery_pct < 0 || battery_pct > 100)
  ) {
    return { ok: false, error: "% batería debe ser 0–100." };
  }

  const margin_suggested = suggested_price - cost;

  if (useCloudDb()) {
    try {
      await cloudMut.updatePhoneCloud({
        id,
        stock_no,
        brand,
        model,
        cost,
        suggested_price,
        margin_suggested,
        status,
        carrier,
        condition_label,
        ram,
        storage,
        battery_pct,
        includes_charger,
        comments,
        imei,
      });
      revalidateAll();
      return {
        ok: true,
        stock_no,
        message: `Equipo ${stock_no} actualizado.`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND")
        return { ok: false, error: "Equipo no encontrado." };
      if (msg.startsWith("UNIQUE:"))
        return {
          ok: false,
          error: `Ese No. de stock (${stock_no}) ya existe. Elige otro.`,
        };
      return {
        ok: false,
        error:
          e instanceof Error ? e.message : "No se pudo actualizar el equipo.",
      };
    }
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT id, stock_no FROM phones WHERE id = ?`)
    .get(id) as { id: number; stock_no: string } | undefined;
  if (!existing) return { ok: false, error: "Equipo no encontrado." };

  const dup = db
    .prepare(
      `SELECT id FROM phones WHERE stock_no = ? COLLATE NOCASE AND id != ?`,
    )
    .get(stock_no, id);
  if (dup) {
    return {
      ok: false,
      error: `Ese No. de stock (${stock_no}) ya existe. Elige otro.`,
    };
  }

  try {
    db.prepare(
      `UPDATE phones SET
         stock_no = ?, brand = ?, model = ?, cost = ?, suggested_price = ?,
         margin_suggested = ?, status = ?, carrier = ?, condition_label = ?,
         ram = ?, storage = ?, battery_pct = ?, includes_charger = ?,
         comments = ?, imei = ?
       WHERE id = ?`,
    ).run(
      stock_no,
      brand,
      model,
      cost,
      suggested_price,
      margin_suggested,
      status,
      carrier,
      condition_label,
      ram,
      storage,
      battery_pct,
      includes_charger,
      comments,
      imei,
      id,
    );
    revalidateAll();
    return {
      ok: true,
      stock_no,
      message: `Equipo ${stock_no} actualizado.`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "No se pudo actualizar el equipo.",
    };
  }
}

export async function updateAccessory(
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Debes iniciar sesión.",
    };
  }
  if (!canAcquire(session.role)) {
    return { ok: false, error: "Solo Admin puede editar inventario." };
  }

  const id = Number(formData.get("id"));
  if (!id || !Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Accesorio no válido." };
  }

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const qty = Number(formData.get("qty"));
  const costRaw = String(formData.get("cost_unit") ?? "").trim();
  const sugRaw = String(formData.get("precio_sugerido") ?? "").trim();
  const maxRaw = String(formData.get("precio_maximo") ?? "").trim();
  const cost_unit = costRaw === "" ? null : Number(costRaw);
  const precio_sugerido = sugRaw === "" ? null : Number(sugRaw);
  const precio_maximo = maxRaw === "" ? null : Number(maxRaw);

  if (!descripcion) {
    return { ok: false, error: "La descripción es obligatoria." };
  }
  if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
    return { ok: false, error: "Stock (cantidad) inválido." };
  }
  if (cost_unit != null && (!Number.isFinite(cost_unit) || cost_unit < 0)) {
    return { ok: false, error: "Costo inválido." };
  }
  if (
    precio_sugerido != null &&
    (!Number.isFinite(precio_sugerido) || precio_sugerido < 0)
  ) {
    return { ok: false, error: "$ Sugerido inválido." };
  }
  if (
    precio_maximo != null &&
    (!Number.isFinite(precio_maximo) || precio_maximo < 0)
  ) {
    return { ok: false, error: "$ Máximo inválido." };
  }

  if (useCloudDb()) {
    try {
      const code = await cloudMut.updateAccessoryCloud({
        id,
        descripcion,
        qty,
        cost_unit,
        precio_sugerido,
        precio_maximo,
      });
      revalidateAll();
      return {
        ok: true,
        stock_no: code,
        message: `Accesorio ${code} actualizado.`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND")
        return { ok: false, error: "Accesorio no encontrado." };
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "No se pudo actualizar el accesorio.",
      };
    }
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT id, stock_no, codigo FROM accessories WHERE id = ?`)
    .get(id) as
    | { id: number; stock_no: string | null; codigo: string }
    | undefined;
  if (!existing) return { ok: false, error: "Accesorio no encontrado." };

  try {
    db.prepare(
      `UPDATE accessories SET
         descripcion = ?, qty = ?, cost_unit = ?,
         precio_sugerido = ?, precio_maximo = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      descripcion,
      qty,
      cost_unit,
      precio_sugerido,
      precio_maximo,
      id,
    );
    revalidateAll();
    const code = existing.stock_no || existing.codigo;
    return {
      ok: true,
      stock_no: code,
      message: `Accesorio ${code} actualizado.`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el accesorio.",
    };
  }
}
