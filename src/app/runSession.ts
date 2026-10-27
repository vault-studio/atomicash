// Une motor, entrada y render: paso fijo a 60 Hz y render a la tasa del monitor con interpolación.
// La UI (React) recibe una foto del estado 10 veces por segundo y las elecciones al abrirse.
import type { Ticker } from 'pixi.js';
import { audio } from '../audio/audio';
import { AUDIO } from '../config/audio';
import { STAT_ENEMY_IDS, type StatEnemyId } from '../config/enemies';
import type { ConsumableId, ItemId } from '../config/items';
import { radTier } from '../config/radiation';
import { RUN } from '../config/run';
import type { WeaponId } from '../config/weapons';
import { advance, createFixedStep } from '../engine/loop';
import { spawnEnemy } from '../engine/systems/enemies';
import { applyChoice, gainXp, reroll, consumeItem } from '../engine/systems/progression';
import { spawnBoss } from '../engine/systems/spawning';
import type { Banner, Choice, InputState, World } from '../engine/types';
import { SFX, SFX_COUNT, type SfxId } from '../engine/sfx';
import { setView } from '../engine/view';
import {
  createWorld,
  currentDps,
  killPlayer,
  results,
  tick,
  type RunResults,
  type WorldOptions,
} from '../engine/world';
import type { StatSurvivorId } from '../config/survivors';
import i18n from '../i18n';
import { InputManager } from '../input';
import { screenToWorldDir } from '../render/iso';
import { GameRenderer } from '../render/renderer';
import { sprites } from '../render/sprites';

/** Móvil (puntero grueso) en vertical. Es la misma condición que muestra el aviso `.rotate` en CSS. */
export const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  rad: number;
  radColor: string;
  xp: number;
  xpNext: number;
  level: number;
  time: number;
  kills: number;
  dps: number;
  weapons: { id: WeaponId; lvl: number }[];
  cons: Record<ConsumableId, number>;
  item: ItemId | null;
  rerolls: number;
  boss: { id: StatEnemyId; frac: number } | null;
  banners: Banner[];
  rain: boolean;
  storm: boolean;
}

export interface RunCallbacks {
  onHud: (s: HudSnapshot) => void;
  onChoice: (c: Choice | null) => void;
  onEnd: (r: RunResults) => void;
}

export interface RunSettings {
  showDamage: boolean;
  reduceMotion: boolean;
}

const SFX_NAMES = Object.keys(SFX) as SfxId[];

/** Hace sonar lo que el motor contó desde el último fotograma y el chasquido del Geiger según la RAD. */
function createSoundTap(): (w: World, frameSec: number) => void {
  const prev = new Int32Array(SFX_COUNT);
  let geiger = 0;
  return (w, frameSec) => {
    for (let i = 0; i < SFX_COUNT; i++) {
      const n = w.sfx[i]! - prev[i]!;
      if (n > 0) audio.play(SFX_NAMES[i]!, 0.6 + n * 0.1);
      prev[i] = w.sfx[i]!;
    }
    geiger += frameSec * AUDIO.geigerRate * (w.player.rad / 100) * (0.5 + Math.random());
    if (geiger >= 1) {
      geiger = 0;
      audio.play('geiger');
    }
    audio.setMusic(w.bossAlive > 0 ? 'boss' : 'run');
  };
}

export interface RunSession {
  readonly world: World;
  choose(i: number): void;
  reroll(): void;
  consume(i: number): void;
  setPaused(p: boolean): void;
  apply(settings: RunSettings): void;
  dispose(): void;
}

export interface RunOptions extends WorldOptions {
  charId: StatSurvivorId;
  seed: number;
  settings: RunSettings;
}

function snapshot(w: World): HudSnapshot {
  let boss: HudSnapshot['boss'] = null;
  if (w.bossAlive > 0) {
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.boss && !e.dead) boss = { id: e.type, frac: Math.max(0, e.hp / e.maxHp) };
    }
  }
  return {
    hp: Math.max(0, w.player.hp),
    maxHp: w.player.maxHp,
    rad: w.player.rad,
    radColor: radTier(w.player.rad).color,
    xp: w.xp,
    xpNext: w.xpNext,
    level: w.level,
    time: w.time,
    kills: w.kills,
    dps: currentDps(w),
    weapons: w.weapons.map((x) => ({ id: x.id, lvl: x.lvl })),
    cons: { ...w.cons },
    item: w.item,
    rerolls: w.rerolls,
    boss,
    banners: w.banners.slice(),
    rain: w.rain > 0,
    storm: w.storm,
  };
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
  let ended = false;
  let lastChoice: Choice | null = null;
  let hudAcc = 1;
  const sound = createSoundTap();

  const apply = (s: RunSettings): void => {
    renderer.showDamage = s.showDamage;
    renderer.reduceMotion = s.reduceMotion;
    world.showDmg = s.showDamage;
  };
  apply(opts.settings);

  const syncChoice = (): void => {
    if (world.choice !== lastChoice) {
      lastChoice = world.choice;
      if (world.choice) audio.play(world.choice.type === 'item' ? 'chest' : 'level');
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
    // Consumibles: teclas 5–8 (y Q/E/Z/X para no estirar la mano).
    const ci = ['Digit5', 'Digit6', 'Digit7', 'Digit8'].indexOf(e.code);
    if (ci >= 0 && !paused) {
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
        const type = STAT_ENEMY_IDS[(Math.random() * 11) | 0] ?? 'dron';
        spawnEnemy(world, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
    } else if (e.code === 'KeyL') gainXp(world, world.xpNext - world.xp, true);
    else if (e.code === 'KeyG') p.god = !p.god;
    else if (e.code === 'KeyB') {
      const next = (['rey_rata', 'dirigible', 'coloso'] as const).find((k) => !world.bossSpawned[k]);
      if (next) spawnBoss(world, next);
    } else if (e.code === 'KeyT') world.time += 60;
  };
  window.addEventListener('keydown', onKey);

  let fps = 60;
  const onTick = (ticker: Ticker): void => {
    const frameSec = ticker.deltaMS / 1000;
    let steps = 0;
    const frozen = portrait.matches || paused || world.choice !== null || ended;
    if (frozen) {
      if (portrait.matches) controls.release();
      fs.acc = 0;
      renderer.render(world, 1, { fps, steps });
      syncChoice();
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
    renderer.render(world, world.choice ? 1 : alpha, { fps, steps });
    sound(world, frameSec);
    syncChoice();
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
  // Depuración: acceso al mundo desde la consola del navegador (solo en desarrollo).
  if (import.meta.env.DEV) (window as unknown as { __world?: World }).__world = world;

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
    consume(i) {
      consumeItem(world, i);
      cb.onHud(snapshot(world));
    },
    setPaused(p) {
      paused = p;
      if (p) controls.release();
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
