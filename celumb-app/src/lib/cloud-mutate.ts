/**
 * Postgres write path for CeluMB (Supabase pooler).
 * Used when useCloudDb() is true. Mirrors SQLite transactions in actions.ts.
 */
import type { PoolClient } from "pg";
import { q1, withTx } from "./pg";

const INVENTORY_STOCK_RE = /^(MBC\d+|ACC\d+)$/;
const STOCK_NOT_FOUND =
  "No. Stock no encontrado. Elige un celular (MBC) o un accesorio (ACC) del inventario.";

/** Canonical MBC## / ACC### that already exists in phones or accessories. */
async function resolveInventoryStockNo(
  c: PoolClient,
  raw: string,
): Promise<string> {
  const code = raw.trim().toUpperCase();
  if (!INVENTORY_STOCK_RE.test(code)) throw new Error(STOCK_NOT_FOUND);
  const phone = await c.query<{ stock_no: string }>(
    `SELECT stock_no FROM phones WHERE lower(stock_no) = lower($1) LIMIT 1`,
    [code],
  );
  if (phone.rows[0]?.stock_no) return phone.rows[0].stock_no;
  const acc = await c.query<{ stock_no: string }>(
    `SELECT COALESCE(NULLIF(btrim(stock_no), ''), codigo) AS stock_no
     FROM accessories
     WHERE lower(COALESCE(NULLIF(btrim(stock_no), ''), codigo)) = lower($1)
        OR lower(codigo) = lower($1)
     LIMIT 1`,
    [code],
  );
  const found = String(acc.rows[0]?.stock_no ?? "")
    .trim()
    .toUpperCase();
  if (found && INVENTORY_STOCK_RE.test(found)) return found;
  throw new Error(STOCK_NOT_FOUND);
}

export async function acquirePhoneCloud(p: {
  stock_no: string;
  acquired_at: string;
  cost: number;
  suggested_price: number;
  margin_suggested: number;
  includes_charger: string;
  brand: string;
  model: string;
  imei: string | null;
  carrier: string;
  condition_label: string;
  ram: string | null;
  storage: string | null;
  battery_pct: number | null;
  comments: string | null;
  compraCredito: boolean;
  credito_monto: number | null;
  creditoOrigen: string;
  creditoAt: string;
  creditoPaid: string;
  creditoComments: string | null;
  photo1_path: string | null;
  photo2_path: string | null;
}) {
  const dup = await q1<{ id: number }>(
    `SELECT id FROM phones WHERE lower(stock_no) = lower($1)`,
    [p.stock_no],
  );
  if (dup) throw new Error(`UNIQUE:${p.stock_no}`);

  await withTx(async (c) => {
    await c.query(
      `INSERT INTO phones (
        stock_no, acquired_at, cost, suggested_price, margin_suggested, includes_charger,
        brand, model, imei, carrier, condition_label, ram, storage, battery_pct, comments,
        compra_credito, credito_monto, credito_origen, photo1_path, photo2_path, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'disponible')`,
      [
        p.stock_no,
        p.acquired_at,
        p.cost,
        p.suggested_price,
        p.margin_suggested,
        p.includes_charger,
        p.brand,
        p.model,
        p.imei,
        p.carrier,
        p.condition_label,
        p.ram,
        p.storage,
        p.battery_pct,
        p.comments,
        p.compraCredito ? 1 : 0,
        p.compraCredito ? p.credito_monto : null,
        p.compraCredito ? p.creditoOrigen : null,
        p.photo1_path,
        p.photo2_path,
      ],
    );
    const avail = await c.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM phones WHERE status = 'disponible'`,
    );
    const available = Number(avail.rows[0]?.c || 0);
    await c.query(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES ($1,'adquisicion',$2,$3,$4,$5)`,
      [
        `${p.acquired_at}T12:00:00`,
        p.stock_no,
        -p.cost,
        available,
        `Adquisición ${p.brand} ${p.model}${p.compraCredito ? ` (crédito · ${p.creditoOrigen})` : ""}`,
      ],
    );
    if (p.compraCredito && p.credito_monto != null && p.creditoOrigen) {
      const note =
        p.creditoComments || `Crédito de adquisición · ${p.stock_no}`;
      await c.query(
        `INSERT INTO supplier_credits (at, amount, creditor, paid, comments, stock_no)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          p.creditoAt,
          p.credito_monto,
          p.creditoOrigen,
          p.creditoPaid,
          note,
          p.stock_no,
        ],
      );
      await c.query(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES ($1,'credito_adquisicion',$2,$3,NULL,$4)`,
        [
          `${p.creditoAt}T12:00:00`,
          p.stock_no,
          -p.credito_monto,
          `Crédito adquisición — ${p.creditoOrigen}${p.creditoPaid === "Si" ? " (ya pagado)" : ""}`,
        ],
      );
      if (p.creditoPaid === "Si") {
        await c.query(
          `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
           VALUES ($1,'pago_acreedor',$2,$3,NULL,$4)`,
          [
            `${p.creditoAt}T12:00:00`,
            p.stock_no,
            p.credito_monto,
            `Pago a acreedor ${p.creditoOrigen}`,
          ],
        );
      }
    }
  });
}

