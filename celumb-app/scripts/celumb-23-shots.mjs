import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const MEDIA = "/cursor/stores/bc-01a14ca7-e7cb-7201-8575-dd029e780eef/media";
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(20000);

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill("#username", "Admin");
await page.fill("#password", "087962");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);

// Home hero with créditos activos
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Ver créditos activos");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-inicio-creditos-activos.png") });

// Inventario default phones
await page.goto(`${BASE}/inventario`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Agregar manualmente");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-stock-celulares-default.png") });

// Filter ACC
await page.locator(".stock-actions button").filter({ hasText: "Filtrar" }).click();
await page.waitForSelector("#filter_tipo", { state: "visible" });
await page.selectOption("#filter_tipo", "accesorios");
await page.waitForSelector("text=ACC001");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-stock-filtro-acc.png") });

// Adq photos
await page.selectOption("#filter_tipo", "celulares");
await page.locator("button").filter({ hasText: "Registrar adquisición" }).first().click();
await page.waitForSelector("text=Subir Foto 1");
await page.locator("text=Subir Foto 1").scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-adq-fotos.png") });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC",
  "base64",
);
const tmp = "/tmp/celumb-test-foto.png";
fs.writeFileSync(tmp, png);
const [fc] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.locator("button.photo-upload__btn").filter({ hasText: "Subir Foto 1" }).click(),
]);
await fc.setFiles(tmp);
await page.waitForSelector("text=Foto subida con éxito", { timeout: 20000 });
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-adq-foto-ok.png") });
await page.keyboard.press("Escape");

// Ventas Contado|Credito
await page.goto(`${BASE}/ventas`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Tipo de venta");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-venta-contado.png") });
await page.locator("label.choice").filter({ hasText: "Crédito" }).click();
await page.waitForSelector("text=Número teléfono");
await page.waitForSelector("text=Plazo en días");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-venta-credito.png") });

// Creditos activos page
await page.goto(`${BASE}/credito#creditos-activos`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Créditos activos");
await page.screenshot({ path: path.join(MEDIA, "celumb-2.3-creditos-activos.png") });

console.log("all shots ok");
await browser.close();
