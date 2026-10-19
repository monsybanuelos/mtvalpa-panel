import {
  getDb,
  listLedger,
  listPhones,
  nextStockNo,
  resetDbForDev,
} from "../src/lib/db";

resetDbForDev();
const db = getDb();
const stock = nextStockNo();
console.log("next", stock);

db.prepare(
  `INSERT INTO phones (
    stock_no, acquired_at, cost, suggested_price, includes_charger,
    brand, model, imei, carrier, condition_label, ram, storage, comments, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponible')`,
).run(
  stock,
  "2026-10-18",
  950,
  1400,
  "Se incluira en venta",
  "Realme",
  "C55",
  null,
  "Telcel",
  "B Regular (8)",
  "6",
  "128",
  "Prueba form Google",
);

const avail = (
  db
    .prepare(`SELECT COUNT(*) AS c FROM phones WHERE status = 'disponible'`)
    .get() as { c: number }
).c;

db.prepare(
  `INSERT INTO ledger (at, kind, stock_no, amount, available_after, note)
   VALUES (?, 'adquisicion', ?, ?, ?, ?)`,
).run(
  "2026-10-18T12:00:00",
  stock,
  -950,
  avail,
  "Adquisición Realme C55",
);

// Duplicate should fail at unique
try {
  db.prepare(
    `INSERT INTO phones (
      stock_no, acquired_at, cost, suggested_price, includes_charger,
      brand, model, imei, carrier, condition_label, ram, storage, comments, status
    ) VALUES (?, '2026-10-18', 1, 1, 'No', 'X', 'Y', null, 'Liberado', 'AA Nuevo', null, null, null, 'disponible')`,
  ).run(stock);
  console.log("FAIL: duplicate allowed");
} catch {
  console.log("unique ok");
}

console.log(
  "sample",
  listPhones("disponible")
    .filter((p) => p.stock_no === stock)
    .map((p) => ({
      stock_no: p.stock_no,
      charger: p.includes_charger,
      condition: p.condition_label,
      carrier: p.carrier,
    })),
);
console.log(
  "ledger",
  listLedger(2).map((e) => ({ kind: e.kind, stock_no: e.stock_no, amount: e.amount })),
);
