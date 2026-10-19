import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "celumb.db");

/** Unit inventory — one row per phone (No. Stock MBC##), per MB Celulares sheet. */
export type Phone = {
  id: number;
  stock_no: string;
  acquired_at: string;
  cost: number;
  suggested_price: number;
  /** Precio sugerido − costo (persistido al alta) */
  margin_suggested: number | null;
  /** Google Form: Si | No | Se incluira en venta */
  includes_charger: string;
  brand: string;
  model: string;
  imei: string | null;
  carrier: string; // Compañia: Liberado, Telcel, u otra
  condition_label: string; // Condicion estetica (labels del Form)
  ram: string | null;
  storage: string | null;
  /** % de batería (0–100); optional on older rows */
  battery_pct: number | null;
  comments: string | null;
  /** Compra a crédito (casilla en adquisición) */
  compra_credito: number;
  /** Monto adeudado al acreedor (si compra_credito) */
  credito_monto: number | null;
  /** Origen / acreedor del crédito de adquisición */
  credito_origen: string | null;
  /** Rutas relativas de fotos (data/phone-photos/…) */
  photo1_path: string | null;
  photo2_path: string | null;
  status: "disponible" | "vendido";
  created_at: string;
};

export type Sale = {
  id: number;
  phone_id: number;
  sold_at: string;
  amount: number;
  customer: string;
  channel: string; // Tipo de venta: Facebook, Presencial, Crédito…
  extra_costs: number;
  /** monto − costo − extras (margen real) */
  margin: number | null;
  comments: string | null;
  stock_no?: string;
  brand?: string;
  model?: string;
  cost?: number;
};

export type CreditAccount = {
  id: number;
  sale_id: number;
  debtor_name: string;
  debtor_phone: string | null;
  credit_type: string;
  /** Plazo en días (venta a crédito) */
  plazo_dias: number | null;
  /** Semanal | Quincenal | Mensual */
  payment_freq: string | null;
  principal: number;
  paid_total: number;
  balance: number;
  /** Pago 1 = monto (Form) */
  pago1: number | null;
  /** Pago 2/3 = Si | No | Retrasado (Form) */
  pago2_status: string;
  pago3_status: string;
  due_date: string | null;
  /** Si | No | Retrasado */
  liquidado: string;
  comments: string | null;
  created_at: string;
  stock_no?: string;
  brand?: string;
  model?: string;
  sold_at?: string;
};

export type SupplierCredit = {
  id: number;
  at: string;
  amount: number;
  creditor: string;
  paid: "Si" | "No";
  comments: string | null;
  stock_no: string | null;
  created_at: string;
};

export type Collection = {
  id: number;
  credit_id: number;
  amount: number;
  paid_at: string;
  note: string | null;
  debtor_name?: string;
  stock_no?: string;
};

export type Accessory = {
  id: number;
  /** Identificador de stock visible: ACC001, ACC002… */
  stock_no: string;
  /** Código de catálogo interno (AMB/LP, ej. B V8 USB) */
  catalog_code: string | null;
  /** Alias legacy = stock_no (ACC###) */
  codigo: string;
  descripcion: string;
  qty: number;
  cost_unit: number | null;
  precio_sugerido: number | null;
  precio_maximo: number | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  id: number;
  at: string;
  kind:
    | "adquisicion"
    | "adquisicion_accesorio"
    | "venta"
    | "cobranza"
    | "credito_adquisicion"
    | "pago_acreedor";
  stock_no: string | null;
  amount: number;
  available_after: number | null;
  note: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __celumbDb: Database.Database | undefined;
}

