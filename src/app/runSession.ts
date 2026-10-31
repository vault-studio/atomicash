// Une motor, entrada y render: paso fijo a 60 Hz y render a la tasa del monitor con interpolación.
// La UI (React) recibe una foto del estado 10 veces por segundo y las elecciones al abrirse.
import type { Ticker } from 'pixi.js';
import { audio, type MusicState } from '../audio/audio';
import { AUDIO } from '../config/audio';
import {
  BOSS_PHASES,
  ELITES,
  MOB_IDS,
  type BossKind,
  type EliteId,
  type StatEnemyId,
} from '../config/enemies';
import type { ConsumableId, ItemId } from '../config/items';
import { radTier } from '../config/radiation';
import { PLAYER, RUN, streakMult } from '../config/run';
import type { HordeKind } from '../config/waves';
import type { DailyMod, ObjectiveKind } from '../config/modes';
import type { WeaponId } from '../config/weapons';
import { advance, createFixedStep } from '../engine/loop';
import { spawnEnemy } from '../engine/systems/enemies';
import {
  applyChoice,
  banishCard,
  consumeItem,
  gainXp,
  lockCard,
  reroll,
} from '../engine/systems/progression';
import { announceHorde, spawnBoss, spawnElite } from '../engine/systems/spawning';
import type { Banner, Choice, Enemy, InputState, World } from '../engine/types';
import { SFX, SFX_COUNT, type SfxId } from '../engine/sfx';
import { isOnScreen, isoX, isoY, setView } from '../engine/view';
import {
  createWorld,
  currentDps,
  killPlayer,
  results,
  tick,
  type RunResults,
  type WorldOptions,
} from '../engine/world';
import { weaponSlots, type StatSurvivorId } from '../config/survivors';
import i18n from '../i18n';
import { InputManager } from '../input';
import { screenToWorldDir } from '../render/iso';
import { GameRenderer } from '../render/renderer';
import { sprites } from '../render/sprites';

/** Móvil (puntero grueso) en vertical. Es la misma condición que muestra el aviso `.rotate` en CSS. */
export const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)';

export interface HudSnapshot {
  charId: StatSurvivorId;
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
  /** Huecos de arma: los del personaje más los ganados con los minijefes. */
  slots: number;
  cons: Record<ConsumableId, number>;
  items: ItemId[];
  rerolls: number;
  /** Jefe vivo: vida, fase y fracciones donde cambia de fase (marcas de la barra). */
  boss: { id: StatEnemyId; frac: number; phase: number; marks: readonly number[] } | null;
  /** Último élite golpeado, mientras dura su barra. */
  elite: { id: StatEnemyId; prefix: EliteId; frac: number } | null;
  /** Horda avisada: dirección de pantalla (unitaria) y fracción de la cuenta atrás que queda. */
  horde: { kind: HordeKind; sx: number; sy: number; left: number } | null;
  streak: number;
  streakMult: number;
  /** Objetivo del mapa: progreso, tiempo que queda y dirección de pantalla si está fuera de la vista. */
  objective: {
    kind: ObjectiveKind;
    progress: number;
    goal: number;
    left: number;
    dir: { sx: number; sy: number } | null;
  } | null;
  /** Minutos jugados en el modo infinito, o null. */
  endless: number | null;
  dailyMod: DailyMod | null;
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
  /** Filtro de pantalla vieja sobre el juego. */
  crt: boolean;
}

const SFX_NAMES = Object.keys(SFX) as SfxId[];

/** Intensidad de la partida para la música por capas: enemigos en pantalla, hordas y élites. */
function musicState(w: World): MusicState {
  const L = AUDIO.layers;
  let onScreen = 0;
  let elite = false;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    if (e.elite) elite = true;
    if (isOnScreen(w, e.x, e.y)) onScreen++;
  }
  const intensity = Math.min(1, onScreen / L.fullAt + (w.horde ? L.horde : 0) + (elite ? L.elite : 0));
  return {
    intensity,
    streak: streakMult(w.streak) > 1,
    lowHp: w.player.hp < w.player.maxHp * L.lowHp && w.player.deadAt === null,
  };
}

