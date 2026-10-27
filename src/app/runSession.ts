// Une motor, entrada y render: paso fijo a 60 Hz y render a la tasa del monitor con interpolación.
import type { Ticker } from 'pixi.js';
import { RUN } from '../config/run';
import type { StatSurvivorId } from '../config/survivors';
import { advance, createFixedStep } from '../engine/loop';
import type { InputState } from '../engine/types';
import { createWorld, killPlayer, tick } from '../engine/world';
import { KeyboardInput } from '../input/keyboard';
import { screenToWorldDir } from '../render/iso';
import { GameRenderer } from '../render/renderer';
import { sprites } from '../render/sprites';

export interface RunSession {
  dispose(): void;
}

export async function startRun(host: HTMLElement, charId: StatSurvivorId, seed: number): Promise<RunSession> {
  await sprites.load();
  const world = createWorld(charId, seed);
  const renderer = await GameRenderer.create(host, sprites, world);
  const keyboard = new KeyboardInput();
  const fs = createFixedStep(RUN.tickHz, RUN.maxStepsPerFrame);
  const input: InputState = { moveX: 0, moveY: 0 };

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
    const alpha = advance(fs, frameSec, (dt) => {
      const d = keyboard.read();
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
      keyboard.dispose();
      renderer.destroy();
    },
  };
}
