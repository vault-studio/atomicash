// Une motor, entrada y render: paso fijo a 60 Hz y render a la tasa del monitor con interpolación.
// La UI (React) recibe una foto del estado 10 veces por segundo y las elecciones al abrirse.
import type { Ticker } from 'pixi.js';
import { audio } from '../../audio/audio';
import { MOB_IDS } from '../../config/enemies';
import { RUN } from '../../config/run';
import { advance, createFixedStep } from '../../engine/loop';
import { CAMPAIGN } from '../../config/acts';
import { advanceAct } from '../../engine/systems/campaign';
import { spawnEnemy } from '../../engine/systems/enemies';
import {
  applyChoice,
  banishCard,
  consumeItem,
  gainXp,
  lockCard,
  reroll,
} from '../../engine/systems/progression';
import { putBomb } from '../../engine/systems/mirror';
import { startDownpour } from '../../engine/systems/rains';
import { announceHorde, spawnBoss, spawnElite } from '../../engine/systems/spawning';
import type { Choice, Enemy, InputState, World } from '../../engine/types';
import { setView } from '../../engine/view';
import { createWorld, killPlayer, results, tick } from '../../engine/world';
import i18n from '../../i18n';
import { InputManager } from '../../input';
import { screenToWorldDir } from '../../render/iso';
import { GameRenderer } from '../../render/renderer';
import { sprites } from '../../render/sprites';
import { snapshot } from './snapshot';
import { createSoundTap } from './sound';
import {
  PORTRAIT_QUERY,
  type RunCallbacks,
  type RunOptions,
  type RunSession,
  type RunSettings,
} from './types';

/** Primer enemigo vivo de tipo `type`. */
function findAlive(w: World, type: Enemy['type']): Enemy | null {
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (!e.dead && e.type === type) return e;
  }
  return null;
}

