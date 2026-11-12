// Probe the live three.js scene at a given scroll phase.
//   node tools/probe.mjs http://127.0.0.1:4173/ 7
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const wantPhase = Number(process.argv[3] ?? 7);

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

const sections = await page.$$eval('section[data-phase]', (els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.id, mid: r.top + window.scrollY + r.height / 2 };
  }),
);
const target = sections.find((s) => Number(String(s.id).split('_')[1]) === wantPhase) ?? sections[wantPhase] ?? sections[0];
console.log('sections:', JSON.stringify(sections));
await page.evaluate((top) => window.scrollTo(0, top), Math.max(0, target.mid - 500));
await page.waitForTimeout(3000);

const probe = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  const fk = Object.keys(canvas).find((k) => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
  if (!fk) return { error: 'no react fiber key', keys: Object.keys(canvas).slice(0, 10) };
  let fiber = canvas[fk];
  while (fiber.return) fiber = fiber.return;
  const out = { found: true };
  let cur = fiber;
  let depth = 0;
  while (cur && depth < 60) {
    const sn = cur.stateNode;
    if (sn && sn.store && sn.store.getState) {
      const state = sn.store.getState();
      out.cameraPos = state.camera && state.camera.position ? state.camera.position.toArray() : null;
      const scene = state.scene;
      if (scene) {
        out.sceneChildren = scene.children.map(function (c) { return c.name || c.type; }).slice(0, 40);
        const d = scene.getObjectByName('district__baked');
        if (d) {
          out.district = { visible: d.visible, parentVisible: d.parent ? d.parent.visible : null, childCount: d.children.length, type: d.type };
          let mesh = d.isMesh ? d : null;
          d.traverse(function (c) { if (!mesh && c.isMesh) mesh = c; });
          if (mesh) {
            const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            out.districtMaterial = { type: m && m.type, color: m && m.color ? m.color.getHexString() : null, emissive: m && m.emissive ? m.emissive.getHexString() : null, emissiveIntensity: m ? m.emissiveIntensity : null, opacity: m ? m.opacity : null, transparent: m ? m.transparent : null, hasMap: !!(m && m.map), fog: m ? m.fog : null };
            mesh.geometry.computeBoundingBox();
            const bb = mesh.geometry.boundingBox;
            out.districtBounds = bb ? { min: bb.min.toArray(), max: bb.max.toArray() } : null;
          }
          const wp = new state.camera.position.constructor();
          d.getWorldPosition(wp);
          out.districtWorldPos = wp.toArray();
        } else {
          out.district = 'NOT FOUND';
        }
      }
      break;
    }
    cur = cur.return;
    depth++;
  }
  if (!out.cameraPos) out.note = 'store not found';
  return out;
});
console.log('probe:', JSON.stringify(probe, null, 2));
console.log('--- logs ---');
console.log(logs.slice(0, 30).join(' | '));
await browser.close();