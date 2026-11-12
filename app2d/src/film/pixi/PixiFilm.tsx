import { useEffect, useRef, type MutableRefObject } from 'react';
import { Application, Container } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { cameraAt, peelAt } from '../camera';
import { buildWorld, type World } from './world';

/**
 * WebGL (PixiJS v8) version of the film: the same world and camera as the SVG film,
 * drawn on the GPU, with a bloom pass on the emissive layer (pipes, windows, LEDs, flow).
 * If the renderer cannot start, `onFail` lets the app fall back to the SVG film.
 */
export function PixiFilm({ cameraT, onFail }: { cameraT: MutableRefObject<number>; onFail: () => void }) {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let app: Application | null = null;
    let world: World | null = null;
    const bloomOn = new URLSearchParams(window.location.search).get('bloom') !== '0';

    (async () => {
      try {
        // make sure the fonts used by Pixi text are ready before drawing
        await Promise.race([
          Promise.all([
            document.fonts.load('600 12px "IBM Plex Mono"'),
            document.fonts.load('700 18px Archivo'),
          ]),
          new Promise((r) => setTimeout(r, 1800)),
        ]).catch(() => undefined);

        const a = new Application();
        await a.init({
          background: '#05070b',
          antialias: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          autoDensity: true,
          resizeTo: el,
          preference: 'webgl',
          powerPreference: 'high-performance',
        });
        if (disposed) {
          a.destroy(true, { children: true });
          return;
        }
        app = a;
        el.appendChild(a.canvas);
        a.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

        world = buildWorld();
        const glowScreen = new Container();
        glowScreen.addChild(world.glow);
        a.stage.addChild(world.base, glowScreen);

        let bloom: AdvancedBloomFilter | null = null;
        if (bloomOn) {
          bloom = new AdvancedBloomFilter({ threshold: 0.35, bloomScale: 1.15, brightness: 1, blur: 8, quality: 6 });
          glowScreen.filters = [bloom];
          glowScreen.filterArea = a.screen;
          glowScreen.blendMode = 'add';
        }

        let t = 0;
        let time = 0;
        let slow = 0;
        a.ticker.add((tk) => {
          const dt = Math.min(0.1, tk.deltaMS / 1000);
          time += dt;
          t += (cameraT.current - t) * 0.14;
          if (Math.abs(cameraT.current - t) < 0.0005) t = cameraT.current;

          const cam = cameraAt(t);
          const peel = peelAt(t);
          document.documentElement.style.setProperty('--peel', peel.toFixed(3));
          cam.w *= 1 - 0.14 * peel;
          cam.y += 34 * peel;
          cam.x -= 10 * peel;

          const W = a.screen.width;
          const H = a.screen.height;
          const h = cam.w * 0.5625; // keep the landscape vertical framing
          const s = H / h;
          const ox = W / 2 - cam.x * s;
          const oy = H / 2 - cam.y * s;
          world!.base.scale.set(s);
          world!.base.position.set(ox, oy);
          world!.glow.scale.set(s);
          world!.glow.position.set(ox, oy);
          world!.update(t, time, dt, peel, cam.x);

          // performance watchdog: drop bloom if the GPU cannot keep up
          if (bloom) {
            slow = tk.deltaMS > 34 ? slow + 1 : Math.max(0, slow - 1);
            if (slow > 90) {
              glowScreen.filters = [];
              glowScreen.blendMode = 'add';
              bloom = null;
              console.warn('[film] bloom disabled: frame time too high');
            }
          }
        });
        el.dataset.renderer = 'pixi';
      } catch (err) {
        console.warn('[film] PixiJS failed, using the SVG film:', err);
        if (!disposed) onFail();
      }
    })();

    return () => {
      disposed = true;
      world?.destroy();
      app?.destroy(true, { children: true });
      app = null;
      world = null;
    };
  }, [cameraT, onFail]);

  return <div ref={host} className="film film--pixi" aria-label="DataCool loop: rack to city" role="img" />;
}