export async function updatePhoneCloud(p: {
  id: number;
  stock_no: string;
  brand: string;
  model: string;
  cost: number;
  suggested_price: number;
  margin_suggested: number;
  status: string;
  carrier: string;
  condition_label: string;
  ram: string | null;
  storage: string | null;
  battery_pct: number | null;
  includes_charger: string;
  comments: string | null;
  imei: string | null;
  /** http(s) link, or null to clear the slot. */
  photo1_path?: string | null;
  photo2_path?: string | null;
}) {
  const existing = await q1<{ id: number }>(
    `SELECT id FROM phones WHERE id = $1`,
    [p.id],
  );
  if (!existing) throw new Error("NOT_FOUND");
  const dup = await q1<{ id: number }>(
    `SELECT id FROM phones WHERE lower(stock_no) = lower($1) AND id != $2`,
    [p.stock_no, p.id],
  );
  if (dup) throw new Error(`UNIQUE:${p.stock_no}`);
  await withTx(async (c) => {
    await c.query(
      `UPDATE phones SET
         stock_no=$1, brand=$2, model=$3, cost=$4, suggested_price=$5,
         margin_suggested=$6, status=$7, carrier=$8, condition_label=$9,
         ram=$10, storage=$11, battery_pct=$12, includes_charger=$13,
         comments=$14, imei=$15,
         photo1_path=$16,
         photo2_path=$17
       WHERE id=$18`,
      [
        p.stock_no,
        p.brand,
        p.model,
        p.cost,
        p.suggested_price,
        p.margin_suggested,
        p.status,
        p.carrier,
        p.condition_label,
        p.ram,
        p.storage,
        p.battery_pct,
        p.includes_charger,
        p.comments,
        p.imei,
        p.photo1_path?.trim() || null,
        p.photo2_path?.trim() || null,
        p.id,
      ],
    );
  });
}

/** Replace one photo slot. Clears the previous path in the same transaction, then stores the new one. */
export async function updatePhonePhotoCloud(p: {
  id: number;
  slot: 1 | 2;
  path: string;
}): Promise<{ previous: string | null }> {
  const col = p.slot === 2 ? "photo2_path" : "photo1_path";
  return withTx(async (c) => {
    const existing = await c.query<{ photo_path: string | null }>(
      `SELECT ${col} AS photo_path FROM phones WHERE id = $1`,
      [p.id],
    );
    if (!existing.rows[0]) throw new Error("NOT_FOUND");
    const previous = existing.rows[0].photo_path?.trim() || null;
    await c.query(`UPDATE phones SET ${col} = NULL WHERE id = $1`, [p.id]);
    await c.query(`UPDATE phones SET ${col} = $1 WHERE id = $2`, [
      p.path,
      p.id,
    ]);
    return { previous };
  });
}

