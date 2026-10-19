import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const MEDIA = "/cursor/stores/bc-01a14ca7-e7cb-7201-8575-dd029e780eef/media";
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(25000);

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill("#username", "Admin");
await page.fill("#password", "087962");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login")),
  page.click('button[type="submit"]'),
]);

await page.goto(`${BASE}/inventario`, { waitUntil: "networkidle" });
await page.locator("button").filter({ hasText: "Registrar adquisición" }).first().click();
const fotoBtn = page.locator("button.photo-upload__btn").filter({ hasText: "Subir Foto 1" });
await fotoBtn.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-adq-fotos.png") });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC",
  "base64",
);
const tmp = "/tmp/celumb-test-foto.png";
fs.writeFileSync(tmp, png);
const [fc] = await Promise.all([
  page.waitForEvent("filechooser"),
  fotoBtn.click(),
]);
await fc.setFiles(tmp);
await page.locator(".photo-upload .ok").first().waitFor({ state: "visible", timeout: 25000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-adq-foto-ok.png") });
await page.keyboard.press("Escape");

await page.goto(`${BASE}/ventas`, { waitUntil: "networkidle" });
await page.waitForSelector("legend >> text=Tipo de venta");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-venta-contado.png") });
await page.locator('input[name="sale_type"][value="Credito"]').check();
await page.waitForSelector("#debtor_phone");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-venta-credito.png") });

await page.goto(`${BASE}/credito#creditos-activos`, { waitUntil: "networkidle" });
await page.locator("#creditos-activos").scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-creditos-activos.png") });

console.log("ok", fs.readdirSync(MEDIA).filter((f) => f.startsWith("celumb-2.3")).sort());
await browser.close();
