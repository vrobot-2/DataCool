// Open the calculator, press Play, capture errors + screenshots.
//   node tools/calc-test.mjs <url> <outDir> [width] [height]
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
let errors = 0;
page.on('pageerror', (e) => { errors++; log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors++; log('[console.error]', m.text().slice(0, 200)); } });
log('open', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4500);
await page.mouse.move(width / 2, height / 2);

const top = await page.evaluate(() => document.querySelector('.calculator').getBoundingClientRect().top + window.scrollY);
async function scrollTo(target) {
  for (let k = 0; k < 80; k++) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(target - y) < 6) break;
    await page.mouse.wheel(0, Math.max(-900, Math.min(900, target - y)));
    await page.waitForTimeout(80);
  }
}
await scrollTo(top);
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'calc_a_top.png') });
log('captured top of calculator');
await scrollTo(top + 420);
await page.waitForTimeout(800);

// stop autoplay (if it started) then press Play explicitly
const play = page.locator('.fc-play');
log('play button text:', await play.innerText());
await play.click();
for (const s of [1, 2, 3]) {
  await page.waitForTimeout(1000);
  log(`after ${s}s:`, await page.locator('.fc-year').innerText(), '|', await play.innerText());
  if (s === 2) await page.screenshot({ path: path.join(outDir, 'calc_b_playing.png') });
}
await page.waitForTimeout(6000);
log('end:', await page.locator('.fc-year').innerText(), '|', await play.innerText());
await page.screenshot({ path: path.join(outDir, 'calc_c_done.png') });
await scrollTo(top + 1500);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'calc_d_details.png') });
log(errors ? `ERRORS: ${errors}` : 'no errors');
await browser.close();
log('DONE');