export async function startRun(host: HTMLElement, opts: RunOptions, cb: RunCallbacks): Promise<RunSession> {
  // Los Text de Pixi miden la fuente al crearse: hay que tenerla cargada antes.
  await Promise.all([sprites.load(), document.fonts.load('700 14px "Pixelify Sans"').catch(() => [])]);
  const world = createWorld(opts.charId, opts.seed, opts);
  const renderer = await GameRenderer.create(host, sprites, world, (k) => i18n.t(k));
  const controls = new InputManager(host);
  const fs = createFixedStep(RUN.tickHz, RUN.maxStepsPerFrame);
  const input: InputState = { moveX: 0, moveY: 0 };
  // Solo horizontal (04_ART_UI.md §3): en un móvil en vertical la run se congela tras el aviso de giro.
  const portrait = window.matchMedia(PORTRAIT_QUERY);
  let paused = false;
  let speed = 1;
  let ended = false;
  /** Segundos que le quedan a la cinemática de victoria (o de derrota). */
  let victoryLeft = 0;
  /** El jugador ha muerto con el Coloso en el mapa: su cinemática de victoria cierra la run. */
  let defeat = false;
  let lastChoice: Choice | null = null;
  let hudAcc = 1;
  const sound = createSoundTap();

  const apply = (s: RunSettings): void => {
    renderer.showDamage = s.showDamage;
    renderer.reduceMotion = s.reduceMotion;
    renderer.setOldScreen(s.crt);
    world.showDmg = s.showDamage;
  };
  apply(opts.settings);

  const syncChoice = (): void => {
    if (world.choice !== lastChoice) {
      lastChoice = world.choice;
      if (world.choice)
        audio.play(
          world.choice.type === 'level' ? 'level' : world.choice.type === 'endless' ? 'win' : 'chest',
        );
      cb.onChoice(world.choice);
      hudAcc = 1;
    }
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'F3') {
      e.preventDefault();
      renderer.toggleDebug();
      return;
    }
    // Consumibles: teclas 1–4. Con una elección abierta esas teclas son de las tarjetas.
    const ci = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (ci >= 0 && !paused && !world.choice) {
      consumeItem(world, ci);
      hudAcc = 1;
      return;
    }
    if (!import.meta.env.DEV) return;
    // Depuración (solo en desarrollo; DECISIÓN: no pasa por i18n).
    const p = world.player;
    if (e.code === 'KeyK') killPlayer(world);
    else if (e.code === 'KeyJ') {
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 350 + Math.random() * 250;
        const type = MOB_IDS[(Math.random() * MOB_IDS.length) | 0] ?? 'dron';
        spawnEnemy(world, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
    } else if (e.code === 'KeyL') gainXp(world, world.xpNext - world.xp, true);
    else if (e.code === 'KeyG') p.god = !p.god;
    else if (e.code === 'KeyB') {
      const boss = CAMPAIGN.acts[world.act].boss;
      if (!world.bossSpawned[boss]) spawnBoss(world, boss);
    } else if (e.code === 'KeyT') world.time += 60;
    else if (e.code === 'KeyE') spawnElite(world);
    else if (e.code === 'KeyH') announceHorde(world);
    else if (e.code === 'KeyN') startDownpour(world);
    else if (e.code === 'KeyM') putBomb(world, p.x + p.facingX * 120, p.y + p.facingY * 120);
    else if (e.code === 'KeyY') advanceAct(world);
  };
  window.addEventListener('keydown', onKey);

  /**
   * La elección se enseña cuando no hay cinemática de victoria pendiente ni en marcha, o cuando su animación ya
   * terminó: la máquina de cupones sale después de verla entera, no en el mismo fotograma en que se recoge.
   */
  const choiceReady = (): boolean => !world.victory && (victoryLeft <= 0 || renderer.victoryHolding);

  let fps = 60;
  const onTick = (ticker: Ticker): void => {
    const frameSec = ticker.deltaMS / 1000;
    let steps = 0;
    // Muerte con el Coloso en el mapa (le haya dado él el último golpe o no): el mundo se para y él celebra con la
    // cinemática de los cofres. Al acabar su animación la cámara se queda en él y sale el resumen.
    if (!defeat && !ended && world.player.deadAt !== null) {
      const boss = findAlive(world, 'coloso');
      if (boss) {
        defeat = true;
        world.hitStop = 0;
        victoryLeft = renderer.startDefeat(boss);
        cb.onHud(snapshot(world));
      }
    }
    if (defeat && !ended && victoryLeft > 0) {
      if (!portrait.matches && !paused) {
        victoryLeft = renderer.stepVictory(frameSec, true);
        if (renderer.victoryHolding) {
          victoryLeft = 0;
          world.over = true;
        }
      }
      fs.acc = 0;
      renderer.render(world, 1, { fps, steps });
      sound(world, frameSec);
      if (!world.over) return;
    }
    // Cinemática de victoria (máquina de cupones recogida): el mundo se para mientras el personaje la hace. Al acabar
    // la animación sale la máquina y la cámara sigue cerca hasta cobrarla; luego vuelve al zoom normal.
    if (!portrait.matches && !paused && !ended && (victoryLeft > 0 || world.victory)) {
      if (world.victory) {
        world.victory = false;
        world.hitStop = 0;
        victoryLeft = renderer.startVictory(world.charId);
        audio.play('victory');
      }
      victoryLeft = renderer.stepVictory(frameSec, world.choice?.type === 'cache');
      fs.acc = 0;
      renderer.render(world, 1, { fps, steps });
      sound(world, frameSec);
      if (choiceReady()) syncChoice();
      return;
    }
    const frozen = portrait.matches || paused || world.choice !== null || ended;
    // Congelación de impacto (golpe gordo, jefe abatido): el mundo se para un instante pero se sigue dibujando.
    if (!frozen && world.hitStop > 0) {
      world.hitStop -= frameSec;
      fs.acc = 0;
      renderer.render(world, 1, { fps, steps });
      sound(world, frameSec);
      return;
    }
    if (frozen) {
      if (portrait.matches) controls.release();
      fs.acc = 0;
      renderer.render(world, 1, { fps, steps });
      if (choiceReady()) syncChoice();
      return;
    }
    const view = renderer.viewHalfExtent();
    setView(world, view.halfW, view.halfH);
    const alpha = advance(fs, frameSec * speed, (dt) => {
      if (!opts.inputOverride?.(world, input)) {
        const d = controls.read();
        const m = screenToWorldDir(d.x, d.y);
        input.moveX = m.x;
        input.moveY = m.y;
      }
      tick(world, input, dt);
      steps++;
    });
    if (frameSec > 0) fps += (1 / frameSec - fps) * 0.1;
    renderer.render(world, world.choice ? 1 : alpha, { fps, steps });
    sound(world, frameSec);
    if (choiceReady()) syncChoice();
    hudAcc += frameSec;
    if (hudAcc >= 0.1) {
      hudAcc = 0;
      cb.onHud(snapshot(world));
    }
    if (world.over && !ended) {
      ended = true;
      controls.release();
      audio.setMusic(null);
      audio.play(world.won ? 'win' : 'death');
      cb.onHud(snapshot(world));
      cb.onEnd(results(world));
    }
  };
  renderer.app.ticker.add(onTick);
  cb.onHud(snapshot(world));
  // Depuración: acceso al mundo desde la consola del navegador (solo en desarrollo). Se fija en cada frame porque el
  // doble montaje de StrictMode crea dos sesiones y la descartada podía quedarse con la referencia.
  if (import.meta.env.DEV)
    renderer.app.ticker.add(() => ((window as unknown as { __world?: World }).__world = world));

  return {
    world,
    choose(i) {
      applyChoice(world, i);
      syncChoice();
    },
    reroll() {
      reroll(world);
      lastChoice = null;
      syncChoice();
    },
    banish(i) {
      banishCard(world, i);
      syncChoice();
    },
    lock(i) {
      lockCard(world, i);
      syncChoice();
    },
    consume(i) {
      consumeItem(world, i);
      cb.onHud(snapshot(world));
    },
    setPaused(p) {
      paused = p;
      audio.setPaused(p);
      if (p) controls.release();
    },
    setSpeed(mult) {
      speed = Math.max(0, mult);
    },
    spawnColossus() {
      if (ended || world.player.deadAt !== null) return;
      spawnBoss(world, 'coloso');
    },
    apply,
    dispose() {
      window.removeEventListener('keydown', onKey);
      renderer.app.ticker.remove(onTick);
      audio.setMusic('menu');
      controls.dispose();
      renderer.destroy();
    },
  };
}