export async function updateAccessoryCloud(p: {
  id: number;
  descripcion: string;
  qty: number;
  cost_unit: number | null;
  precio_sugerido: number | null;
  precio_maximo: number | null;
}) {
  const existing = await q1<{ id: number; stock_no: string; codigo: string }>(
    `SELECT id, stock_no, codigo FROM accessories WHERE id = $1`,
    [p.id],
  );
  if (!existing) throw new Error("NOT_FOUND");
  await withTx(async (c) => {
    await c.query(
      `UPDATE accessories SET
         descripcion=$1, qty=$2, cost_unit=$3,
         precio_sugerido=$4, precio_maximo=$5, updated_at=NOW()
       WHERE id=$6`,
      [
        p.descripcion,
        p.qty,
        p.cost_unit,
        p.precio_sugerido,
        p.precio_maximo,
        p.id,
      ],
    );
  });
  return existing.stock_no || existing.codigo;
}

export async function acquireAccessoryCloud(p: {
  stock_no: string;
  catalog_code: string | null;
  codigo: string;
  descripcion: string;
  qty: number;
  cost_unit: number | null;
  precio_sugerido: number | null;
  precio_maximo: number | null;
  comments: string | null;
}) {
  await withTx(async (c) => {
    const existing = await c.query(
      `SELECT id, qty FROM accessories WHERE stock_no = $1 OR codigo = $1`,
      [p.stock_no],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0] as { id: number; qty: number };
      await c.query(
        `UPDATE accessories SET qty = qty + $1, updated_at = NOW(),
           cost_unit = COALESCE($2, cost_unit),
           precio_sugerido = COALESCE($3, precio_sugerido),
           precio_maximo = COALESCE($4, precio_maximo)
         WHERE id = $5`,
        [p.qty, p.cost_unit, p.precio_sugerido, p.precio_maximo, row.id],
      );
    } else {
      await c.query(
        `INSERT INTO accessories (
          stock_no, catalog_code, codigo, descripcion, qty,
          cost_unit, precio_sugerido, precio_maximo, comments
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          p.stock_no,
          p.catalog_code,
          p.codigo,
          p.descripcion,
          p.qty,
          p.cost_unit,
          p.precio_sugerido,
          p.precio_maximo,
          p.comments,
        ],
      );
    }
    await c.query(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES ($1,'adquisicion_accesorio',$2,$3,NULL,$4)`,
      [
        new Date().toISOString().slice(0, 19),
        p.stock_no,
        -(p.cost_unit || 0) * p.qty,
        `Adquisición accesorio ${p.descripcion}`,
      ],
    );
  });
}

