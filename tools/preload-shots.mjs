// Capture the preloader sequence: a screenshot every 350 ms right after navigation.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const outDir = path.resolve(process.argv[3] ?? 'app2d/screenshots/preload');
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
page.on('pageerror', (e) => log('[pageerror]', e.message));
page.goto(url, { waitUntil: 'commit' });
for (let i = 0; i < 18; i++) {
  await page.waitForTimeout(350);
  const cls = await page.evaluate(() => document.querySelector('.preloader')?.className ?? '(gone)').catch(() => '?');
  await page.screenshot({ path: path.join(outDir, `p_${String(i).padStart(2, '0')}.png`) }).catch(() => {});
  log(`frame ${i}  ${cls}`);
}
await browser.close();
log('DONE');
