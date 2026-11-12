import { useEffect, useRef } from 'react';

/**
 * 2.5D coin jar: a tiny home-made 2D rigid-body sim (gravity, wall + coin collisions,
 * restitution, friction) drawn as flat-shaded "3D" coins: each coin flips about a horizontal
 * axis (squashed ellipse + visible edge thickness) and settles at a random lean.
 * `count` is the target number of coins; coins rain in when it grows and pop out when it shrinks.
 * Written from scratch (no dependency); dragging the pointer across the jar nudges coins,
 * clicking shakes it.
 */

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number; // in-plane angle
  w: number; // angular velocity
  tilt: number; // flip angle about the horizontal axis (foreshortening)
  rest: number; // tilt it settles at
  born: number;
  dying: number; // >0 while fading out
}

const G = 1500; // px/s²
const E_WALL = 0.38;
const E_COIN = 0.3;
const MAX = 64; // roughly a full jar

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function CoinJar({ count, paid, label }: { count: number; paid: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const target = useRef(0);
  const paidRef = useRef(paid);
  target.current = Math.max(0, Math.min(MAX, Math.round(count)));
  paidRef.current = paid;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = rng(97);
    let W = 220;
    let H = 330;
    let dpr = 1;
    const coins: Coin[] = [];
    let last = 0;
    let acc = 0;
    let spawnAcc = 0;
    let raf = 0;
    let visible = true;
    const pointer = { x: -999, y: -999, vx: 0, vy: 0, on: false };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth || 220;
      H = canvas.clientHeight || 330;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const bounds = () => ({ l: 16, r: W - 16, floor: H - 16, top: 40 });

    const spawn = (instant = false) => {
      const b = bounds();
      const r = 11 + rand() * 3.5;
      const c: Coin = {
        x: b.l + r + rand() * (b.r - b.l - 2 * r),
        y: instant ? b.floor - r - rand() * 120 : -r - rand() * 30,
        vx: (rand() - 0.5) * 120,
        vy: instant ? 0 : 80 + rand() * 120,
        r,
        a: (rand() - 0.5) * 1.2,
        w: (rand() - 0.5) * 7,
        tilt: rand() * Math.PI,
        rest: (rand() < 0.65 ? 1 : -1) * (0.15 + rand() * 0.45) + (rand() < 0.2 ? 0.9 : 0),
        born: performance.now(),
        dying: 0,
      };
      coins.push(c);
    };

    const step = (dt: number) => {
      const b = bounds();
      for (const c of coins) {
        c.vy += G * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.a += c.w * dt;
        c.w *= 1 - 0.8 * dt;
        c.vx *= 1 - 0.15 * dt;
        // walls + floor
        if (c.x < b.l + c.r) {
          c.x = b.l + c.r;
          c.vx = Math.abs(c.vx) * E_WALL;
        } else if (c.x > b.r - c.r) {
          c.x = b.r - c.r;
          c.vx = -Math.abs(c.vx) * E_WALL;
        }
        if (c.y > b.floor - c.r) {
          c.y = b.floor - c.r;
          if (c.vy > 40) c.vy = -c.vy * E_WALL;
          else c.vy = 0;
          c.vx *= 0.92; // floor friction
          c.w *= 0.9;
        }
        // flip about the horizontal axis while moving, settle when slow
        const speed = Math.hypot(c.vx, c.vy);
        if (speed > 90) c.tilt += (speed / 120 + Math.abs(c.w) * 0.3) * dt * 4;
        else {
          const k = 1 - Math.exp(-dt * 7);
          const wrapped = ((c.tilt % Math.PI) + Math.PI) % Math.PI;
          const goal = c.rest < 0 ? Math.PI + c.rest : c.rest;
          c.tilt = wrapped + (goal - wrapped) * k; // ease the folded angle toward its resting lean
        }
        // pointer nudge
        if (pointer.on) {
          const dx = c.x - pointer.x;
          const dy = c.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 46 && d > 0.01) {
            const f = (1 - d / 46) * 900 * dt;
            c.vx += (dx / d) * f + pointer.vx * 0.02;
            c.vy += (dy / d) * f + pointer.vy * 0.02;
          }
        }
      }
      // coin / coin collisions (3 relaxation passes)
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < coins.length; i++) {
          for (let j = i + 1; j < coins.length; j++) {
            const p = coins[i];
            const q = coins[j];
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const min = (p.r + q.r) * 0.96;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const push = (min - d) / 2;
            p.x -= nx * push;
            p.y -= ny * push;
            q.x += nx * push;
            q.y += ny * push;
            const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
            if (vn < 0) {
              const imp = (-(1 + E_COIN) * vn) / 2;
              p.vx -= imp * nx;
              p.vy -= imp * ny;
              q.vx += imp * nx;
              q.vy += imp * ny;
              // light tangential friction + spin transfer
              const tx = -ny;
              const ty = nx;
              const vt = (q.vx - p.vx) * tx + (q.vy - p.vy) * ty;
              const fr = vt * 0.04;
              p.vx += tx * fr;
              p.vy += ty * fr;
              q.vx -= tx * fr;
              q.vy -= ty * fr;
              p.w += vt * 0.002;
              q.w -= vt * 0.002;
            }
          }
        }
      }
    };

    const drawCoin = (c: Coin, now: number) => {
      const grow = Math.min(1, (now - c.born) / 220);
      const fade = c.dying > 0 ? Math.max(0, 1 - (now - c.dying) / 260) : 1;
      const r = c.r * (0.5 + 0.5 * grow) * (c.dying > 0 ? 1 + (1 - fade) * 0.4 : 1);
      const cs = Math.max(0.2, Math.abs(Math.cos(c.tilt)));
      const facing = Math.cos(c.tilt) >= 0;
      const thick = r * 0.26 * (1 - cs * 0.55);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.a);
      // soft contact shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, thick + 2, r * 0.98, r * cs * 0.98, 0, 0, Math.PI * 2);
      ctx.fill();
      // edge (thickness)
      ctx.fillStyle = '#9a6a1a';
      ctx.beginPath();
      ctx.ellipse(0, thick, r, r * cs, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-r, 0, r * 2, thick);
      ctx.beginPath();
      ctx.fillStyle = '#b8801f';
      ctx.ellipse(0, thick, r, r * cs, 0, 0, Math.PI);
      ctx.fill();
      // face
      ctx.save();
      ctx.scale(1, cs);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, facing ? '#fff3b0' : '#f3d27a');
      g.addColorStop(0.55, '#ffc94a');
      g.addColorStop(1, '#d99a24');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.strokeStyle = '#f4b73a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,70,0,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
      ctx.stroke();
      if (facing) {
        ctx.fillStyle = '#b97d18';
        ctx.font = `700 ${Math.round(r * 1.05)}px Archivo, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, r * 0.04);
      }
      ctx.restore();
      ctx.restore();
    };

    const drawJar = () => {
      const b = bounds();
      // back glass
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, 'rgba(255,255,255,0.07)');
      bg.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      bg.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(b.l - 6, b.top, b.r - b.l + 12, b.floor - b.top + 8, 14);
      ctx.fill();
    };
    const drawGlassFront = () => {
      const b = bounds();
      ctx.lineWidth = 2;
      ctx.strokeStyle = paidRef.current ? 'rgba(92,224,160,0.9)' : 'rgba(180,196,230,0.55)';
      if (paidRef.current) {
        ctx.shadowColor = 'rgba(92,224,160,0.8)';
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.roundRect(b.l - 6, b.top, b.r - b.l + 12, b.floor - b.top + 8, 14);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // glass highlights
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(b.l + 2, b.top + 14, 7, (b.floor - b.top) * 0.6, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(b.r - 12, b.top + 30, 4, (b.floor - b.top) * 0.35, 2);
      ctx.fill();
      // rim
      ctx.strokeStyle = 'rgba(210,222,250,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.l - 10, b.top);
      ctx.lineTo(b.r + 10, b.top);
      ctx.stroke();
    };

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        last = 0;
        return;
      }
      if (!last) last = time;
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;

      // reconcile the coin count with the target
      const alive = coins.filter((c) => c.dying === 0).length;
      const want = target.current;
      if (alive < want) {
        spawnAcc += dt * Math.max(10, (want - alive) * 3);
        while (spawnAcc >= 1 && coins.filter((c) => c.dying === 0).length < want) {
          spawnAcc -= 1;
          spawn();
        }
      } else if (alive > want) {
        let extra = alive - want;
        coins
          .filter((c) => c.dying === 0)
          .sort((p, q) => p.y - q.y)
          .forEach((c) => {
            if (extra-- > 0) c.dying = time;
          });
      }
      for (let i = coins.length - 1; i >= 0; i--) if (coins[i].dying && time - coins[i].dying > 260) coins.splice(i, 1);

      acc += dt;
      let n = 0;
      while (acc >= 1 / 120 && n++ < 8) {
        step(1 / 120);
        acc -= 1 / 120;
      }

      // collisions can shove coins through the glass: clamp them back inside
      {
        const b = bounds();
        for (const c of coins) {
          c.x = Math.min(b.r - c.r, Math.max(b.l + c.r, c.x));
          c.y = Math.min(b.floor - c.r, c.y);
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawJar();
      const order = [...coins].sort((p, q) => p.y - q.y);
      for (const c of order) drawCoin(c, time);
      drawGlassFront();
    };

    // reduced motion: start with the pile already settled, no animation loop work
    if (reduced) {
      for (let i = 0; i < target.current; i++) spawn(true);
      for (let i = 0; i < 360; i++) step(1 / 120);
      for (const c of coins) c.tilt = c.rest < 0 ? Math.PI + c.rest : c.rest;
    }
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)), { threshold: 0.05 });
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      pointer.vx = x - pointer.x;
      pointer.vy = y - pointer.y;
      pointer.x = x;
      pointer.y = y;
      pointer.on = true;
    };
    const onLeave = () => {
      pointer.on = false;
    };
    const onClick = () => {
      for (const c of coins) {
        c.vy -= 380 + rand() * 260;
        c.vx += (rand() - 0.5) * 260;
        c.w += (rand() - 0.5) * 8;
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div className="fc-jar">
      <canvas ref={ref} className="fc-jar-canvas" aria-hidden="true" />
      <p className="fc-jar-label">{label}</p>
    </div>
  );
}
