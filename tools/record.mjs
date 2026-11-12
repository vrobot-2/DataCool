// Record a linear scroll of a page (real mouse-wheel input) with progress logging,
// a webm video, and a screenshot every 5 %.
//   node tools/record.mjs <url> <outDir> [seconds]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const outDir = path.resolve(process.argv[3] ?? 'tools/rec');
const seconds = Number(process.argv[4] ?? 30);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });

log('launching chrome');
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.on('pageerror', (e) => log('[pageerror]', e.message));

log('navigating', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
log('dom ready, letting assets load (6 s)');
await page.waitForTimeout(6000);
await page.mouse.move(720, 450);

const height = () =>
  page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
let max = await height();
log('scrollable height', max, 'px');

const stepMs = 50;
const steps = Math.round((seconds * 1000) / stepMs);
let lastPct = -1;
for (let i = 0; i <= steps; i++) {
  const target = (max * i) / steps;
  const y = await page.evaluate(() => window.scrollY);
  const dy = target - y;
  if (Math.abs(dy) > 0.5) await page.mouse.wheel(0, dy);
  await page.waitForTimeout(stepMs);
  const pct = Math.floor((i / steps) * 100);
  if (pct !== lastPct && pct % 5 === 0) {
    lastPct = pct;
    const sy = await page.evaluate(() => Math.round(window.scrollY));
    log(`${String(pct).padStart(3)}%  [${'#'.repeat(pct / 5).padEnd(20, '.')}]  scrollY=${sy}`);
    await page.screenshot({ path: path.join(outDir, 'frames', `f_${String(pct).padStart(3, '0')}.png`) });
    max = await height();
  }
}
log('scroll finished, flushing video');
await page.waitForTimeout(1500);
const video = page.video();
await context.close();
await browser.close();
const file = await video.path();
log('VIDEO', file, `${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
log('DONE');
