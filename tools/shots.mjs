// Screenshot the production preview at each phase, desktop + mobile.
//   node tools/shots.mjs http://127.0.0.1:4173/ app/screenshots
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const outDir = path.resolve(process.argv[3] ?? 'app/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});

const sizes = [
  { name: 'desktop', width: 1600, height: 1000 },
  { name: 'mobile', width: 500, height: 900 },
];

for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const sections = await page.$$eval('section[data-phase]', (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.id, mid: r.top + window.scrollY + r.height / 2 };
    }),
  );
  for (let i = 0; i < sections.length; i++) {
    const y = Math.max(0, sections[i].mid - size.height / 2);
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(2600);
    const file = path.join(outDir, `${size.name}_${i}_${sections[i].id}.png`);
    await page.screenshot({ path: file });
    console.log('WROTE', file);
  }
  const hasCanvas = await page.$('canvas');
  console.log(size.name, 'canvas:', !!hasCanvas);
  console.log(logs.slice(0, 15).join('\n'));
  await page.close();
}
await browser.close();
