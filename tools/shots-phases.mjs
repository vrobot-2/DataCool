// Screenshot each phase section of a running app (real wheel input, progress logged).
//   node tools/shots-phases.mjs <url> <outDir> [width] [height]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const outDir = path.resolve(process.argv[3] ?? 'app2d/screenshots');
const width = Number(process.argv[4] ?? 1600);
const height = Number(process.argv[5] ?? 1000);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && log('[console.error]', m.text().slice(0, 160)));
log('open', url, `${width}x${height}`);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4500); // preloader
await page.mouse.move(width / 2, height / 2);

const mids = await page.$$eval('section[data-phase]', (els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.id, y: Math.max(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2) };
  }),
);
log('phases', mids.length);
for (let i = 0; i < mids.length; i++) {
  const target = mids[i].y;
  for (let k = 0; k < 40; k++) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(target - y) < 6) break;
    await page.mouse.wheel(0, Math.max(-900, Math.min(900, target - y)));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(2600);
  const file = path.join(outDir, `${String(i).padStart(2, '0')}_${mids[i].id}.png`);
  await page.screenshot({ path: file });
  log(`${String(Math.round(((i + 1) / mids.length) * 100)).padStart(3)}%  ${mids[i].id}  -> ${path.basename(file)}`);
}
// calculator
const calcY = await page.evaluate(() => document.querySelector('.calculator')?.getBoundingClientRect().top + window.scrollY);
if (calcY) {
  for (let k = 0; k < 60; k++) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(calcY - y) < 6) break;
    await page.mouse.wheel(0, Math.max(-900, Math.min(900, calcY - y)));
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, '99_calculator.png') });
  log('calculator captured');
}
await browser.close();
log('DONE');
