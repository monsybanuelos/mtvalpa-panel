import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const MEDIA =
  "/cursor/stores/bc-01a14ca7-e7cb-7201-8575-dd029e780eef/media";
const BASE = "http://localhost:3000";

fs.mkdirSync(MEDIA, { recursive: true });

async function login(page, user, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await login(page, "Admin", "087962");
  await page.screenshot({
    path: path.join(MEDIA, "celumb-login-ok-home.png"),
    fullPage: false,
  });

  // Adquisición modal — locked stock + battery
  await page.click('button:has-text("Registrar adquisición")');
  await page.waitForSelector("#stock_no");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(MEDIA, "celumb-adquisicion-auto-stock-battery.png"),
    fullPage: false,
  });

  // Fill and submit adquisición
  await page.fill("#cost", "1250");
  await page.fill("#suggested_price", "1700");
  await page.fill("#brand", "Samsung");
  await page.fill("#model", "Galaxy A07");
  await page.fill("#ram", "4 / 4 + 1");
  await page.fill("#storage", "128");
  await page.fill("#battery_pct", "87");
  await page.click('button[type="submit"]:has-text("Registrar adquisición")');
  await page.waitForSelector(".toast-ok", { timeout: 12000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(MEDIA, "celumb-toast-adquisicion.png"),
    fullPage: false,
  });

  // Venta toast
  await page.goto(`${BASE}/ventas`, { waitUntil: "networkidle" });
  const phoneSelect = page.locator("#phone_id");
  const opts = await phoneSelect.locator("option").allTextContents();
  const firstReal = opts.find((t) => t && !t.includes("Selecciona"));
  if (firstReal) {
    const value = await phoneSelect.locator("option").nth(1).getAttribute("value");
    await phoneSelect.selectOption(value);
    await page.fill("#amount", "3500");
    await page.fill("#customer", "Prueba Toast");
    await page.click('button[type="submit"]:has-text("Guardar venta")');
    await page.waitForSelector(".toast-ok", { timeout: 12000 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(MEDIA, "celumb-toast-venta.png"),
      fullPage: false,
    });
  } else {
    console.log("No phones available for venta toast");
  }

  // Cobranza toast
  await page.goto(`${BASE}/credito`, { waitUntil: "networkidle" });
  const creditSelect = page.locator("#credit_id");
  if ((await creditSelect.count()) > 0) {
    const cOpts = await creditSelect.locator("option").count();
    if (cOpts > 1) {
      const cVal = await creditSelect.locator("option").nth(1).getAttribute("value");
      await creditSelect.selectOption(cVal);
      await page.fill("#amount", "600");
      await page.fill("#paid_at", "2026-10-16");
      await page.click('button[type="submit"]:has-text("Registrar pago")');
      await page.waitForSelector(".toast-ok", { timeout: 12000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(MEDIA, "celumb-toast-cobranza.png"),
        fullPage: false,
      });
    }
  }

  await browser.close();
  console.log("Screenshots written to", MEDIA);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
