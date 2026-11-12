import { Container, Graphics, GraphicsContext, Sprite, Text, Texture } from 'pixi.js';
import { WORLD, win } from '../camera';
import { canvasTexture, clamp01, hex, makePath, pathAt, rng, roundedPoints, type P, type Path } from './util';

/* ---------------------------------------------------------------- constants */

const COLD = 0x7c8bff;
const HOT = 0xff6b57;
const AMBER = 0xffb45c;
const GROUND = WORLD.groundY;
const RACK_W = 220;
const RACK_H = 560;
const RACK_XS = [150, 410, 670, 930, 1190];
const SUP_Y = 70;
const RET_Y = 104;
const PLANT = { x: 1520, y: 240, w: 940 };
const EXCH = { x: 1760, y: 370, w: 360, h: 320 };
const PLATES = 34;
const STEP = 8.6;
const px = (i: number) => 34 + i * STEP;
const TAU = Math.PI * 2;

const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
const SANS = 'Archivo, ui-sans-serif, system-ui, sans-serif';

export interface World {
  /** unlit art, transformed by the camera */
  base: Container;
  /** emissive art (bloomed), transformed by the camera */
  glow: Container;
  /** parallax groups need the camera centre */
  update(t: number, time: number, dt: number, peel: number, camX: number): void;
  destroy(): void;
}

/* ---------------------------------------------------------------- helpers */

function txt(
  str: string,
  x: number,
  y: number,
  size: number,
  fill: number,
  opts: { mono?: boolean; weight?: string; spacing?: number; anchor?: number } = {},
): Text {
  const t = new Text({
    text: str,
    style: {
      fontFamily: opts.mono ? MONO : SANS,
      fontSize: size,
      fontWeight: (opts.weight ?? (opts.mono ? '500' : '700')) as '500',
      fill,
      letterSpacing: opts.spacing ?? 0,
    },
  });
  t.resolution = 4;
  t.anchor.set(opts.anchor ?? 0, 0.5);
  t.position.set(x, y);
  return t;
}

function rect(g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: number, alpha = 1, stroke?: [number, number, number?]) {
  if (r > 0) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
  g.fill({ color: fill, alpha });
  if (stroke) {
    if (r > 0) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
    g.stroke({ width: stroke[1], color: stroke[0], alpha: stroke[2] ?? 1 });
  }
}

/* ---------------------------------------------------------------- the world */

