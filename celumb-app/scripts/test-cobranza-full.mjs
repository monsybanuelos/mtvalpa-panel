import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type()==='error') console.log('CONSOLE ERR', m.text()); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#username', 'Admin');
  await page.fill('#password', '087962');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15000 }).catch(()=>{});

  await page.goto(BASE + '/credito', { waitUntil: 'networkidle' });
  await page.waitForSelector('#credit_id');
  const opts = await page.locator('#credit_id option').allTextContents();
  console.log('options', opts);
  await page.selectOption('#credit_id', { index: 1 });
  await page.fill('#amount', '2500');
  await page.fill('#paid_at', '2026-10-18');

  const beforeList = await page.locator('.panel').filter({ hasText: 'Últimas cobranzas' }).innerText();
  console.log('BEFORE\n', beforeList.slice(0, 250));

  await page.click('button[type="submit"]:has-text("Registrar pago")');
  await page.waitForTimeout(3000);

  const toast = await page.locator('.toast, .toast-ok, .form-status .ok, .form-status .err').allTextContents();
  console.log('toast/status', toast);

  const afterList = await page.locator('.panel').filter({ hasText: 'Últimas cobranzas' }).innerText();
  console.log('AFTER\n', afterList.slice(0, 400));

  const stats = await page.locator('.stat-row').first().innerText();
  console.log('STATS\n', stats);

  // Open accounts form may say no pending
  const formPanel = await page.locator('.panel').filter({ hasText: 'Registrar cobranza' }).innerText();
  console.log('FORM PANEL\n', formPanel.slice(0, 300));

  await page.screenshot({ path: '/tmp/cobranza-full-2500.png', fullPage: true });

  // Home KPIs
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const resumen = await page.locator('text=Resumen del negocio').locator('..').locator('..').innerText().catch(()=>'');
  const secondary = await page.locator('.stat-row--secondary').innerText();
  console.log('SECONDARY KPIs\n', secondary);
  await page.screenshot({ path: '/tmp/resumen-reorder.png', fullPage: false });

  // Verify DB
  console.log('DONE screenshots');
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
