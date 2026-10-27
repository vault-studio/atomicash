// Une motor, entrada y render: paso fijo a 60 Hz y render a la tasa del monitor con interpolación.
import type { Ticker } from 'pixi.js';
import { RUN } from '../config/run';
import type { StatSurvivorId } from '../config/survivors';
import { STAT_ENEMY_IDS } from '../config/enemies';
import { advance, createFixedStep } from '../engine/loop';
import { spawnEnemy } from '../engine/systems/enemies';
import { setView } from '../engine/view';
import type { InputState } from '../engine/types';
import { createWorld, killPlayer, tick } from '../engine/world';
import { InputManager } from '../input';
import { screenToWorldDir } from '../render/iso';
import { GameRenderer } from '../render/renderer';
import { sprites } from '../render/sprites';

/** Móvil (puntero grueso) en vertical. Es la misma condición que muestra el aviso `.rotate` en CSS. */
export const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)';

export interface RunSession {
  dispose(): void;
}

export async function startRun(host: HTMLElement, charId: StatSurvivorId, seed: number): Promise<RunSession> {
  await sprites.load();
  const world = createWorld(charId, seed);
  const renderer = await GameRenderer.create(host, sprites, world);
  const controls = new InputManager(host);
  const fs = createFixedStep(RUN.tickHz, RUN.maxStepsPerFrame);
  const input: InputState = { moveX: 0, moveY: 0 };
  // Solo horizontal (04_ART_UI.md §3): en un móvil en vertical la run se congela tras el aviso de giro.
  const portrait = window.matchMedia(PORTRAIT_QUERY);

  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'F3') {
      e.preventDefault();
      renderer.toggleDebug();
    } else if (e.code === 'KeyK' && import.meta.env.DEV) {
      // Depuración: probar la animación de muerte.
      killPlayer(world);
    } else if (e.code === 'KeyJ' && import.meta.env.DEV) {
      // Depuración: 100 enemigos en anillo para medir rendimiento (el spawning real llega en F1-05).
      const p = world.player;
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 350 + Math.random() * 250;
        const type = STAT_ENEMY_IDS[(Math.random() * STAT_ENEMY_IDS.length) | 0] ?? 'dron';
        spawnEnemy(world, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
    }
  };
  window.addEventListener('keydown', onKey);

  let fps = 60;
  const onTick = (ticker: Ticker): void => {
    const frameSec = ticker.deltaMS / 1000;
    let steps = 0;
    if (portrait.matches) {
      controls.release();
      fs.acc = 0;
      renderer.render(world, 1, { fps, steps });
      return;
    }
    const view = renderer.viewHalfExtent();
    setView(world, view.halfW, view.halfH);
    const alpha = advance(fs, frameSec, (dt) => {
      const d = controls.read();
      const m = screenToWorldDir(d.x, d.y);
      input.moveX = m.x;
      input.moveY = m.y;
      tick(world, input, dt);
      steps++;
    });
    if (frameSec > 0) fps += (1 / frameSec - fps) * 0.1;
    renderer.render(world, alpha, { fps, steps });
  };
  renderer.app.ticker.add(onTick);

  return {
    dispose() {
      window.removeEventListener('keydown', onKey);
      renderer.app.ticker.remove(onTick);
      controls.dispose();
      renderer.destroy();
    },
  };
}
