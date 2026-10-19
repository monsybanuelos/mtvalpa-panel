import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

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
await page.waitForSelector("text=Agregar manualmente");

// Default stock = phones only
await page.screenshot({ path: path.join(MEDIA, "celumb-2.2-stock-celulares-default.png") });

// Open filter + switch to Accesorios
await page.click("text=Filtrar");
await page.waitForSelector("#filter_tipo");
await page.selectOption("#filter_tipo", "accesorios");
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(MEDIA, "celumb-2.2-stock-filtro-acc.png") });

// Back to celular filter visible
await page.selectOption("#filter_tipo", "celulares");

// Open adq and show photos
await page.locator("button.btn-cta").filter({ hasText: "Registrar adquisición" }).first().click();
await page.waitForSelector("text=¿Qué adquieres?");
await page.waitForSelector("text=Subir Foto 1");
// scroll photos into view
await page.locator("text=Subir Foto 1").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(MEDIA, "celumb-2.2-adq-fotos.png") });

// Upload a tiny png via the file input
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC",
  "base64",
);
const tmp = "/tmp/celumb-test-foto.png";
fs.writeFileSync(tmp, png);

const [fileChooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.locator("button.photo-upload__btn").filter({ hasText: "Subir Foto 1" }).click(),
]);
await fileChooser.setFiles(tmp);
await page.waitForSelector("text=Foto subida con éxito", { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(MEDIA, "celumb-2.2-adq-foto-ok.png") });

console.log("shots ok");
await browser.close();
