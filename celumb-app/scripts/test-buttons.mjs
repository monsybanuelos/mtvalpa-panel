import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const logs = [];
  page.on('console', (m) => {
    const t = m.type();
    const text = m.text();
    logs.push(`[${t}] ${text}`);
    if (t === 'error') errors.push(text);
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' ' + r.failure()?.errorText));

  const results = {};

  // LOGIN
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#username', 'Admin');
  await page.fill('#password', '087962');
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
    results.login = { ok: true, url: page.url() };
  } catch {
    results.login = { ok: false, url: page.url(), body: (await page.content()).slice(0, 300) };
  }
  console.log('LOGIN', results.login);
  console.log('errors so far', errors);

  await page.screenshot({ path: '/tmp/btn-home.png', fullPage: true });

  // NAV links
  for (const name of ['Inventario', 'Ventas', 'Crédito', 'Inicio']) {
    try {
      const link = page.locator(`nav a, nav button, .site-nav a, header a`).filter({ hasText: name }).first();
      const count = await link.count();
      if (!count) {
        // try any link with text
        const any = page.getByRole('link', { name }).or(page.getByRole('button', { name }));
        await any.first().click({ timeout: 3000 });
      } else {
        await link.click({ timeout: 3000 });
      }
      await page.waitForTimeout(800);
      results['nav:' + name] = { ok: true, url: page.url() };
    } catch (e) {
      results['nav:' + name] = { ok: false, err: String(e.message).slice(0, 200), url: page.url() };
    }
  }
  console.log('NAV results', JSON.stringify(results, null, 2));

  // Go home, open Adquisición
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  try {
    const btn = page.locator('button:has-text("Registrar adquisición")').first();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(600);
    const modalVisible = await page.locator('#adq-title, [role="dialog"], .modal-panel, .modal-backdrop.is-open, .modal-backdrop').first().isVisible().catch(() => false);
    const dialogCount = await page.locator('[role="dialog"], .modal-panel').count();
    results.adquisicion = { ok: dialogCount > 0 || modalVisible, dialogCount, modalVisible };
    await page.screenshot({ path: '/tmp/btn-adq.png' });
    // close if open
    const close = page.locator('[data-close-adq], button:has-text("Cancelar"), .modal-close').first();
    if (await close.count()) await close.click().catch(() => {});
  } catch (e) {
    results.adquisicion = { ok: false, err: String(e.message).slice(0, 300) };
  }

  // Inventario Filtrar + Compartir
  await page.goto(BASE + '/inventario', { waitUntil: 'networkidle' });
  try {
    await page.locator('#btn-filtrar, button:has-text("Filtrar")').first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
    const filterVisible = await page.locator('#filter-bar, .filter-bar').isVisible().catch(() => false);
    const filterHidden = await page.locator('#filter-bar').getAttribute('hidden').catch(() => null);
    results.filtrar = { ok: true, filterVisible, filterHidden };
  } catch (e) {
    results.filtrar = { ok: false, err: String(e.message).slice(0, 200) };
  }
  try {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 3000 }).catch(() => null),
      page.locator('a:has-text("Compartir"), button:has-text("Compartir")').first().click({ timeout: 5000 }),
    ]);
    await page.waitForTimeout(500);
    results.compartir = { ok: true, url: page.url(), popup: popup ? popup.url() : null };
  } catch (e) {
    results.compartir = { ok: false, err: String(e.message).slice(0, 200), url: page.url() };
  }

  // Ventas Guardar
  await page.goto(BASE + '/ventas', { waitUntil: 'networkidle' });
  try {
    const phoneSelect = page.locator('#phone_id, select[name="phone_id"]').first();
    if (await phoneSelect.count()) {
      const opts = await phoneSelect.locator('option').count();
      if (opts > 1) await phoneSelect.selectOption({ index: 1 });
    }
    await page.locator('#amount, input[name="amount"]').first().fill('100');
    await page.locator('#customer, input[name="customer"]').first().fill('Test Playwright');
    await page.locator('button:has-text("Guardar venta"), button[type="submit"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    const toast = await page.locator('.toast, .form-status').allTextContents();
    results.guardarVenta = { ok: toast.some(t => /registrad|guardad|error|obligator/i.test(t)), toast };
  } catch (e) {
    results.guardarVenta = { ok: false, err: String(e.message).slice(0, 300) };
  }

  // Credito Registrar pago
  await page.goto(BASE + '/credito', { waitUntil: 'networkidle' });
  try {
    const sel = page.locator('#credit_id');
    if (await sel.count() && (await sel.locator('option').count()) > 1) {
      await sel.selectOption({ index: 1 });
      await page.fill('#amount', '1');
      await page.click('button:has-text("Registrar pago")');
      await page.waitForTimeout(2000);
      const toast = await page.locator('.toast, .form-status').allTextContents();
      results.registrarPago = { ok: toast.length > 0, toast };
    } else {
      results.registrarPago = { ok: true, skipped: 'no open credits', panel: await page.locator('.panel').first().innerText().then(t => t.slice(0,200)) };
    }
  } catch (e) {
    results.registrarPago = { ok: false, err: String(e.message).slice(0, 300) };
  }

  await page.screenshot({ path: '/tmp/btn-final.png', fullPage: true });
  console.log('=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('=== ERRORS ===');
  console.log(errors.slice(0, 40));
  console.log('=== LOGS (last 30) ===');
  console.log(logs.slice(-30));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
