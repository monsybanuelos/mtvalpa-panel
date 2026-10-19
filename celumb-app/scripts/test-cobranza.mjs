import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('response', async (r) => {
    if (r.url().includes('_next') || r.request().method() === 'POST') {
      if (r.request().method() === 'POST' || r.status() >= 400)
        console.log('RESP', r.status(), r.request().method(), r.url().slice(0,120));
    }
  });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#username', 'Admin');
  await page.fill('#password', '087962');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15000 }).catch(() => {});
  console.log('after login', page.url());

  await page.goto(BASE + '/credito', { waitUntil: 'networkidle' });
  console.log('credito title', await page.locator('h1').first().textContent());
  const labels = await page.locator('.panel').first().innerText();
  console.log('first panel snippet:\n', labels.slice(0, 500));

  // Select credit
  const select = page.locator('#credit_id');
  const opts = await select.locator('option').allTextContents();
  console.log('options', opts);
  await select.selectOption({ index: 1 }); // first real option
  await page.fill('#amount', '500');
  await page.fill('#paid_at', '2026-10-18');

  // Capture before
  const before = await page.locator('.panel').nth(1).innerText();
  console.log('ultimas before:\n', before.slice(0, 300));

  await page.click('button[type="submit"]:has-text("Registrar pago")');
  await page.waitForTimeout(2500);

  // Toast?
  const toast = await page.locator('.toast, .toast-ok, .toast-err, .form-status').allTextContents().catch(() => []);
  console.log('toasts/status', toast);

  const after = await page.locator('.panel').nth(1).innerText();
  console.log('ultimas after:\n', after.slice(0, 400));
  const stats = await page.locator('.stat-row').first().innerText();
  console.log('stats:\n', stats);

  await page.screenshot({ path: '/tmp/cobranza-after.png', fullPage: true });
  console.log('screenshot /tmp/cobranza-after.png');
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