export function buildWorld(): World {
  const base = new Container();
  const glow = new Container();
  const disposables: (() => void)[] = [];
  const updaters: ((t: number, time: number, dt: number, peel: number, camX: number) => void)[] = [];

  // textures
  const DOT = canvasTexture(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  const SKY = canvasTexture(4, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#05070b');
    g.addColorStop(0.55, '#0d1220');
    g.addColorStop(0.9, '#1b1a2b');
    g.addColorStop(1, '#3a2326');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
  });
  const SOIL = canvasTexture(4, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#20180f');
    g.addColorStop(0.18, '#15100b');
    g.addColorStop(1, '#0a0806');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
  });
  const HORIZON = canvasTexture(256, 128, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,138,77,0.55)');
    g.addColorStop(0.5, 'rgba(184,71,47,0.14)');
    g.addColorStop(1, 'rgba(184,71,47,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  });
  const gapTex = (top: string, bottom: string) =>
    canvasTexture(4, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 64);
    });
  const GAP_HOT = gapTex('#ff6b57', '#b98ab0');
  const GAP_CITY = gapTex('#ffb45c', '#7c8bff');
  const PLATE_FLOW = canvasTexture(64, 4, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,107,87,0.3)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(124,139,255,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 4);
  });
  disposables.push(() => [DOT, SKY, SOIL, HORIZON, GAP_HOT, GAP_CITY, PLATE_FLOW].forEach((t) => t.destroy(true)));

  const dot = (layer: Container, x: number, y: number, size: number, color: number, alpha = 1): Sprite => {
    const s = new Sprite(DOT);
    s.anchor.set(0.5);
    s.width = s.height = size;
    s.tint = color;
    s.alpha = alpha;
    s.position.set(x, y);
    layer.addChild(s);
    return s;
  };
  const box = (layer: Container, x: number, y: number, w: number, h: number, color: number, alpha = 1): Sprite => {
    const s = new Sprite(Texture.WHITE);
    s.position.set(x, y);
    s.width = w;
    s.height = h;
    s.tint = color;
    s.alpha = alpha;
    layer.addChild(s);
    return s;
  };

  /* ------------------------------ sky, stars, skyline, ground ------------------------------ */
  const sky = new Sprite(SKY);
  sky.position.set(-2600, -1600);
  sky.width = 9200;
  sky.height = GROUND + 1600;
  base.addChild(sky);

  const starLayer = new Container();
  {
    const r = rng(31);
    for (let i = 0; i < 260; i++) {
      const s = new Sprite(DOT);
      s.anchor.set(0.5);
      s.position.set(-1800 + r() * 8200, -1400 + r() * 1700);
      s.width = s.height = (0.6 + r() * 1.6) * 3;
      s.alpha = 0.25 + r() * 0.65;
      s.tint = 0xdfe6ff;
      starLayer.addChild(s);
    }
  }
  base.addChild(starLayer);

  const dusk = new Sprite(HORIZON);
  dusk.anchor.set(0.5, 1);
  dusk.position.set(2300, GROUND);
  dusk.width = 7600;
  dusk.height = 1800;
  base.addChild(dusk);

  const skyline = (seed: number, color: number, h0: number): Graphics => {
    const g = new Graphics();
    const r = rng(seed);
    let x = -2400;
    g.moveTo(x, GROUND);
    while (x < 8400) {
      const w = 60 + r() * 120;
      const h = h0 * (0.4 + r() * 0.9);
      g.lineTo(x, GROUND - h).lineTo(x + w, GROUND - h);
      x += w;
    }
    g.lineTo(x, GROUND).closePath().fill(color);
    return g;
  };
  const far1 = new Container();
  far1.addChild(skyline(3, 0x0b0f17, 380));
  const far2 = new Container();
  far2.addChild(skyline(9, 0x0f1520, 250));
  base.addChild(far1, far2);

  const soil = new Sprite(SOIL);
  soil.position.set(-2600, GROUND);
  soil.width = 9200;
  soil.height = 2700;
  base.addChild(soil);
  {
    const g = new Graphics();
    [790, 860, 1010, 1120, 1210].forEach((y, i) => {
      g.moveTo(-2600, y).bezierCurveTo(-400 + i * 300, y - 18, 1800, y + 20, 6600, y - 8);
      g.stroke({ width: 2, color: 0xffffff, alpha: 0.035 });
    });
    rect(g, -2600, GROUND - 4, 9200, 12, 0, 0x1b2430);
    rect(g, -2600, GROUND - 4, 9200, 2, 0, 0xffffff, 0.08);
    base.addChild(g);
  }

  /* ------------------------------ city ------------------------------ */
  const cityBase = new Container();
  const cityGlow = new Container();
  base.addChild(cityBase);
  glow.addChild(cityGlow);
  interface Lit {
    s: Sprite;
    w: number;
    b: number;
  }
  const lit: Lit[] = [];
  const thr: number[] = [];
  {
    const r = rng(7);
    const tones = [0x10161f, 0x131a25, 0x0f141c, 0x161d29];
    let x = 2620;
    let bi = 0;
    while (x < 5150) {
      const w = 90 + r() * 80;
      const tall = r() < 0.32;
      const h = tall ? 320 + r() * 230 : 130 + r() * 170;
      const cols = Math.max(2, Math.floor((w - 16) / 22));
      const rows = Math.max(2, Math.floor((h - 24) / 28));
      const seed = Math.floor(r() * 1e6);
      const tone = tones[Math.floor(r() * tones.length)];
      const g = new Graphics();
      rect(g, x, GROUND - h, w, h, 3, tone, 1, [0x222c3b, 1.5]);
      rect(g, x + w * 0.18, GROUND - h - 14, w * 0.3, 14, 0, 0x222c3b);
      if (bi % 3 === 0) rect(g, x + w * 0.74, GROUND - h - 34, 3, 34, 0, 0x3a4759);
      rect(g, x + w / 2 - 9, GROUND - 26, 18, 26, 2, 0x0a0e14);
      const wr = rng(seed);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = x + 12 + col * ((w - 24) / cols) + 3;
          const wy = GROUND - h + 16 + row * 28;
          rect(g, wx, wy, 10, 15, 1.5, 0x1c2634);
          const s = box(cityGlow, wx, wy, 10, 15, 0xffd08a, 0);
          lit.push({ s, w: wr() * 0.55, b: bi });
        }
      }
      cityBase.addChild(g);
      thr.push((x - 2620) / 2550);
      x += w + 26 + r() * 40;
      bi++;
    }
    // trees + lamps
    const tr = rng(11);
    const t = new Graphics();
    for (let i = 0; i < 34; i++) {
      const tx = 2580 + i * 82 + tr() * 40;
      const s = 0.7 + tr() * 0.7;
      rect(t, tx - 3 * s, GROUND - 34 * s, 6 * s, 34 * s, 0, 0x2a2018);
      t.circle(tx, GROUND - 48 * s, 22 * s).fill(0x143124);
      t.circle(tx + 9 * s, GROUND - 40 * s, 15 * s).fill(0x1a3d2d);
    }
    for (let i = 0; i < 14; i++) {
      const lx = 2700 + i * 180;
      rect(t, lx - 1.5, GROUND - 60, 3, 60, 0, 0x3a4759);
      dot(cityGlow, lx, GROUND - 62, 34, AMBER, 0.5);
      dot(cityGlow, lx, GROUND - 62, 9, 0xffe3b0, 1);
    }
    cityBase.addChild(t);
  }

  // walkers
  interface Walker {
    c: Container;
    x: number;
    dx: number;
    dur: number;
    delay: number;
    scale: number;
    phase: number;
    limbs: { g: Graphics; swing: number; sign: number }[];
  }
  const walkers: Walker[] = [];
  {
    const r = rng(23);
    const SIL = 0x05070b;
    const limb = (w: number, h: number) => {
      const g = new Graphics();
      g.roundRect(-w / 2, 0, w, h, w / 2).fill(SIL);
      g.roundRect(-w / 2, 0, w, h, w / 2).stroke({ width: 0.5, color: 0x46546f, alpha: 0.55 });
      return g;
    };
    for (let i = 0; i < 22; i++) {
      const dir = r() < 0.5 ? 1 : -1;
      const len = 260 + r() * 240;
      const speed = 22 + r() * 12;
      const baseX = 2640 + (i / 22) * 2480 + (r() - 0.5) * 80;
      const scale = i % 7 === 3 ? 0.68 : 0.92 + r() * 0.2;
      const kind = Math.floor(r() * 4);
      const c = new Container();
      const person = new Container();
      const limbs: Walker['limbs'] = [];
      const addLimb = (w: number, h: number, y: number, swing: number, sign: number) => {
        const l = limb(w, h);
        l.position.set(0, y);
        person.addChild(l);
        limbs.push({ g: l, swing, sign });
      };
      addLimb(3.4, 14, -36, 24, -1);
      addLimb(4.4, 20, -20, 26, -1);
      const body = new Graphics();
      body.roundRect(-5.2, -38, 10.4, 19, 4.6).fill(SIL);
      body.roundRect(-5.2, -38, 10.4, 19, 4.6).stroke({ width: 0.5, color: 0x46546f, alpha: 0.55 });
      body.circle(0.8, -43.5, 5).fill(SIL);
      body.circle(0.8, -43.5, 5).stroke({ width: 0.5, color: 0x46546f, alpha: 0.55 });
      if (kind === 1) body.roundRect(-9, -37, 5, 13, 2.2).fill(SIL);
      if (kind === 2) body.moveTo(-4.5, -46).quadraticCurveTo(0, -53, 5, -46).closePath().fill(SIL);
      person.addChild(body);
      addLimb(4.4, 20, -20, 26, 1);
      addLimb(3.4, 14, -36, 24, 1);
      person.scale.set(scale);
      c.addChild(person);
      c.position.set(baseX, GROUND - 3);
      cityBase.addChild(c);
      walkers.push({ c, x: dir === 1 ? baseX : baseX + len, dx: dir * len, dur: len / speed, delay: -r() * (len / speed), scale, phase: r() * 0.9, limbs });
    }
  }
  updaters.push((t, time) => {
    const front = Math.max(0, (t - 5.9) / 2) * 1.2;
    const on = thr.map((th) => clamp01((front - th) * 5));
    for (const l of lit) l.s.alpha = clamp01((on[l.b] - l.w) * 5);
    for (const w of walkers) {
      const f = (((time - w.delay) / w.dur) % 1 + 1) % 1;
      w.c.x = w.x + w.dx * f;
      w.c.alpha = Math.min(1, f / 0.06, (1 - f) / 0.06);
      w.c.scale.x = w.dx < 0 ? -1 : 1;
      for (const l of w.limbs) l.g.rotation = (l.sign * l.swing * Math.sin(((time + w.phase) / 0.9) * TAU) * Math.PI) / 180;
    }
    cityBase.alpha = 1;
  });

  /* ------------------------------ pipes ------------------------------ */
  interface Flow {
    path: Path;
    sprites: Sprite[];
    dir: number;
    spacing: number;
    wrapper: Container;
  }
  const flows: Flow[] = [];
  const pipeBase = new Container();
  const pipeGlow = new Container();
  const SPEED = 70; // world units / second, constant
  const tmp: P = [0, 0];

  function makePipe(pts: P[], color: number, width: number, rev: boolean, r = 28, parentBase = pipeBase, parentGlow = pipeGlow) {
    const samples = roundedPoints(pts, r);
    const halo = new Graphics();
    halo.moveTo(samples[0][0], samples[0][1]);
    for (const [x, y] of samples.slice(1)) halo.lineTo(x, y);
    const body = halo.clone();
    halo.stroke({ width: width + 9, color: 0x0b0e13, alpha: 0.92, cap: 'round', join: 'round' });
    body.stroke({ width, color, alpha: 0.3, cap: 'round', join: 'round' });
    const core = halo.clone();
    parentBase.addChild(halo, body);
    const coreG = new Graphics();
    coreG.moveTo(samples[0][0], samples[0][1]);
    for (const [x, y] of samples.slice(1)) coreG.lineTo(x, y);
    coreG.stroke({ width: width * 0.3, color, alpha: 0.72, cap: 'round', join: 'round' });
    parentGlow.addChild(coreG);
    core.destroy();
    const path = makePath(samples);
    const wrapper = new Container();
    const spacing = 26;
    const n = Math.max(2, Math.floor(path.length / spacing));
    const sprites: Sprite[] = [];
    for (let i = 0; i < n; i++) sprites.push(dot(wrapper, 0, 0, Math.max(5, width * 0.5), 0xffffff, 0.9));
    parentGlow.addChild(wrapper);
    flows.push({ path, sprites, dir: rev ? -1 : 1, spacing: path.length / n, wrapper });
    return wrapper;
  }

  const SUP_X0 = PLANT.x + 160;
  const mainPipes: Container[] = [];
  base.addChild(pipeBase);
  glow.addChild(pipeGlow);

  // overhead headers + drops + plant feed
  makePipe([[SUP_X0, SUP_Y], [RACK_XS[0] + 199.5, SUP_Y]], COLD, 16, true);
  makePipe([[RACK_XS[0] + 210.5, RET_Y], [SUP_X0, RET_Y]], HOT, 16, false);
  RACK_XS.forEach((x) => {
    makePipe([[x + 199.5, SUP_Y], [x + 199.5, GROUND - RACK_H + 36]], COLD, 7, true, 0);
    makePipe([[x + 210.5, GROUND - RACK_H + 36], [x + 210.5, RET_Y]], HOT, 7, false, 0);
  });
  makePipe([[SUP_X0, RET_Y], [1700, RET_Y], [1700, EXCH.y + 70], [EXCH.x - 8, EXCH.y + 70]], HOT, 16, false);
  makePipe([[EXCH.x - 8, EXCH.y + 250], [1650, EXCH.y + 250], [1650, SUP_Y], [SUP_X0, SUP_Y]], COLD, 16, true);
  // city loop
  mainPipes.push(makePipe([[EXCH.x + EXCH.w + 8, EXCH.y + 70], [2520, EXCH.y + 70], [2520, 900], [5250, 900]], AMBER, 22, false));
  makePipe([[5250, 960], [2420, 960], [2420, EXCH.y + 250], [EXCH.x + EXCH.w + 8, EXCH.y + 250]], COLD, 16, true);

  // branches into buildings (fade in with the city)
  const branchBase = new Container();
  const branchGlow = new Container();
  base.addChild(branchBase);
  glow.addChild(branchGlow);
  {
    const r = rng(7);
    let x = 2620;
    let bi = 0;
    while (x < 5150) {
      const w = 90 + r() * 80;
      const tall = r() < 0.32;
      void (tall ? 320 + r() * 230 : 130 + r() * 170);
      r();
      r();
      r(); // keep the same rng stream as the city above
      if (bi % 2 === 0) makePipe([[x + w / 2, 900], [x + w / 2, GROUND - 4]], AMBER, 9, false, 0, branchBase, branchGlow);
      x += w + 26 + r() * 40;
      bi++;
    }
  }
  // duct bank + warning tape
  {
    const g = new Graphics();
    rect(g, 2380, 872, 2900, 116, 22, 0x20262f, 0.45, [0x3a4452, 2]);
    for (let x = 2380; x < 5280; x += 44) g.rect(x, 798, 22, 4).fill({ color: 0xffd25c, alpha: 0.5 });
    for (let i = 0; i < 9; i++) rect(g, 2700 + i * 300, 846, 8, 26, 0, 0x3a4452);
    base.addChildAt(g, base.getChildIndex(pipeBase));
  }

  /* ------------------------------ plant ------------------------------ */
  const plantBase = new Container();
  base.addChild(plantBase);
  const steam: Sprite[] = [];
  let plantSign: Text | null = null;
  {
    const g = new Graphics();
    g.poly([PLANT.x - 20, PLANT.y + 10, PLANT.x + 20, PLANT.y - 20, PLANT.x + PLANT.w - 20, PLANT.y - 20, PLANT.x + PLANT.w + 20, PLANT.y + 10]).fill(0x0d1218);
    rect(g, PLANT.x, PLANT.y + 10, PLANT.w, GROUND - PLANT.y - 10, 0, 0x151c27, 1, [0x2a3443, 2]);
    rect(g, PLANT.x + 14, PLANT.y + 24, PLANT.w - 28, GROUND - PLANT.y - 38, 6, 0x0a0e14, 1, [0x1d2635, 1]);
    for (let i = 0; i < 9; i++) rect(g, PLANT.x + 50 + i * 98, PLANT.y + 36, 60, 9, 4, 0xdfe6ff, 0.22);
    rect(g, PLANT.x + 14, GROUND - 20, PLANT.w - 28, 6, 0, 0xffd25c, 0.55);
    [2230, 2290, 2350, 2410].forEach((x, i) => {
      rect(g, x, PLANT.y - 130, 22, 140, 3, 0x1c2431, 1, [0x34405a, 1]);
      box(glow, x, PLANT.y - 130, 22, 9, AMBER, 0.9);
      steam.push(dot(base, x + 11, PLANT.y - 150, 54, 0xc5cde0, 0.1));
      steam[i].alpha = 0.1;
    });
    plantBase.addChild(g);
    plantSign = txt('DATACOOL · ENERGY PLANT', PLANT.x + 28, PLANT.y + 78, 18, 0x56627a, { mono: true, weight: '600', spacing: 5.4 });
    plantBase.addChild(plantSign);
  }
  // pump
  const pumpBlades = new Container();
  {
    const c = new Container();
    c.position.set(1584, GROUND - 54);
    const g = new Graphics();
    rect(g, -30, 20, 60, 14, 3, 0x222b38);
    g.circle(0, 0, 26).fill(0x141a23);
    g.circle(0, 0, 26).stroke({ width: 2, color: 0x3a4759 });
    c.addChild(g);
    const bctx = new GraphicsContext().moveTo(0, 0).bezierCurveTo(8, -2, 18, -6, 20, -16).bezierCurveTo(10, -18, 2, -10, 0, 0).fill({ color: COLD, alpha: 0.75 });
    for (let a = 0; a < 4; a++) {
      const b = new Graphics(bctx);
      b.rotation = (a * Math.PI) / 2;
      pumpBlades.addChild(b);
    }
    c.addChild(pumpBlades);
    const hub = new Graphics().circle(0, 0, 5).fill(0xc3cde4);
    c.addChild(hub);
    plantBase.addChild(c);
  }
  // control cabinet
  {
    const c = new Container();
    c.position.set(2260, GROUND - 160);
    const g = new Graphics();
    rect(g, 0, 0, 150, 150, 6, 0x171d27, 1, [0x323f51, 2]);
    rect(g, 14, 14, 122, 54, 4, 0x06090e, 1, [0x3b4a60, 1]);
    rect(g, 14, 110, 122, 26, 3, 0x0f141b);
    c.addChild(g);
    c.addChild(txt('OUT', 24, 30, 8, 0x6b778f, { mono: true, spacing: 1.6 }));
    c.addChild(txt('IN', 84, 30, 8, 0x6b778f, { mono: true, spacing: 1.6 }));
    c.addChild(txt('84 °C', 24, 50, 19, 0xff8a73, { mono: true }));
    c.addChild(txt('41 °C', 84, 50, 19, 0x9fb0ff, { mono: true }));
    plantBase.addChild(c);
    for (let i = 0; i < 5; i++) dot(glow, 2260 + 26 + i * 24, GROUND - 160 + 92, 18, i === 3 ? 0xffb020 : 0x35ff8a, 0.9);
  }
  // gauges
  const needles: Graphics[] = [];
  [[1700, 220], [1650, 560]].forEach(([x, y]) => {
    const g = new Graphics();
    g.circle(x, y, 15).fill(0x0b0f15);
    g.circle(x, y, 15).stroke({ width: 2, color: 0x7b88a2 });
    base.addChild(g);
    const n = new Graphics();
    n.moveTo(0, 0).lineTo(8, -8).stroke({ width: 2, color: HOT, cap: 'round' });
    n.position.set(x, y);
    base.addChild(n);
    needles.push(n);
  });

  /* ------------------------------ racks ------------------------------ */
  interface Fan {
    c: Container;
    dur: number;
    off: number;
  }
  const fans: Fan[] = [];
  interface Blink {
    s: Sprite;
    phase: number;
  }
  const blinks: Blink[] = [];
  const pulses: Sprite[] = [];
  const rackBase = new Container();
  base.addChild(rackBase);
  {
    const bladeCtx = new GraphicsContext().moveTo(0, 0).bezierCurveTo(6, -4, 13, -9, 14, -17).bezierCurveTo(6, -15, 1, -9, 0, 0).fill(0x56627a);
    RACK_XS.forEach((rx) => {
      const rack = new Container();
      rack.position.set(rx, GROUND - RACK_H);
      const g = new Graphics();
      rect(g, 0, 0, RACK_W, RACK_H, 10, 0x171d27, 1, [0x2f3a4a, 2]);
      rect(g, 8, 8, RACK_W - 16, 22, 4, 0x0f141b);
      for (let i = 0; i < 8; i++) {
        const y = 40 + i * 62;
        rect(g, 10, y, 178, 54, 4, 0x0e1218, 1, [0x323f51, 1]);
        rect(g, 14, y + 5, 34, 44, 3, 0x1d2531);
        [18, 26, 34].forEach((sx) => rect(g, sx, y + 10, 3, 34, 1.5, 0x2e3a4b));
        [78, 122].forEach((cx) => {
          g.circle(rx * 0 + cx, y + 27, 20).fill(0x0b0f15);
          g.circle(cx, y + 27, 20).stroke({ width: 1.5, color: 0x3a4759 });
        });
        rect(g, 152, y + 12, 32, 30, 3, 0xa8642a, 1, [0xd99a5b, 1]);
        rect(g, 155, y + 15, 26, 24, 2, HOT, 0.55);
        g.moveTo(184, y + 20).lineTo(199, y + 20).stroke({ width: 3.4, color: COLD, cap: 'round' });
        g.moveTo(184, y + 34).lineTo(209, y + 34).stroke({ width: 3.4, color: HOT, cap: 'round' });
      }
      rect(g, 196, 36, 7, RACK_H - 76, 3.5, COLD, 0.55);
      rect(g, 207, 36, 7, RACK_H - 76, 3.5, HOT, 0.6);
      rect(g, 14, RACK_H - 24, RACK_W - 28, 10, 3, 0x0f141b);
      rect(g, 10, RACK_H, 20, 9, 2, 0x1d2531);
      rect(g, RACK_W - 30, RACK_H, 20, 9, 2, 0x1d2531);
      rack.addChild(g);
      rack.addChild(txt('DATACOOL', 18, 19, 10.5, 0x8a93a3, { mono: true, weight: '600', spacing: 2.5 }));
      for (let i = 0; i < 8; i++) {
        const y = 40 + i * 62;
        [78, 122].forEach((cx, k) => {
          const fan = new Container();
          fan.position.set(cx, y + 27);
          for (let a = 0; a < 5; a++) {
            const b = new Graphics(bladeCtx);
            b.rotation = (a * TAU) / 5;
            fan.addChild(b);
          }
          fan.addChild(new Graphics().circle(0, 0, 4.5).fill(0x8a97ae));
          rack.addChild(fan);
          fans.push({ c: fan, dur: 0.9 + ((i + k) % 3) * 0.12, off: i * 0.13 + k * 0.2 });
        });
        blinks.push({ s: dot(glow, rx + 42, GROUND - RACK_H + y + 44, 12, i % 3 === 1 ? 0xffb020 : 0x35ff8a, 1), phase: i * 0.27 });
        pulses.push(dot(glow, rx + 168, GROUND - RACK_H + y + 27, 26, HOT, 0.5));
      }
      blinks.push({ s: dot(glow, rx + RACK_W - 22, GROUND - RACK_H + 19, 12, 0x35ff8a, 1), phase: 0.3 });
      rackBase.addChild(rack);
    });
  }
  // heat waves
  const waves = new Container();
  const waveItems: { g: Graphics; off: number }[] = [];
  RACK_XS.forEach((rx, i) => {
    [0, 1, 2].forEach((k) => {
      const g = new Graphics();
      g.moveTo(0, 0);
      for (let y = 0; y >= -88; y -= 4) g.lineTo(12 * Math.sin((y / 44) * Math.PI), y);
      g.stroke({ width: 4, color: HOT, cap: 'round', join: 'round' });
      g.position.set(rx + 50 + k * 56, GROUND - RACK_H - 6);
      waves.addChild(g);
      waveItems.push({ g, off: i * 0.5 + k * 0.7 });
    });
  });
  glow.addChild(waves);

  /* ------------------------------ exchanger ------------------------------ */
  const exBase = new Container();
  const exGlow = new Container();
  exBase.position.set(EXCH.x, EXCH.y);
  exGlow.position.set(EXCH.x, EXCH.y);
  base.addChild(exBase);
  glow.addChild(exGlow);
  const exGhost = new Container();
  const exFrame = new Container();
  const exName = new Container();
  const exExplain = new Container();
  const exExplainGlow = new Container();
  const heatArrows = new Graphics();
  {
    const skid = new Graphics();
    rect(skid, -24, EXCH.h + 8, EXCH.w + 48, 14, 3, 0x222b38);
    exBase.addChild(skid);

    const gh = new Graphics();
    rect(gh, -10, -18, EXCH.w + 20, 10, 3, 0x9aa4b6);
    rect(gh, 0, 0, 30, EXCH.h, 8, 0xff8a3c, 1, [0xffb27a, 1]);
    [34, EXCH.h - 34].forEach((y) => {
      rect(gh, -8, y - 4, EXCH.w + 16, 8, 4, 0xd4dbe8);
      rect(gh, -18, y - 9, 14, 18, 3, 0x58637a);
    });
    [70, 250].forEach((y) => {
      rect(gh, -7, y - 20, 14, 40, 3, 0xd4dbe8);
      [-14, 0, 14].forEach((o) => gh.circle(0, y + o, 2.2).fill(0x58637a));
    });
    exGhost.addChild(gh);

    const fr = new Graphics();
    rect(fr, EXCH.w - 30, 0, 30, EXCH.h, 8, 0xff8a3c, 1, [0xffb27a, 1]);
    [34, EXCH.h - 34].forEach((y) => rect(fr, EXCH.w + 4, y - 9, 14, 18, 3, 0x58637a));
    [70, 250].forEach((y) => {
      rect(fr, EXCH.w - 7, y - 20, 14, 40, 3, 0xd4dbe8);
      [-14, 0, 14].forEach((o) => fr.circle(EXCH.w, y + o, 2.2).fill(0x58637a));
    });
    exFrame.addChild(fr);

    const pl = new Graphics();
    for (let i = 0; i < PLATES; i++) rect(pl, px(i), 14, 5, EXCH.h - 28, 1.5, i % 2 ? 0x8794ae : 0xbfc7d6);
    exBase.addChild(exGhost);
    exBase.addChild(pl);
    const flow = new Sprite(PLATE_FLOW);
    flow.position.set(34, 14);
    flow.width = EXCH.w - 68;
    flow.height = EXCH.h - 28;
    exBase.addChild(flow);
    exBase.addChild(exFrame);

    const np = new Graphics();
    rect(np, EXCH.w / 2 - 54, EXCH.h / 2 - 22, 108, 44, 4, 0x10151d, 1, [0xd9e0ee, 1, 0.5]);
    exName.addChild(np);
    exName.addChild(txt('DATACOOL', EXCH.w / 2, EXCH.h / 2 - 5, 17, 0xeef2fb, { weight: '700', spacing: 2.4, anchor: 0.5 }));
    exName.addChild(txt('PHE-72 · 96.4 %', EXCH.w / 2, EXCH.h / 2 + 12, 9.5, 0x8a93a3, { mono: true, spacing: 1.3, anchor: 0.5 }));
    exBase.addChild(exName);

    // explanation layer: alternating hot / city channels, counter-flow dots, heat arrows, labels
    const top = 20;
    const bottom = EXCH.h - 20;
    const gapDots: { s: Sprite; y0: number; dir: number; x: number }[] = [];
    for (let i = 0; i < PLATES - 1; i++) {
      const hot = i % 2 === 0;
      const gx = px(i) + 5;
      const s = new Sprite(hot ? GAP_HOT : GAP_CITY);
      s.position.set(gx, top);
      s.width = STEP - 5;
      s.height = bottom - top;
      s.alpha = 0.72;
      exExplain.addChild(s);
      const cx = gx + (STEP - 5) / 2;
      for (let k = 0; k < 14; k++) gapDots.push({ s: dot(exExplainGlow, cx, 0, 4.5, 0xffffff, 0.9), y0: k * 21.5, dir: hot ? 1 : -1, x: cx });
    }
    for (let i = 1; i < PLATES - 1; i++) {
      [90, 160, 230].forEach((y) => {
        const right = i % 2 === 1;
        const x = px(i) + 2.5;
        if (right) heatArrows.moveTo(x - 4, y).lineTo(x + 4, y).moveTo(x + 1, y - 3).lineTo(x + 4, y).lineTo(x + 1, y + 3);
        else heatArrows.moveTo(x + 4, y).lineTo(x - 4, y).moveTo(x - 1, y - 3).lineTo(x - 4, y).lineTo(x - 1, y + 3);
      });
    }
    heatArrows.stroke({ width: 1.4, color: 0xffe3b0, cap: 'round', join: 'round' });
    exExplainGlow.addChild(heatArrows);

    exExplain.addChild(txt('HOT LOOP · from the racks', px(1) - 4, -86, 11, 0x8a93a3, { mono: true, spacing: 1.5 }));
    exExplain.addChild(txt('84 °C in → 41 °C out', px(1) - 4, -62, 21, 0xff8a73, { weight: '700' }));
    exExplain.addChild(txt('CITY LOOP · to the homes', px(PLATES - 2) + 4, -44, 11, 0x8a93a3, { mono: true, spacing: 1.5, anchor: 1 }));
    exExplain.addChild(txt('38 °C in → 78 °C out', px(PLATES - 2) + 4, -26, 21, 0xffc27a, { weight: '700', anchor: 1 }));
    exExplain.addChild(txt('Counter-flow: two loops share a wall,', EXCH.w / 2, EXCH.h + 38, 17, 0xdfe6ff, { weight: '650', anchor: 0.5 }));
    exExplain.addChild(txt('not the water.', EXCH.w / 2, EXCH.h + 60, 17, 0xdfe6ff, { weight: '650', anchor: 0.5 }));
    const leaders = new Graphics();
    leaders.moveTo(px(1), -48).lineTo(px(1), top - 4).stroke({ width: 2, color: HOT });
    leaders.circle(px(1), top - 4, 3.4).fill(HOT);
    leaders.moveTo(px(PLATES - 2), -6).lineTo(px(PLATES - 2), top - 4).stroke({ width: 2, color: AMBER });
    leaders.circle(px(PLATES - 2), top - 4, 3.4).fill(AMBER);
    exExplain.addChild(leaders);
    exBase.addChild(exExplain);
    exGlow.addChild(exExplainGlow);

    updaters.push((_t, time, _dt, peel) => {
      exGhost.alpha = 1 - peel * 0.82;
      flow.alpha = (1 - peel) * (0.55 + 0.45 * Math.sin(time * 1.6));
      exFrame.x = peel * 96;
      exFrame.alpha = 1 - peel * 0.92;
      exName.alpha = 1 - peel;
      exExplain.alpha = peel;
      exExplainGlow.alpha = peel;
      exExplain.visible = exExplainGlow.visible = peel > 0.002;
      if (peel > 0.002) {
        heatArrows.alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 4));
        const len = bottom - top;
        for (const d of gapDots) {
          const f = (((time * 60 * d.dir + d.y0) % len) + len) % len;
          d.s.y = top + f;
        }
      }
    });
  }

  /* ------------------------------ per-frame updates ------------------------------ */
  const rest = new Container(); // keeps references alive for destroy
  base.addChild(rest);

  updaters.push((t, time, dt, peel, camX) => {
    // parallax
    far1.x = (camX - 2300) * (1 - 0.78);
    far2.x = (camX - 2300) * (1 - 0.58);
    dusk.alpha = 0.55 + 0.45 * win(t, 5.6, 9, 0.8);
    if (plantSign) plantSign.alpha = 1 - peel;
    starLayer.alpha = 1;
    branchBase.alpha = branchGlow.alpha = win(t, 5.2, 9, 0.8);
    waves.alpha = Math.max(0, 1 - t / 0.9) * 0.55;
    waves.visible = waves.alpha > 0.01;
    if (waves.visible) {
      for (const w of waveItems) {
        const f = (((time * 0.4 + w.off) % 1) + 1) % 1;
        w.g.y = GROUND - RACK_H - 6 - f * 70;
        w.g.alpha = Math.min(1, f * 6, (1 - f) * 3);
      }
    }
    for (const f of fans) f.c.rotation = (((time + f.off) % f.dur) / f.dur) * TAU;
    pumpBlades.rotation = ((time % 0.9) / 0.9) * TAU;
    for (const b of blinks) b.s.alpha = ((time + b.phase) % 2.2) / 2.2 < 0.5 ? 1 : 0.25;
    for (let i = 0; i < pulses.length; i++) pulses[i].alpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(time * 2.4 + i));
    steam.forEach((s, i) => {
      const k = 0.5 + 0.5 * Math.sin(time * 1.5 + i);
      s.alpha = 0.06 + 0.07 * k;
      s.y = PLANT.y - 150 - k * 14;
    });
    needles.forEach((n, i) => (n.rotation = (0.35 + 0.3 * Math.sin(time * 0.9 + i)) * 1.4));
    // flow dots: constant speed along each path
    const adv = SPEED * dt;
    for (const fl of flows) {
      if (!fl.wrapper.visible || fl.wrapper.parent?.alpha === 0) continue;
      fl.spacing = fl.path.length / fl.sprites.length;
      const base0 = (((time * SPEED * fl.dir) % fl.path.length) + fl.path.length) % fl.path.length;
      for (let i = 0; i < fl.sprites.length; i++) {
        const s = (base0 + i * fl.spacing) % fl.path.length;
        pathAt(fl.path, s, tmp);
        fl.sprites[i].position.set(tmp[0], tmp[1]);
      }
    }
    void adv;
  });

  return {
    base,
    glow,
    update(t, time, dt, peel, camX) {
      for (const u of updaters) u(t, time, dt, peel, camX);
    },
    destroy() {
      base.destroy({ children: true });
      glow.destroy({ children: true });
      disposables.forEach((d) => d());
    },
  };
}

export { hex };
