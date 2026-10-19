import { chromium } from "playwright";
import path from "node:path";

const MEDIA = "/cursor/stores/bc-01a14ca7-e7cb-7201-8575-dd029e780eef/media";
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#username", "Admin");
await page.fill("#password", "087962");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 }),
  page.click('button[type="submit"]'),
]);

await page.goto(`${BASE}/inventario`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Agregar manualmente", { timeout: 15000 });
await page.waitForSelector("text=Accesorios", { timeout: 15000 });

// Stock with Agregar manualmente
const stockPanel = page.locator(".panel").filter({ hasText: "Stock ·" }).first();
await stockPanel.scrollIntoViewIfNeeded();
await page.screenshot({
  path: path.join(MEDIA, "celumb-2.1-stock-agregar-manual.png"),
  fullPage: false,
});

// Accesorios section
const accPanel = page.locator(".panel").filter({ hasText: "Accesorios ·" }).first();
await accPanel.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(MEDIA, "celumb-2.1-accesorios.png"),
  fullPage: false,
});

// Open Adquisición from toolbar — Celular|Otro
await page.locator('button.btn-cta').filter({ hasText: "Registrar adquisición" }).first().click();
await page.waitForSelector('text=¿Qué adquieres?', { timeout: 10000 });
await page.screenshot({
  path: path.join(MEDIA, "celumb-2.1-adq-celular-otro.png"),
  fullPage: false,
});

// Switch to Otro
await page.locator('label.choice').filter({ hasText: "Otro" }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: path.join(MEDIA, "celumb-2.1-adq-otro-fields.png"),
  fullPage: false,
});

await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Agregar manualmente opens with celular
await page.locator('button').filter({ hasText: "Agregar manualmente" }).click();
await page.waitForSelector('text=¿Qué adquieres?', { timeout: 10000 });
const celularChecked = await page.locator('input[type="radio"]').nth(0).isChecked().catch(() => null);
await page.screenshot({
  path: path.join(MEDIA, "celumb-2.1-agregar-manual-modal.png"),
  fullPage: false,
});

// Home KPIs still load
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.screenshot({
  path: path.join(MEDIA, "celumb-2.1-dashboard-phone-kpis.png"),
  fullPage: false,
});

console.log("shots ok", { celularChecked });
await browser.close();