export async function registerSaleCloud(p: {
  phone_id: number;
  sold_at: string;
  amount: number;
  customer: string;
  sale_type: string;
  extra_costs: number;
  comments: string | null;
  isCredit: boolean;
  debtor_name: string;
  debtor_phone: string | null;
  credit_type: string;
  plazo_dias: number | null;
  payment_freq: string | null;
  due_date: string | null;
  liquidado: string;
  pago1: number | null;
  pago2_status: string;
  pago3_status: string;
}) {
  await withTx(async (c) => {
    const phoneRes = await c.query(
      `SELECT id, stock_no, status, brand, model, cost FROM phones WHERE id = $1`,
      [p.phone_id],
    );
    const phone = phoneRes.rows[0] as
      | {
          id: number;
          stock_no: string;
          status: string;
          brand: string;
          model: string;
          cost: number;
        }
      | undefined;
    if (!phone) throw new Error("PHONE_NOT_FOUND");
    if (phone.status !== "disponible") throw new Error("ALREADY_SOLD");
    const margin = p.amount - Number(phone.cost) - (p.extra_costs || 0);
    await c.query(`UPDATE phones SET status = 'vendido' WHERE id = $1`, [
      p.phone_id,
    ]);
    const saleRes = await c.query<{ id: number }>(
      `INSERT INTO sales (phone_id, sold_at, amount, customer, channel, extra_costs, margin, comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        p.phone_id,
        p.sold_at,
        p.amount,
        p.customer,
        p.sale_type,
        p.extra_costs,
        margin,
        p.comments,
      ],
    );
    const saleId = saleRes.rows[0].id;
    const avail = await c.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM phones WHERE status = 'disponible'`,
    );
    await c.query(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES ($1,'venta',$2,$3,$4,$5)`,
      [
        `${p.sold_at}T12:00:00`,
        phone.stock_no,
        p.amount,
        Number(avail.rows[0]?.c || 0),
        `Venta ${p.sale_type} — ${p.customer}`,
      ],
    );
    if (p.isCredit) {
      const initialPaid =
        p.pago1 && p.pago1 > 0 ? Math.min(p.pago1, p.amount) : 0;
      let balance = p.amount - initialPaid;
      let liq = p.liquidado;
      if (balance <= 0) {
        balance = 0;
        liq = "Si";
      }
      const creditRes = await c.query<{ id: number }>(
        `INSERT INTO credit_accounts (
          sale_id, debtor_name, debtor_phone, credit_type, plazo_dias, payment_freq,
          principal, paid_total, balance, pago1, pago2_status, pago3_status,
          due_date, liquidado, comments
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          saleId,
          p.debtor_name,
          p.debtor_phone,
          p.credit_type,
          p.plazo_dias,
          p.payment_freq,
          p.amount,
          initialPaid,
          balance,
          p.pago1,
          p.pago2_status,
          p.pago3_status,
          p.due_date,
          liq,
          p.comments,
        ],
      );
      if (initialPaid > 0) {
        await c.query(
          `INSERT INTO collections (credit_id, amount, paid_at, note)
           VALUES ($1,$2,$3,$4)`,
          [creditRes.rows[0].id, initialPaid, `${p.sold_at}T12:00:00`, "Pago 1"],
        );
        await c.query(
          `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
           VALUES ($1,'cobranza',$2,$3,NULL,$4)`,
          [
            `${p.sold_at}T12:00:00`,
            phone.stock_no,
            initialPaid,
            `Cobranza ${p.debtor_name}`,
          ],
        );
      }
    }
  });
}

export async function recordCollectionCloud(p: {
  credit_id: number;
  amount: number;
  paid_at: string;
  note: string | null;
  set_liquidado: string;
  status3: Set<string>;
}) {
  return withTx(async (c) => {
    const res = await c.query(
      `SELECT ca.*, p.stock_no
       FROM credit_accounts ca
       JOIN sales s ON s.id = ca.sale_id
       JOIN phones p ON p.id = s.phone_id
       WHERE ca.id = $1`,
      [p.credit_id],
    );
    const account = res.rows[0] as
      | {
          id: number;
          balance: number;
          paid_total: number;
          liquidado: string;
          stock_no: string;
          debtor_name: string;
        }
      | undefined;
    if (!account) throw new Error("NOT_FOUND");
    if (account.liquidado === "Si") throw new Error("ALREADY_PAID");
    if (p.amount > Number(account.balance) + 0.01) throw new Error("OVERPAY");

    await c.query(
      `INSERT INTO collections (credit_id, amount, paid_at, note)
       VALUES ($1,$2,$3,$4)`,
      [p.credit_id, p.amount, `${p.paid_at}T12:00:00`, p.note],
    );
    const paid_total = Number(account.paid_total) + p.amount;
    const balance = Math.max(0, Number(account.balance) - p.amount);
    let liquidado = account.liquidado;
    if (balance <= 0) liquidado = "Si";
    else if (p.status3.has(p.set_liquidado)) liquidado = p.set_liquidado;
    else if (liquidado === "Retrasado" && balance > 0) {
      /* keep */
    } else liquidado = "No";

    await c.query(
      `UPDATE credit_accounts SET paid_total=$1, balance=$2, liquidado=$3 WHERE id=$4`,
      [paid_total, balance, liquidado, p.credit_id],
    );
    await c.query(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES ($1,'cobranza',$2,$3,NULL,$4)`,
      [
        `${p.paid_at}T12:00:00`,
        account.stock_no,
        p.amount,
        `Cobranza ${account.debtor_name}`,
      ],
    );
    return {
      debtor_name: account.debtor_name,
      stock_no: account.stock_no,
      done: balance <= 0,
    };
  });
}

export async function markSupplierPaidCloud(id: number, paid_at: string) {
  await withTx(async (c) => {
    const res = await c.query(
      `SELECT * FROM supplier_credits WHERE id = $1`,
      [id],
    );
    const row = res.rows[0] as
      | { paid: string; amount: number; creditor: string; stock_no: string | null }
      | undefined;
    if (!row) throw new Error("NOT_FOUND");
    if (row.paid === "Si") throw new Error("ALREADY_PAID");
    await c.query(`UPDATE supplier_credits SET paid = 'Si' WHERE id = $1`, [id]);
    await c.query(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES ($1,'pago_acreedor',$2,$3,NULL,$4)`,
      [
        `${paid_at}T12:00:00`,
        row.stock_no,
        row.amount,
        `Pago a acreedor ${row.creditor}`,
      ],
    );
  });
}

