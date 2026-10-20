import { parsePhotoLink } from "./photo-link";

/** Fields a Ventas session is allowed to receive. No cost, margin, or credit. */

export type SalesStockPhone = {
  id: number;
  stock_no: string;
  status: "disponible" | "vendido";
  brand: string;
  model: string;
  suggested_price: number;
  carrier: string;
  condition_label: string;
  ram: string | null;
  storage: string | null;
  battery_pct: number | null;
  includes_charger: string;
  has_photo1: boolean;
  has_photo2: boolean;
  /** http(s) link for Foto 1. Null when the slot is empty. */
  photo1_url: string | null;
  photo2_url: string | null;
};

/** Listed columns only, plus flags for the two photo downloads. No cost or credit. */
export const SALES_STOCK_SELECT = `
  id,
  stock_no,
  status,
  brand,
  model,
  suggested_price,
  carrier,
  condition_label,
  ram,
  storage,
  battery_pct,
  includes_charger,
  CASE WHEN photo1_path IS NOT NULL AND length(trim(photo1_path)) > 0 THEN 1 ELSE 0 END AS has_photo1,
  CASE WHEN photo2_path IS NOT NULL AND length(trim(photo2_path)) > 0 THEN 1 ELSE 0 END AS has_photo2,
  CASE
    WHEN lower(trim(coalesce(photo1_path, ''))) LIKE 'https://%'
      OR lower(trim(coalesce(photo1_path, ''))) LIKE 'http://%'
    THEN trim(photo1_path)
    ELSE ''
  END AS photo1_url,
  CASE
    WHEN lower(trim(coalesce(photo2_path, ''))) LIKE 'https://%'
      OR lower(trim(coalesce(photo2_path, ''))) LIKE 'http://%'
    THEN trim(photo2_path)
    ELSE ''
  END AS photo2_url
`;

function asBool(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "t" ||
    value === "true"
  );
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/** Copy only the sales-safe fields. Drops cost, margin, credit, and anything else. */
export function toSalesStockPhone(row: object): SalesStockPhone {
  const src = row as Record<string, unknown>;
  const status = src.status === "vendido" ? "vendido" : "disponible";
  const battery = src.battery_pct;
  const batteryN = battery == null || battery === "" ? null : Number(battery);
  return {
    id: Number(src.id),
    stock_no: String(src.stock_no ?? "").trim(),
    status,
    brand: String(src.brand ?? ""),
    model: String(src.model ?? ""),
    suggested_price: Number(src.suggested_price ?? 0),
    carrier: String(src.carrier ?? ""),
    condition_label: String(src.condition_label ?? ""),
    ram: emptyToNull(src.ram),
    storage: emptyToNull(src.storage),
    battery_pct:
      batteryN != null && Number.isFinite(batteryN) ? batteryN : null,
    includes_charger: String(src.includes_charger ?? ""),
    has_photo1: asBool(src.has_photo1),
    has_photo2: asBool(src.has_photo2),
    photo1_url: httpPhotoLink(src.photo1_url),
    photo2_url: httpPhotoLink(src.photo2_url),
  };
}

/** http(s) only. Anything else stays off the Ventas page. */
function httpPhotoLink(value: unknown): string | null {
  const parsed = parsePhotoLink(value);
  return parsed.ok ? parsed.url : null;
}

function gradoFromCondition(condition: string): string {
  const c = String(condition || "");
  if (/^AA\b/i.test(c) || /AA Nuevo/i.test(c)) return "AA";
  if (/^A\b/i.test(c) || /A Bueno/i.test(c)) return "A";
  if (/^B\b/i.test(c) || /B Regular/i.test(c)) return "B";
  if (/^C\b/i.test(c) || /C Con/i.test(c)) return "C";
  return c || "—";
}

function fmtStorageGB(storage: string | null): string {
  const s = String(storage || "").trim();
  if (!s || s === "—") return "";
  const m = s.match(/(\d+)/);
  return m ? m[1] : s.replace(/\s*GB/i, "");
}

/** Emoji sales post. Sale price only — never cost or margin. */
export function salesPostText(phone: SalesStockPhone): string {
  const model = phone.model.trim() || "Equipo";
  const price = Math.round(Number(phone.suggested_price) || 0).toLocaleString(
    "en-US",
  );
  const gb = fmtStorageGB(phone.storage);
  const carrier = (phone.carrier || "").trim();
  const ciaLine = /^liberado$/i.test(carrier)
    ? "Libre a cualquier compañía"
    : carrier || "—";
  const grado = gradoFromCondition(phone.condition_label);
  const lines = [`🔸🔸${model} 🔸🔸`, `💲${price}`];
  if (gb) lines.push(`▪${gb} GB`);
  lines.push(`▪${ciaLine}`);
  lines.push(`▪Grado ${grado}`);
  if (phone.battery_pct != null && Number.isFinite(phone.battery_pct)) {
    lines.push(`▪Batería ${Math.round(phone.battery_pct)}%`);
  }
  const ram = (phone.ram || "").trim();
  if (ram && ram !== "—") lines.push(`▪RAM ${ram}`);
  return lines.join("\n");
}
