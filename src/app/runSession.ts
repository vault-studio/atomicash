// Une motor, entrada y render: paso fijo a 60 Hz y render a la tasa del monitor con interpolación.
import type { Ticker } from 'pixi.js';
import { RUN } from '../config/run';
import type { StatSurvivorId } from '../config/survivors';
import { advance, createFixedStep } from '../engine/loop';
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
