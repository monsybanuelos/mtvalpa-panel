import type { PoolClient } from "pg";
import { q, q1, withTx } from "./pg";
import type {
  Accessory,
  Collection,
  CreditAccount,
  LedgerEntry,
  Phone,
  Sale,
  SupplierCredit,
} from "./db";

function daysBetweenLocal(from: string, to: string): number {
  const a = new Date(from.includes("T") ? from : `${from}T12:00:00`);
  const b = new Date(to.includes("T") ? to : `${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export async function getDashboardStats() {
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const available = Number(
    (await q1<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM phones WHERE status = 'disponible'`,
    ))?.c || 0,
  );
  const sold = Number(
    (await q1<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM phones WHERE status = 'vendido'`,
    ))?.c || 0,
  );
  const stockCost = Number(
    (await q1<{ t: string }>(
      `SELECT COALESCE(SUM(cost), 0)::text AS t FROM phones WHERE status = 'disponible'`,
    ))?.t || 0,
  );
  const salesTotal = Number(
    (await q1<{ t: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS t FROM sales`,
    ))?.t || 0,
  );
  const utilidad = Number(
    (
      await q1<{ t: string }>(
        `SELECT COALESCE(SUM(COALESCE(s.margin, s.amount - p.cost - s.extra_costs)), 0)::text AS t
         FROM sales s JOIN phones p ON p.id = s.phone_id`,
      )
    )?.t || 0,
  );
  const salesMonth = Number(
    (
      await q1<{ t: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS t FROM sales
         WHERE substr(sold_at, 1, 7) = $1`,
        [monthPrefix],
      )
    )?.t || 0,
  );
  const utilidadMonth = Number(
    (
      await q1<{ t: string }>(
        `SELECT COALESCE(SUM(COALESCE(s.margin, s.amount - p.cost - s.extra_costs)), 0)::text AS t
         FROM sales s JOIN phones p ON p.id = s.phone_id
         WHERE substr(s.sold_at, 1, 7) = $1`,
        [monthPrefix],
      )
    )?.t || 0,
  );
  const marginPct =
    salesTotal > 0 ? Math.round((utilidad / salesTotal) * 1000) / 10 : null;
  const creditOpen = Number(
    (
      await q1<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM credit_accounts WHERE liquidado != 'Si'`,
      )
    )?.c || 0,
  );
  const receivable = Number(
    (
      await q1<{ t: string }>(
        `SELECT COALESCE(SUM(balance), 0)::text AS t FROM credit_accounts WHERE liquidado != 'Si'`,
      )
    )?.t || 0,
  );

  return {
    available,
    sold,
    stockCost,
    salesTotal,
    salesMonth,
    utilidad,
    utilidadMonth,
    marginPct,
    creditOpen,
    receivable,
    monthPrefix,
  };
}

export async function listPhones(
  filter?: "disponible" | "vendido" | "all",
): Promise<Phone[]> {
  if (!filter || filter === "all") {
    return (await q<Phone>(
      `SELECT * FROM phones ORDER BY stock_no`,
    )) as Phone[];
  }
  return (await q<Phone>(
    `SELECT * FROM phones WHERE status = $1 ORDER BY stock_no`,
    [filter],
  )) as Phone[];
}

export async function getPhone(id: number): Promise<Phone | undefined> {
  return q1<Phone>(`SELECT * FROM phones WHERE id = $1`, [id]);
}

export async function listAvailablePhones(): Promise<Phone[]> {
  return listPhones("disponible");
}

export async function listSales(): Promise<
  (Sale & {
    utilidad: number;
    margen: number;
    days_in_stock: number;
    stock_no: string;
    brand: string;
    model: string;
    cost: number;
    acquired_at: string;
  })[]
