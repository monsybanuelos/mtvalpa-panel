const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatMoney(amount: number): string {
  return money.format(amount);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

export function daysBetween(from: string, to?: string | null): number {
  const a = new Date(from.includes("T") ? from : `${from}T12:00:00`);
  const b = to
    ? new Date(to.includes("T") ? to : `${to}T12:00:00`)
    : new Date();
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