export async function registerSupplierCreditCloud(p: {
  at: string;
  amount: number;
  creditor: string;
  paid: string;
  comments: string | null;
  stock_no: string;
}) {
  const raw = String(p.stock_no ?? "").trim();
  if (!raw) throw new Error("No. Stock es obligatorio.");
  await withTx(async (c) => {
    const stock_no = await resolveInventoryStockNo(c, raw);
    await c.query(
      `INSERT INTO supplier_credits (at, amount, creditor, paid, comments, stock_no)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.at, p.amount, p.creditor, p.paid, p.comments, stock_no],
    );
    await c.query(
      `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
       VALUES ($1,'credito_adquisicion',$2,$3,NULL,$4)`,
      [
        `${p.at}T12:00:00`,
        stock_no,
        -p.amount,
        `Crédito adquisición — ${p.creditor}${p.paid === "Si" ? " (ya pagado)" : ""}`,
      ],
    );
    if (p.paid === "Si") {
      await c.query(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES ($1,'pago_acreedor',$2,$3,NULL,$4)`,
        [
          `${p.at}T12:00:00`,
          stock_no,
          p.amount,
          `Pago a acreedor ${p.creditor}`,
        ],
      );
    }
  });
}

export async function setSupplierPaidCloud(
  id: number,
  paid: "Si" | "No",
  paid_at: string,
) {
  await withTx(async (c) => {
    const res = await c.query(
      `SELECT paid, amount, creditor, stock_no FROM supplier_credits WHERE id = $1`,
      [id],
    );
    const row = res.rows[0] as
      | {
          paid: string;
          amount: number;
          creditor: string;
          stock_no: string | null;
        }
      | undefined;
    if (!row) throw new Error("NOT_FOUND");
    if (row.paid === paid) return;
    await c.query(`UPDATE supplier_credits SET paid = $1 WHERE id = $2`, [
      paid,
      id,
    ]);
    const note = `Pago a acreedor ${row.creditor}`;
    if (paid === "Si") {
      await c.query(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES ($1,'pago_acreedor',$2,$3,NULL,$4)`,
        [`${paid_at}T12:00:00`, row.stock_no, Number(row.amount), note],
      );
      return;
    }
    await c.query(
      `DELETE FROM ledger WHERE id = (
         SELECT id FROM ledger
         WHERE kind = 'pago_acreedor'
           AND amount = $1
           AND note = $2
           AND COALESCE(stock_no, '') = COALESCE($3, '')
         ORDER BY id DESC
         LIMIT 1
       )`,
      [Number(row.amount), note, row.stock_no],
    );
  });
}


export async function updateCollectionCloud(p: {
  id: number;
  amount: number;
}) {
  return withTx(async (c) => {
    const res = await c.query(
      `SELECT col.*, ca.debtor_name, ca.principal, p.stock_no
       FROM collections col
       JOIN credit_accounts ca ON ca.id = col.credit_id
       JOIN sales s ON s.id = ca.sale_id
       JOIN phones p ON p.id = s.phone_id
       WHERE col.id = $1`,
      [p.id],
    );
    const col = res.rows[0] as
      | {
          id: number;
          credit_id: number;
          amount: number;
          debtor_name: string;
          stock_no: string;
          principal: number;
        }
      | undefined;
    if (!col) throw new Error("NOT_FOUND");
    const oldAmount = Number(col.amount);
    await c.query(`UPDATE collections SET amount = $1 WHERE id = $2`, [
      p.amount,
      p.id,
    ]);
    // sync credit
    const sum = await c.query<{ paid_total: string }>(
      `SELECT COALESCE(SUM(amount),0)::text AS paid_total FROM collections WHERE credit_id=$1`,
      [col.credit_id],
    );
    const paid_total = Number(sum.rows[0]?.paid_total || 0);
    const balance = Math.max(0, Number(col.principal) - paid_total);
    const liquidado = balance <= 0 ? "Si" : "No";
    await c.query(
      `UPDATE credit_accounts SET paid_total=$1, balance=$2, liquidado=$3 WHERE id=$4`,
      [paid_total, balance, liquidado, col.credit_id],
    );
    // best-effort ledger amount update
    await c.query(
      `UPDATE ledger SET amount = $1
       WHERE id = (
         SELECT id FROM ledger
         WHERE kind='cobranza' AND stock_no=$2 AND amount=$3 AND note=$4
         ORDER BY id DESC LIMIT 1
       )`,
      [p.amount, col.stock_no, oldAmount, `Cobranza ${col.debtor_name}`],
    );
    return col;
  });
}

export async function deleteCollectionCloud(id: number) {
  return withTx(async (c) => {
    const res = await c.query(
      `SELECT col.*, ca.debtor_name, ca.principal, p.stock_no
       FROM collections col
       JOIN credit_accounts ca ON ca.id = col.credit_id
       JOIN sales s ON s.id = ca.sale_id
       JOIN phones p ON p.id = s.phone_id
       WHERE col.id = $1`,
      [id],
    );
    const col = res.rows[0] as
      | {
          id: number;
          credit_id: number;
          amount: number;
          debtor_name: string;
          stock_no: string;
          principal: number;
        }
      | undefined;
    if (!col) throw new Error("NOT_FOUND");
    await c.query(`DELETE FROM collections WHERE id = $1`, [id]);
    const sum = await c.query<{ paid_total: string }>(
      `SELECT COALESCE(SUM(amount),0)::text AS paid_total FROM collections WHERE credit_id=$1`,
      [col.credit_id],
    );
    const paid_total = Number(sum.rows[0]?.paid_total || 0);
    const balance = Math.max(0, Number(col.principal) - paid_total);
    const liquidado = balance <= 0 ? "Si" : "No";
    await c.query(
      `UPDATE credit_accounts SET paid_total=$1, balance=$2, liquidado=$3 WHERE id=$4`,
      [paid_total, balance, liquidado, col.credit_id],
    );
    await c.query(
      `DELETE FROM ledger WHERE id = (
         SELECT id FROM ledger
         WHERE kind='cobranza' AND stock_no=$1 AND amount=$2 AND note=$3
         ORDER BY id DESC LIMIT 1
       )`,
      [col.stock_no, col.amount, `Cobranza ${col.debtor_name}`],
    );
    return col;
  });
}