> {
  const rows = await q<
    Sale & {
      stock_no: string;
      brand: string;
      model: string;
      cost: number;
      acquired_at: string;
    }
  >(
    `SELECT s.*, p.stock_no, p.brand, p.model, p.cost, p.acquired_at
     FROM sales s JOIN phones p ON p.id = s.phone_id
     ORDER BY s.sold_at DESC`,
  );
  return rows.map((r) => {
    const margen =
      r.margin != null && Number.isFinite(Number(r.margin))
        ? Number(r.margin)
        : Number(r.amount) - Number(r.cost) - (Number(r.extra_costs) || 0);
    return {
      ...r,
      amount: Number(r.amount),
      cost: Number(r.cost),
      extra_costs: Number(r.extra_costs) || 0,
      margin: r.margin == null ? null : Number(r.margin),
      utilidad: margen,
      margen,
      days_in_stock: daysBetweenLocal(r.acquired_at, r.sold_at),
    };
  });
}

export async function incomeByChannel() {
  return q<{ channel: string; n: string; total: string }>(
    `SELECT channel, COUNT(*)::text AS n, SUM(amount)::text AS total
     FROM sales GROUP BY channel ORDER BY SUM(amount) DESC`,
  ).then((rows) =>
    rows.map((r) => ({
      channel: r.channel,
      n: Number(r.n),
      total: Number(r.total),
    })),
  );
}

export async function listCreditAccounts(): Promise<CreditAccount[]> {
  return q<CreditAccount>(
    `SELECT ca.*, p.stock_no, p.brand, p.model, s.sold_at
     FROM credit_accounts ca
     JOIN sales s ON s.id = ca.sale_id
     JOIN phones p ON p.id = s.phone_id
     ORDER BY CASE ca.liquidado WHEN 'Si' THEN 2 WHEN 'Retrasado' THEN 0 ELSE 1 END,
              CASE WHEN ca.due_date IS NULL THEN 1 ELSE 0 END, ca.due_date ASC`,
  );
}

export async function listCollections(limit = 40): Promise<Collection[]> {
  return q<Collection>(
    `SELECT col.*, ca.debtor_name, p.stock_no
     FROM collections col
     JOIN credit_accounts ca ON ca.id = col.credit_id
     JOIN sales s ON s.id = ca.sale_id
     JOIN phones p ON p.id = s.phone_id
     ORDER BY col.paid_at DESC
     LIMIT $1`,
    [limit],
  );
}

export async function listLedger(limit = 40): Promise<LedgerEntry[]> {
  return q<LedgerEntry>(
    `SELECT * FROM ledger ORDER BY at DESC, id DESC LIMIT $1`,
    [limit],
  );
}

export async function listSupplierCredits(): Promise<SupplierCredit[]> {
  return q<SupplierCredit>(
    `SELECT * FROM supplier_credits
     ORDER BY CASE paid WHEN 'No' THEN 0 ELSE 1 END, at DESC`,
  );
}

export async function nextStockNo(): Promise<string> {
  const row = await q1<{ stock_no: string }>(
    `SELECT stock_no FROM phones
     WHERE stock_no ~ '^MBC[0-9]+'
     ORDER BY CAST(substr(stock_no, 4) AS INTEGER) DESC
     LIMIT 1`,
  );
  if (!row) return "MBC01";
  const n = Number(row.stock_no.replace(/\D/g, "")) + 1;
  return `MBC${String(n).padStart(2, "0")}`;
}

export async function listAccessories(): Promise<Accessory[]> {
  const rows = await q<Accessory>(
    `SELECT * FROM accessories ORDER BY stock_no`,
  );
  return rows.map((r) => ({
    ...r,
    qty: Number(r.qty),
    cost_unit: r.cost_unit == null ? null : Number(r.cost_unit),
    precio_sugerido:
      r.precio_sugerido == null ? null : Number(r.precio_sugerido),
    precio_maximo: r.precio_maximo == null ? null : Number(r.precio_maximo),
  }));
}

export async function nextAccStockNo(): Promise<string> {
  const row = await q1<{ stock_no: string }>(
    `SELECT stock_no FROM accessories
     WHERE stock_no ~ '^ACC[0-9]+'
     ORDER BY CAST(substr(stock_no, 4) AS INTEGER) DESC
     LIMIT 1`,
  );
  if (!row) return "ACC001";
  const n = Number(row.stock_no.replace(/\D/g, "")) + 1;
  return `ACC${String(n).padStart(3, "0")}`;
}

export { withTx };
export type { PoolClient };