function createSchema(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS phones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_no TEXT NOT NULL UNIQUE,
      acquired_at TEXT NOT NULL,
      cost REAL NOT NULL,
      suggested_price REAL NOT NULL,
      margin_suggested REAL,
      includes_charger TEXT NOT NULL DEFAULT 'No',
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      imei TEXT,
      carrier TEXT NOT NULL DEFAULT 'Liberado',
      condition_label TEXT NOT NULL DEFAULT 'A Bueno (9-10)',
      ram TEXT,
      storage TEXT,
      battery_pct REAL,
      comments TEXT,
      status TEXT NOT NULL DEFAULT 'disponible'
        CHECK(status IN ('disponible', 'vendido')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_id INTEGER NOT NULL UNIQUE REFERENCES phones(id),
      sold_at TEXT NOT NULL,
      amount REAL NOT NULL,
      customer TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'Presencial',
      extra_costs REAL NOT NULL DEFAULT 0,
      margin REAL,
      comments TEXT
    );

    CREATE TABLE IF NOT EXISTS credit_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id),
      debtor_name TEXT NOT NULL,
      debtor_phone TEXT,
      credit_type TEXT NOT NULL DEFAULT 'Crédito',
      principal REAL NOT NULL,
      paid_total REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL,
      pago1 REAL,
      pago2_status TEXT NOT NULL DEFAULT 'No',
      pago3_status TEXT NOT NULL DEFAULT 'No',
      due_date TEXT,
      liquidado TEXT NOT NULL DEFAULT 'No',
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_id INTEGER NOT NULL REFERENCES credit_accounts(id),
      amount REAL NOT NULL CHECK(amount > 0),
      paid_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      creditor TEXT NOT NULL,
      paid TEXT NOT NULL DEFAULT 'No' CHECK(paid IN ('Si', 'No')),
      comments TEXT,
      stock_no TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      kind TEXT NOT NULL,
      stock_no TEXT,
      amount REAL NOT NULL,
      available_after INTEGER,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      stock_no TEXT UNIQUE COLLATE NOCASE,
      catalog_code TEXT,
      descripcion TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0 CHECK(qty >= 0),
      cost_unit REAL,
      precio_sugerido REAL,
      precio_maximo REAL,
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  ddl: string,
) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function migrateFormAlignment(db: Database.Database) {
  ensureColumn(db, "phones", "battery_pct", "battery_pct REAL");
  ensureColumn(db, "phones", "margin_suggested", "margin_suggested REAL");
  ensureColumn(db, "phones", "compra_credito", "compra_credito INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "phones", "credito_monto", "credito_monto REAL");
  ensureColumn(db, "phones", "credito_origen", "credito_origen TEXT");
  ensureColumn(db, "phones", "photo1_path", "photo1_path TEXT");
  ensureColumn(db, "phones", "photo2_path", "photo2_path TEXT");
  ensureColumn(db, "sales", "margin", "margin REAL");
  ensureColumn(db, "credit_accounts", "plazo_dias", "plazo_dias INTEGER");
  ensureColumn(db, "credit_accounts", "payment_freq", "payment_freq TEXT");
  // Backfill suggested margin where missing
  db.exec(`
    UPDATE phones
    SET margin_suggested = suggested_price - cost
    WHERE margin_suggested IS NULL
      AND suggested_price IS NOT NULL AND cost IS NOT NULL
  `);
  db.exec(`
    UPDATE sales
    SET margin = amount - (
      SELECT p.cost FROM phones p WHERE p.id = sales.phone_id
    ) - COALESCE(extra_costs, 0)
    WHERE margin IS NULL
  `);
  ensureColumn(db, "credit_accounts", "pago2_status", "pago2_status TEXT DEFAULT 'No'");
  ensureColumn(db, "credit_accounts", "pago3_status", "pago3_status TEXT DEFAULT 'No'");
  ensureColumn(db, "credit_accounts", "liquidado", "liquidado TEXT DEFAULT 'No'");

  // Legacy liquidated → liquidado
  const cols = db.prepare(`PRAGMA table_info(credit_accounts)`).all() as {
    name: string;
  }[];
  if (cols.some((c) => c.name === "liquidated")) {
    db.exec(`
      UPDATE credit_accounts SET liquidado = 'Si'
        WHERE liquidated = 1 AND (liquidado IS NULL OR liquidado = 'No');
      UPDATE credit_accounts SET liquidado = COALESCE(NULLIF(liquidado, ''), 'No')
        WHERE liquidado IS NULL OR liquidado = '';
    `);
  }

  // Legacy numeric pago2/pago3 → status if status still default and amount present
  if (cols.some((c) => c.name === "pago2")) {
    db.exec(`
      UPDATE credit_accounts SET pago2_status = 'Si'
        WHERE pago2 IS NOT NULL AND CAST(pago2 AS REAL) > 0
          AND (pago2_status IS NULL OR pago2_status = 'No');
      UPDATE credit_accounts SET pago3_status = 'Si'
        WHERE pago3 IS NOT NULL AND CAST(pago3 AS REAL) > 0
          AND (pago3_status IS NULL OR pago3_status = 'No');
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      creditor TEXT NOT NULL,
      paid TEXT NOT NULL DEFAULT 'No' CHECK(paid IN ('Si', 'No')),
      comments TEXT,
      stock_no TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      stock_no TEXT UNIQUE COLLATE NOCASE,
      catalog_code TEXT,
      descripcion TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0 CHECK(qty >= 0),
      cost_unit REAL,
      precio_sugerido REAL,
      precio_maximo REAL,
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrateAccessoriesToAcc(db);
}

type AccessorySeed = {
  stock_no?: string;
  catalog_code?: string | null;
  codigo?: string;
  descripcion: string;
  qty: number;
  cost_unit?: number | null;
  precio_sugerido?: number | null;
  precio_maximo?: number | null;
};

/** Migra códigos AMB → ACC001…; catalog_code guarda el código AMB/LP. */
function migrateAccessoriesToAcc(db: Database.Database) {
  ensureColumn(db, "accessories", "stock_no", "stock_no TEXT");
  ensureColumn(db, "accessories", "catalog_code", "catalog_code TEXT");

  const rows = db
    .prepare(`SELECT id, codigo, stock_no, catalog_code FROM accessories ORDER BY id`)
    .all() as {
    id: number;
    codigo: string;
    stock_no: string | null;
    catalog_code: string | null;
  }[];

  let next = 1;
  for (const r of rows) {
    const current = (r.stock_no || r.codigo || "").trim();
    if (/^ACC\d+$/i.test(current)) {
      const n = Number(current.replace(/\D/g, ""));
      if (Number.isFinite(n) && n >= next) next = n + 1;
      if (!r.stock_no || r.stock_no !== current.toUpperCase()) {
        db.prepare(
          `UPDATE accessories SET stock_no = ?, codigo = ? WHERE id = ?`,
        ).run(current.toUpperCase(), current.toUpperCase(), r.id);
      }
      continue;
    }
    const stock = `ACC${String(next).padStart(3, "0")}`;
    next += 1;
    const catalog =
      r.catalog_code?.trim() ||
      (current && !/^ACC\d+$/i.test(current) ? current : null);
    db.prepare(
      `UPDATE accessories
       SET stock_no = ?, codigo = ?, catalog_code = COALESCE(?, catalog_code)
       WHERE id = ?`,
    ).run(stock, stock, catalog, r.id);
  }
}

function seedAccessoriesIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM accessories").get() as {
    c: number;
  };
  if (count.c > 0) {
    migrateAccessoriesToAcc(db);
    return;
  }

  const seedPath = path.join(DATA_DIR, "accessories-seed.json");
  let seeds: AccessorySeed[] = [];
  try {
    const raw = fs.readFileSync(seedPath, "utf8");
    seeds = JSON.parse(raw) as AccessorySeed[];
  } catch {
    return;
  }
  if (!Array.isArray(seeds) || seeds.length === 0) return;

  const insert = db.prepare(
    `INSERT INTO accessories (
      codigo, stock_no, catalog_code, descripcion, qty, cost_unit, precio_sugerido, precio_maximo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    seeds.forEach((s, i) => {
      const stock =
        String(s.stock_no ?? "").trim().toUpperCase() ||
        `ACC${String(i + 1).padStart(3, "0")}`;
      const catalog =
        String(s.catalog_code ?? s.codigo ?? "").trim() || null;
      const desc =
        String(s.descripcion ?? catalog ?? stock).trim() || stock;
      insert.run(
        stock,
        stock,
        catalog && !/^ACC\d+$/i.test(catalog) ? catalog : null,
        desc,
        Math.max(0, Number(s.qty) || 0),
        s.cost_unit != null && Number.isFinite(Number(s.cost_unit))
          ? Number(s.cost_unit)
          : null,
        s.precio_sugerido != null && Number.isFinite(Number(s.precio_sugerido))
          ? Number(s.precio_sugerido)
          : null,
        s.precio_maximo != null && Number.isFinite(Number(s.precio_maximo))
          ? Number(s.precio_maximo)
          : null,
      );
    });
  });
  tx();
  migrateAccessoriesToAcc(db);
}


function seedIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM phones").get() as {
    c: number;
  };
  if (count.c > 0) return;

  type SeedPhone = {
    stock_no: string;
    acquired_at: string;
    cost: number;
    suggested_price: number;
    includes_charger: string;
    brand: string;
    model: string;
    imei: string | null;
    carrier: string;
    condition_label: string;
    ram: string | null;
    storage: string | null;
    comments?: string | null;
    status: "disponible" | "vendido";
    sale?: {
      sold_at: string;
      amount: number;
      customer: string;
      channel: string;
      extra_costs?: number;
      comments?: string | null;
      credit?: {
        debtor_name: string;
        debtor_phone?: string | null;
        credit_type?: string;
        pago1?: number | null;
        pago2_status?: string;
        pago3_status?: string;
        pago2?: number | null;
        pago3?: number | null;
        due_date?: string | null;
        paid_total?: number;
        comments?: string | null;
      };
    };
  };

  // Demo subset drawn from MB Celulares sheet (No. Stock MBC##)
  const seeds: SeedPhone[] = [
    {
      stock_no: "MBC01",
      acquired_at: "2026-09-29",
      cost: 1300,
      suggested_price: 1800,
      includes_charger: "Si",
      brand: "Samsung",
      model: "Galaxy M15",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: "4",
      storage: "128",
      status: "vendido",
      sale: {
        sold_at: "2026-10-02",
        amount: 1800,
        customer: "Facebook",
        channel: "Facebook",
      },
    },
    {
      stock_no: "MBC02",
      acquired_at: "2026-09-30",
      cost: 1000,
      suggested_price: 1500,
      includes_charger: "Si",
      brand: "OPPO",
      model: "A57",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: "4",
      storage: "64",
      status: "vendido",
      sale: {
        sold_at: "2026-09-30",
        amount: 1400,
        customer: "Facebook",
        channel: "Facebook",
      },
    },
    {
      stock_no: "MBC03",
      acquired_at: "2026-09-30",
      cost: 1600,
      suggested_price: 2100,
      includes_charger: "Si",
      brand: "ZTE",
      model: "V70 Max",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: "8",
      storage: "512",
      status: "vendido",
      sale: {
        sold_at: "2026-09-30",
        amount: 2100,
        customer: "Facebook",
        channel: "Facebook",
      },
    },
    {
      stock_no: "MBC10",
      acquired_at: "2026-09-01",
      cost: 900,
      suggested_price: 1400,
      includes_charger: "No",
      brand: "Redmi",
      model: "A3",
      imei: "865723073540123",
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: "3",
      storage: "64",
      status: "disponible",
    },
    {
      stock_no: "MBC11",
      acquired_at: "2026-10-01",
      cost: 800,
      suggested_price: 1200,
      includes_charger: "No",
      brand: "Redmi",
      model: "9",
      imei: "868063052891404",
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: "4 + 1",
      storage: "64",
      status: "disponible",
    },
    {
      stock_no: "MBC12",
      acquired_at: "2026-10-01",
      cost: 1600,
      suggested_price: 2000,
      includes_charger: "No",
      brand: "Motorola",
      model: "Moto g2025",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: "4 + 2",
      storage: "128",
      status: "disponible",
    },
    {
      stock_no: "MBC17",
      acquired_at: "2026-10-02",
      cost: 2700,
      suggested_price: 3500,
      includes_charger: "Si",
      brand: "Apple",
      model: "iPhone 12",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: null,
      storage: "128 GB",
      status: "vendido",
      sale: {
        sold_at: "2026-10-03",
        amount: 3500,
        customer: "Iván",
        channel: "Credito",
        credit: {
          debtor_name: "Iván",
          credit_type: "Crédito",
          pago1: 1000,
          pago2_status: "No",
          pago3_status: "No",
          due_date: "2026-10-16",
          paid_total: 1000,
          comments: "Plan 2 pagos — hoja MB Celulares",
        },
      },
    },
    {
      stock_no: "MBC18",
      acquired_at: "2026-10-07",
      cost: 3000,
      suggested_price: 3600,
      includes_charger: "No",
      brand: "Apple",
      model: "iPhone 12",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: null,
      storage: "64 GB",
      comments: "Entrada Jonax — Efectivo VECN",
      status: "disponible",
    },
    {
      stock_no: "MBC19",
      acquired_at: "2026-10-13",
      cost: 2300,
      suggested_price: 2900,
      includes_charger: "Si",
      brand: "Apple",
      model: "iPhone",
      imei: null,
      carrier: "Liberado",
      condition_label: "A Bueno (9-10)",
      ram: null,
      storage: "64 GB",
      status: "disponible",
    },
  ];

  const insertPhone = db.prepare(`
    INSERT INTO phones (
      stock_no, acquired_at, cost, suggested_price, includes_charger,
      brand, model, imei, carrier, condition_label, ram, storage, comments, status
    ) VALUES (
      @stock_no, @acquired_at, @cost, @suggested_price, @includes_charger,
      @brand, @model, @imei, @carrier, @condition_label, @ram, @storage, @comments, @status
    )
  `);

  const tx = db.transaction(() => {
    let available = 0;
    for (const s of seeds) {
      const info = insertPhone.run({
        stock_no: s.stock_no,
        acquired_at: s.acquired_at,
        cost: s.cost,
        suggested_price: s.suggested_price,
        includes_charger: s.includes_charger,
        brand: s.brand,
        model: s.model,
        imei: s.imei,
        carrier: s.carrier,
        condition_label: s.condition_label,
        ram: s.ram,
        storage: s.storage,
        comments: s.comments ?? null,
        status: s.status,
      });
      const phoneId = Number(info.lastInsertRowid);

      if (s.status === "disponible") available += 1;

      db.prepare(
        `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
         VALUES (?, 'adquisicion', ?, ?, ?, ?)`,
      ).run(
        `${s.acquired_at}T12:00:00`,
        s.stock_no,
        -s.cost,
        s.status === "disponible" ? available : available,
        `Adquisición ${s.brand} ${s.model}`,
      );

      if (s.sale) {
        if (s.status === "disponible") {
          // shouldn't happen
        } else {
          // sale reduces available count conceptually; track after sale
        }
        const sale = db
          .prepare(
            `INSERT INTO sales (phone_id, sold_at, amount, customer, channel, extra_costs, comments)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
          )
          .get(
            phoneId,
            s.sale.sold_at,
            s.sale.amount,
            s.sale.customer,
            s.sale.channel,
            s.sale.extra_costs ?? 0,
            s.sale.comments ?? null,
          ) as { id: number };

        const availAfterSale = seeds.filter(
          (x) =>
            x.status === "disponible" ||
            (x.sale && x.sale.sold_at > s.sale!.sold_at),
        ).length;

        db.prepare(
          `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
           VALUES (?, 'venta', ?, ?, ?, ?)`,
        ).run(
          `${s.sale.sold_at}T12:00:00`,
          s.stock_no,
          s.sale.amount,
          null,
          `Venta a ${s.sale.customer}`,
        );

        if (s.sale.credit) {
          const c = s.sale.credit;
          const paid = c.paid_total ?? 0;
          const balance = s.sale.amount - paid;
          const credit = db
            .prepare(
              `INSERT INTO credit_accounts (
                sale_id, debtor_name, debtor_phone, credit_type, principal,
                paid_total, balance, pago1, pago2_status, pago3_status, due_date, liquidado, comments
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id`,
            )
            .get(
              sale.id,
              c.debtor_name,
              c.debtor_phone ?? null,
              c.credit_type ?? "Crédito",
              s.sale.amount,
              paid,
              balance,
              c.pago1 ?? null,
              c.pago2_status ?? (c.pago2 ? "Si" : "No"),
              c.pago3_status ?? "No",
              c.due_date ?? null,
              balance <= 0 ? "Si" : "No",
              c.comments ?? null,
            ) as { id: number };

          if (paid > 0) {
            db.prepare(
              `INSERT INTO collections (credit_id, amount, paid_at, note)
               VALUES (?, ?, ?, ?)`,
            ).run(
              credit.id,
              paid,
              `${s.sale.sold_at}T12:00:00`,
              "Pago 1 (semilla)",
            );
            db.prepare(
              `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
               VALUES (?, 'cobranza', ?, ?, NULL, ?)`,
            ).run(
              `${s.sale.sold_at}T12:00:00`,
              s.stock_no,
              paid,
              `Cobranza ${c.debtor_name}`,
            );
          }
          void availAfterSale;
        }
      }
    }
  });

  tx();
}

function migrateChargerLabels(db: Database.Database) {
  // Legacy 0/1 → Google Form labels (Si | No | Se incluira en venta)
  db.prepare(
    `UPDATE phones SET includes_charger = 'Si'
     WHERE CAST(includes_charger AS TEXT) IN ('1')`,
  ).run();
  db.prepare(
    `UPDATE phones SET includes_charger = 'No'
     WHERE CAST(includes_charger AS TEXT) IN ('0')`,
  ).run();
}

export function getDb(): Database.Database {
  // Avoid silent SQLite writes when Supabase is configured.
  try {
    const { useCloudDb } = require("./cloud-env") as { useCloudDb: () => boolean };
    if (useCloudDb()) {
      throw new Error(
        "SQLite getDb() blocked: CELUMB is using Supabase. Use cloud mutate path.",
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("SQLite getDb() blocked")) throw e;
  }
  if (globalThis.__celumbDb) {
    try {
      // Touch connection; if the underlying file was replaced/unlinked while we
      // still held FDs, reopen so writes land on the visible DB again.
      globalThis.__celumbDb.prepare("SELECT 1").get();
      migrateFormAlignment(globalThis.__celumbDb);
      migrateChargerLabels(globalThis.__celumbDb);
      seedAccessoriesIfEmpty(globalThis.__celumbDb);
      return globalThis.__celumbDb;
    } catch {
      try {
        globalThis.__celumbDb.close();
      } catch {
        /* ignore */
      }
      globalThis.__celumbDb = undefined;
      // Do NOT unlink DB/WAL/SHM here — deleting while another handle may still
      // be open leaves orphaned inodes and silent "writes that never save".
    }
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  // DELETE journal avoids orphan-WAL FDs when tools unlink *-wal/*-shm mid-run.
  db.pragma("journal_mode = DELETE");
  db.pragma("synchronous = FULL");
  createSchema(db);
  migrateFormAlignment(db);
  migrateChargerLabels(db);
  seedIfEmpty(db);
  seedAccessoriesIfEmpty(db);
  globalThis.__celumbDb = db;
  return db;
}

export function resetDbForDev() {
  if (globalThis.__celumbDb) {
    try {
      globalThis.__celumbDb.close();
    } catch {
      /* ignore */
    }
    globalThis.__celumbDb = undefined;
  }
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
  return getDb();
}

/**
 * KPIs / resumen / dashboard — SOLO celulares (tabla phones + sales/créditos
 * ligados a phones). Accesorios NUNCA entran en estos totales.
 */
export function getDashboardStats() {
  const db = getDb();
  const available = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM phones WHERE status = 'disponible'`)
      .get() as { c: number }
  ).c;
  const sold = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM phones WHERE status = 'vendido'`)
      .get() as { c: number }
  ).c;
  const stockCost = (
    db
      .prepare(
        `SELECT COALESCE(SUM(cost), 0) AS t FROM phones WHERE status = 'disponible'`,
      )
      .get() as { t: number }
  ).t;
  const salesTotal = (
    db.prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM sales`).get() as {
      t: number;
    }
  ).t;
  const utilidad = (
    db
      .prepare(
        `SELECT COALESCE(SUM(COALESCE(s.margin, s.amount - p.cost - s.extra_costs)), 0) AS t
         FROM sales s JOIN phones p ON p.id = s.phone_id`,
      )
      .get() as { t: number }
  ).t;
  const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const salesMonth = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS t FROM sales
         WHERE substr(sold_at, 1, 7) = ?`,
      )
      .get(monthPrefix) as { t: number }
  ).t;
  const utilidadMonth = (
    db
      .prepare(
        `SELECT COALESCE(SUM(COALESCE(s.margin, s.amount - p.cost - s.extra_costs)), 0) AS t
         FROM sales s JOIN phones p ON p.id = s.phone_id
         WHERE substr(s.sold_at, 1, 7) = ?`,
      )
      .get(monthPrefix) as { t: number }
  ).t;
  const marginPct =
    salesTotal > 0
      ? Math.round((utilidad / salesTotal) * 1000) / 10
      : null;
  const creditOpen = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM credit_accounts WHERE liquidado != 'Si'`,
      )
      .get() as { c: number }
  ).c;
  const receivable = (
    db
      .prepare(
        `SELECT COALESCE(SUM(balance), 0) AS t FROM credit_accounts WHERE liquidado != 'Si'`,
      )
      .get() as { t: number }
  ).t;

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

export function listPhones(filter?: "disponible" | "vendido" | "all"): Phone[] {
  const db = getDb();
  if (!filter || filter === "all") {
    return db
      .prepare(`SELECT * FROM phones ORDER BY stock_no COLLATE NOCASE`)
      .all() as Phone[];
  }
  return db
    .prepare(
      `SELECT * FROM phones WHERE status = ? ORDER BY stock_no COLLATE NOCASE`,
    )
    .all(filter) as Phone[];
}

export function getPhone(id: number): Phone | undefined {
  return getDb().prepare(`SELECT * FROM phones WHERE id = ?`).get(id) as
    | Phone
    | undefined;
}

export function listAvailablePhones(): Phone[] {
  return listPhones("disponible");
}

export function listSales(): (Sale & {
  utilidad: number;
  margen: number;
  days_in_stock: number;
})[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*, p.stock_no, p.brand, p.model, p.cost, p.acquired_at
       FROM sales s
       JOIN phones p ON p.id = s.phone_id
       ORDER BY s.sold_at DESC`,
    )
    .all() as (Sale & {
    cost: number;
    acquired_at: string;
  })[];

  return rows.map((r) => {
    const margen =
      r.margin != null && Number.isFinite(r.margin)
        ? r.margin
        : r.amount - r.cost - (r.extra_costs || 0);
    return {
      ...r,
      utilidad: margen,
      margen,
      days_in_stock: daysBetweenLocal(r.acquired_at, r.sold_at),
    };
  });
}

function daysBetweenLocal(from: string, to: string): number {
  const a = new Date(from.includes("T") ? from : `${from}T12:00:00`);
  const b = new Date(to.includes("T") ? to : `${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function incomeByChannel() {
  return getDb()
    .prepare(
      `SELECT channel, COUNT(*) AS n, SUM(amount) AS total
       FROM sales GROUP BY channel ORDER BY total DESC`,
    )
    .all() as { channel: string; n: number; total: number }[];
}

export function listCreditAccounts(): CreditAccount[] {
  return getDb()
    .prepare(
      `SELECT ca.*, p.stock_no, p.brand, p.model, s.sold_at
       FROM credit_accounts ca
       JOIN sales s ON s.id = ca.sale_id
       JOIN phones p ON p.id = s.phone_id
       ORDER BY CASE ca.liquidado WHEN 'Si' THEN 2 WHEN 'Retrasado' THEN 0 ELSE 1 END, CASE WHEN ca.due_date IS NULL THEN 1 ELSE 0 END, ca.due_date ASC`,
    )
    .all() as CreditAccount[];
}

export function listCollections(limit = 40): Collection[] {
  return getDb()
    .prepare(
      `SELECT col.*, ca.debtor_name, p.stock_no
       FROM collections col
       JOIN credit_accounts ca ON ca.id = col.credit_id
       JOIN sales s ON s.id = ca.sale_id
       JOIN phones p ON p.id = s.phone_id
       ORDER BY col.paid_at DESC
       LIMIT ?`,
    )
    .all(limit) as Collection[];
}

export function listLedger(limit = 40): LedgerEntry[] {
  return getDb()
    .prepare(`SELECT * FROM ledger ORDER BY at DESC, id DESC LIMIT ?`)
    .all(limit) as LedgerEntry[];
}


export function listSupplierCredits(): SupplierCredit[] {
  return getDb()
    .prepare(
      `SELECT * FROM supplier_credits
       ORDER BY CASE paid WHEN 'No' THEN 0 ELSE 1 END, at DESC`,
    )
    .all() as SupplierCredit[];
}

export function listAccessories(): Accessory[] {
  return getDb()
    .prepare(
      `SELECT * FROM accessories
       ORDER BY CAST(substr(COALESCE(stock_no, codigo), 4) AS INTEGER) ASC,
                stock_no COLLATE NOCASE`,
    )
    .all() as Accessory[];
}

export function getAccessoryByCodigo(codigo: string): Accessory | undefined {
  const key = codigo.trim();
  return getDb()
    .prepare(
      `SELECT * FROM accessories
       WHERE stock_no = ? COLLATE NOCASE
          OR codigo = ? COLLATE NOCASE
          OR catalog_code = ? COLLATE NOCASE`,
    )
    .get(key, key, key) as Accessory | undefined;
}

export function nextStockNo(): string {
  const row = getDb()
    .prepare(
      `SELECT stock_no FROM phones
       WHERE stock_no GLOB 'MBC[0-9]*'
       ORDER BY CAST(substr(stock_no, 4) AS INTEGER) DESC
       LIMIT 1`,
    )
    .get() as { stock_no: string } | undefined;
  if (!row) return "MBC01";
  const n = Number(row.stock_no.replace(/\D/g, "")) + 1;
  return `MBC${String(n).padStart(2, "0")}`;
}

/** Siguiente No. stock de accesorio: ACC001, ACC002… */
export function nextAccStockNo(): string {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(stock_no, codigo) AS sn FROM accessories
       WHERE COALESCE(stock_no, codigo) GLOB 'ACC[0-9]*'
       ORDER BY CAST(substr(COALESCE(stock_no, codigo), 4) AS INTEGER) DESC
       LIMIT 1`,
    )
    .get() as { sn: string } | undefined;
  if (!row?.sn) return "ACC001";
  const n = Number(row.sn.replace(/\D/g, "")) + 1;
  return `ACC${String(n).padStart(3, "0")}`;
}