/** Hace sonar lo que el motor contó desde el último fotograma y el chasquido del Geiger según la RAD. */
function createSoundTap(): (w: World, frameSec: number) => void {
  const prev = new Int32Array(SFX_COUNT);
  let geiger = 0;
  return (w, frameSec) => {
    for (let i = 0; i < SFX_COUNT; i++) {
      const n = w.sfx[i]! - prev[i]!;
      prev[i] = w.sfx[i]!;
      if (n <= 0) continue;
      // Colocado en el estéreo según dónde pasó respecto al jugador en la pantalla (isométrica), en pantallas.
      const ox = w.sfxX[i]! - w.player.x;
      const oy = w.sfxY[i]! - w.player.y;
      const dx = isoX(ox, oy) / (w.view.halfW || 1);
      const dy = isoY(ox, oy) / (w.view.halfH || 1);
      audio.play(SFX_NAMES[i]!, n, dx, Math.sqrt(dx * dx + dy * dy));
    }
    geiger += frameSec * AUDIO.geigerRate * (w.player.rad / 100) * (0.5 + Math.random());
    if (geiger >= 1) {
      geiger = 0;
      audio.play('geiger');
    }
    audio.setMusic(w.bossAlive > 0 ? 'boss' : 'run');
    audio.setMusicState(musicState(w));
  };
}

export interface RunSession {
  readonly world: World;
  choose(i: number): void;
  reroll(): void;
  banish(i: number): void;
  lock(i: number): void;
  consume(i: number): void;
  setPaused(p: boolean): void;
  /** Fase de test: saca al Coloso cerca del jugador. */
  spawnColossus(): void;
  apply(settings: RunSettings): void;
  dispose(): void;
}

export interface RunOptions extends WorldOptions {
  charId: StatSurvivorId;
  seed: number;
  settings: RunSettings;
}

function objectiveSnap(w: World): HudSnapshot['objective'] {
  const o = w.objective;
  if (!o) return null;
  let dir: { sx: number; sy: number } | null = null;
  if (!isOnScreen(w, o.x, o.y, -o.r * 0.5)) {
    const sx = isoX(o.x - w.player.x, o.y - w.player.y);
    const sy = isoY(o.x - w.player.x, o.y - w.player.y);
    const l = Math.hypot(sx, sy) || 1;
    dir = { sx: sx / l, sy: sy / l };
  }
  return { kind: o.kind, progress: o.progress, goal: o.goal, left: o.left, dir };
}

function snapshot(w: World): HudSnapshot {
  let boss: HudSnapshot['boss'] = null;
  let elite: HudSnapshot['elite'] = null;
  const showElite = w.time - w.eliteFocusAt < ELITES.barTime;
  if (w.bossAlive > 0 || showElite) {
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.dead) continue;
      if (e.boss)
        boss = {
          id: e.type,
          frac: Math.max(0, e.hp / e.maxHp),
          phase: e.phase,
          marks: BOSS_PHASES[e.type as BossKind] ?? [],
        };
      else if (showElite && e.elite && e.id === w.eliteFocus)
        elite = { id: e.type, prefix: e.elite, frac: Math.max(0, e.hp / e.maxHp) };
    }
  }
  let horde: HudSnapshot['horde'] = null;
  if (w.horde) {
    const sx = isoX(w.horde.ax, w.horde.ay);
    const sy = isoY(w.horde.ax, w.horde.ay);
    const l = Math.hypot(sx, sy) || 1;
    horde = { kind: w.horde.kind, sx: sx / l, sy: sy / l, left: w.horde.t };
  }
  return {
    charId: w.charId,
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
    slots: weaponSlots(w.charId, PLAYER.weaponSlots),
    cons: { ...w.cons },
    items: [...w.items],
    rerolls: w.rerolls,
    boss,
    elite,
    horde,
    objective: objectiveSnap(w),
    endless: w.endless ? (w.time - w.endlessAt) / 60 : null,
    dailyMod: w.dailyMod,
    streak: w.streak,
    streakMult: streakMult(w.streak),
    banners: w.banners.slice(),
    rain: w.rain > 0,
    storm: w.storm,
  };
}

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
        const type = MOB_IDS[(Math.random() * MOB_IDS.length) | 0] ?? 'dron';
        spawnEnemy(world, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
    } else if (e.code === 'KeyL') gainXp(world, world.xpNext - world.xp, true);
    else if (e.code === 'KeyG') p.god = !p.god;
    else if (e.code === 'KeyB') {
      const next = (['rey_rata', 'dirigible', 'coloso'] as const).find((k) => !world.bossSpawned[k]);
      if (next) spawnBoss(world, next);
    } else if (e.code === 'KeyT') world.time += 60;
    else if (e.code === 'KeyE') spawnElite(world);
    else if (e.code === 'KeyH') announceHorde(world);
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
