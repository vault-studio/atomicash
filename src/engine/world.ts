// Estado de la run y tick(dt). TS puro: sin React, DOM ni Pixi.
import type { ActId } from '../config/acts';
import type { ConsumableId, ItemId } from '../config/items';
import { ELITES, ENEMY_RULES, ENEMY_STATS, type EnemyStats } from '../config/enemies';
import { RAD, radTier } from '../config/radiation';
import { CAPS, CREDITS, FX, JUICE, PLAYER, PRESSURE, RUN, SUMMARY, xpForLevel } from '../config/run';
import { survivorStats, type StatSurvivorId, type SurvivorStats } from '../config/survivors';
import type { StatKey } from '../config/traits';
import { TREE_FX, type TreeMod } from '../config/tree';
import { OBJECTIVES, RAINS, type DailyMod } from '../config/modes';
import { DAMAGE_SOURCES, type WeaponId } from '../config/weapons';
import { EVENTS, HORDES, SPAWN } from '../config/waves';
import { refreshHazards } from './hazards';
import { blockCircle, createObstacleGrid, refreshObstacles } from './obstacles';
import { banner, createBeam, createBoom, createParticle, createText, updateFx } from './fx';
import { Pool } from './pool';
import { createRng } from './rng';
import { iceSlowAt } from './scars';
import { tickStun } from './rules';
import { createRunStats, hurtIndex, noteHurt, samplePressure, surroundedBy } from './runStats';

const sectorOcc = new Uint8Array(32);
import { SpatialHash } from './spatialHash';
import { createStats, recalc } from './stats';
import { addRad, createPickup, heal, resolveBlasts } from './systems/combat';
import {
  compactEnemies,
  createBullet,
  createEnemy,
  createSlime,
  createTele,
  updateEnemies,
  updateEnemyBullets,
  updateSlimes,
  updateTelegraphs,
} from './systems/enemies';
import { createMirror, updateMirror } from './systems/mirror';
import { createBarrel, updateBarrels, updateObjective } from './systems/modes';
import { updateDownpour } from './systems/rains';
import { updatePickups } from './systems/progression';
import { updateSpawning } from './systems/spawning';
import {
  createFirePool,
  createLob,
  createMine,
  createShot,
  createWeapon,
  updateFirePools,
  updateBurns,
  updateLobs,
  updateMines,
  updateShots,
  updateWeapons,
} from './systems/weapons';
import type { Corpse, InputState, Point, World, Wreck } from './types';
import { defaultView } from './view';
import { SFX_COUNT } from './sfx';

export interface WorldOptions {
  /** Acto del mapa. Por defecto, el 1. */
  act?: ActId;
  /** Enemigos simultáneos antes de reciclar el más lejano. Por defecto, ENEMY_RULES.maxAlive. */
  maxEnemies?: number;
  /** Arma inicial distinta de la del superviviente (manuales del mercader, F3-04); null = sin armas. */
  startWeapon?: WeaponId | null;
  /** Bonus permanentes del taller y las estrellas (F3-03), sumados a los rasgos. */
  bonus?: Partial<Record<StatKey, number>>;
  /** Huecos de consumible: cuántos de cada uno lleva al empezar. */
  consumables?: Partial<World['cons']>;
  extraRerolls?: number;
  /** Mejoras del árbol de pasivas que no son rasgos. */
  mods?: Partial<Record<TreeMod, number>>;
  /** Reto diario: día UTC y modificador. */
  daily?: { day: string; mod: DailyMod };
  /** Charcos radiactivos y objetos (obstáculos, edificios) en el mapa (los tests los quitan para aislar sistemas). */
  hazards?: boolean;
}

const STAT_KEYS: readonly StatKey[] = [
  'dmg',
  'spd',
  'xp',
  'red',
  'armor',
  'regen',
  'mag',
  'dodge',
  'crit',
  'critDmg',
  'hp',
  'cd',
  'radDecay',
  'area',
  'pierce',
  'adren',
  'luck',
  'kb',
];

const createCorpse = (): Corpse => ({
  sprite: 'dron',
  x: 0,
  y: 0,
  facingX: 0,
  facingY: 1,
  t: 0,
  flying: false,
  irr: false,
});
const createWreck = (): Wreck => ({
  sprite: 'dron',
  x: 0,
  y: 0,
  t: 0,
  until: 0,
  seed: 0,
  flying: false,
  elite: false,
});
const createPoint = (): Point => ({ x: 0, y: 0 });

export function createWorld(charId: StatSurvivorId, seed: number, opts: WorldOptions = {}): World {
  const stats = survivorStats(charId);
  const M = RUN.mapSize;
  const c = M / 2;
  const maxEnemies = opts.maxEnemies ?? ENEMY_RULES.maxAlive;
  const rng = createRng(seed);
  const tr = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) tr[k] = opts.bonus?.[k] ?? 0;
  const startWeapon = opts.startWeapon === undefined ? (stats.weapon as WeaponId) : opts.startWeapon;
  const w: World = {
    seed,
    act: opts.act ?? 1,
    rng,
    fxRng: createRng(seed ^ 0x5bd1e995),
    charId,
    time: 0,
    ticks: 0,
    mapSize: M,
    player: {
      charId,
      x: c,
      y: c,
      prevX: c,
      prevY: c,
      r: PLAYER.radius,
      hp: stats.hp,
      maxHp: stats.hp,
      // Mirando hacia abajo en pantalla (fila S del sprite) en la vista isométrica.
      facingX: Math.SQRT1_2,
      facingY: Math.SQRT1_2,
      moving: false,
      deadAt: null,
      inv: 0,
      rad: 0,
      radPeak: 0,
      turbo: 0,
      nuka: 0,
      boots: 0,
      healBudget: 0,
      lastHit: -9,
      god: false,
      vx: 0,
      vy: 0,
      // -0 (vale 0) y no 0: así el campo nace decimal y V8 no cambia el mapa del jugador al primer aturdimiento.
      stun: -0,
      stunImmune: -0,
      rush: -0,
      radSaved: false,
    },
    st: createStats(),
    over: false,
    won: false,
    choice: null,
    pendingLevels: 0,
    rerolls: PLAYER.rerolls + (opts.extraRerolls ?? 0),
    mods: { ...opts.mods },
    banishes: opts.mods?.banish ?? 0,
    locks: opts.mods?.lock ?? 0,
    banished: new Set(),
    locked: null,
    tr,
    traitPicks: {},
    levelHistory: [],
    items: [],
    weapons: startWeapon ? [createWeapon(startWeapon)] : [],
    starter: startWeapon ?? null,
    cons: { ...PLAYER.startConsumables, ...opts.consumables },
    consUsed: 0,
    consStart: { ...PLAYER.startConsumables, ...opts.consumables },
    maxEnemies,
    enemies: new Pool(createEnemy, maxEnemies),
    enemyGrid: new SpatialHash(M, RUN.gridCell, maxEnemies),
    scratch: new Int32Array(ENEMY_RULES.maxNeighbors * 4),
    qWeapon: new Int32Array(1024),
    qChain: new Int32Array(128),
    qBlast: new Int32Array(512),
    blasts: new Pool(createPoint, 64),
    nextId: 1,
    spawnAcc: 0,
    view: defaultView(),
    shots: new Pool(createShot, 256),
    ebullets: new Pool(createBullet, 64),
    lobs: new Pool(createLob, 16),
    pools: new Pool(createFirePool, 64),
    mines: new Pool(createMine, 80),
    tele: new Pool(createTele, 48),
    rs: createRunStats(),
    slimes: new Pool(createSlime, SPAWN.maxSlime),
    hazards: [],
    hazardsOn: opts.hazards !== false,
    scars: new Map(),
    hazardCell: { i: Number.NaN, j: Number.NaN },
    obstacles: createObstacleGrid(),
    obstacleCell: { i: Number.NaN, j: Number.NaN },
    buildings: [],
    garrisoned: new Set(),
    garrisons: [],
    start: { x: c, y: c },
    pickups: new Pool(createPickup, 400),
    gemCount: 0,
    beams: new Pool(createBeam, 60),
    booms: new Pool(createBoom, 80),
    corpses: new Pool(createCorpse, 150),
    wrecks: new Pool(createWreck, FX.maxWrecks),
    texts: new Pool(createText, 120),
    parts: new Pool(createParticle, JUICE.parts.max),
    // Decimales de partida por lo mismo que `stun`: el primer valor real llega a media partida.
    hitStop: -0,
    victory: false,
    banners: [],
    xp: 0,
    level: 1,
    xpNext: xpForLevel(1),
    kills: 0,
    coupons: 0,
    dmgTotal: 0,
    maxHit: 0,
    peakDps: 0,
    peakKills5: 0,
    killRing: new Int32Array(SUMMARY.window),
    killSec: 0,
    timeDmg: [],
    timeKills: [],
    bossDmg: 0,
    dmgBy: new Float64Array(DAMAGE_SOURCES.length),
    dpsB: new Float64Array(16),
    dpsBucket: 0,
    bosses: 0,
    nextEvent: EVENTS.first,
    eventIdx: 0,
    rain: 0,
    storm: false,
    lastBossAt: -999.5,
    bossSpawned: {},
    bossAlive: 0,
    nextElite: ELITES.first,
    nextHorde: HORDES.first,
    mirror: createMirror(seed),
    barrels: new Pool(createBarrel, 24),
    barrelT: 3,
    objective: null,
    nextObjective: OBJECTIVES.first,
    downpour: null,
    nextDownpour: RAINS.times[0]!,
    downpourIdx: 0,
    objectiveIdx: 0,
    objectivesDone: 0,
    endless: false,
    endlessAt: 0,
    winTime: 0,
    daily: opts.daily?.day ?? null,
    dailyMod: opts.daily?.mod ?? null,
    hordeIdx: 0,
    horde: null,
    eliteFocus: -1,
    eliteFocusAt: -99,
    streak: 0,
    bestStreak: 0,
    shake: 0,
    showDmg: false,
    sfx: new Int32Array(SFX_COUNT),
    sfxX: new Float32Array(SFX_COUNT),
    sfxY: new Float32Array(SFX_COUNT),
    sfxD: new Float32Array(SFX_COUNT),
    sfxT: new Float64Array(SFX_COUNT).fill(-1),
  };
  recalc(w);
  w.player.hp = w.st.maxHp;
  refreshHazards(w);
  refreshObstacles(w);
  return w;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Los pesados (rol `heavy`) ocupan espacio de verdad: el jugador no los atraviesa (CAMBIOS §4). El resto de enemigos
 * solo se separan entre sí, sin colisión con el jugador, para que las hordas sigan fluyendo.
 */
function blockByHeavies(w: World): void {
  const p = w.player;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead || e.flying || (ENEMY_STATS[e.type] as EnemyStats).role !== 'heavy') continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const min = p.r + e.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 1;
    p.x = e.x + (dx / d) * min;
    p.y = e.y + (dy / d) * min;
  }
}

function updatePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;
  p.vx = p.vy = 0;
  if (p.deadAt !== null) {
    p.moving = false;
    return;
  }
  tickStun(p, dt);
  // Aturdido: no se mueve ni dispara (las armas lo miran en `updateWeapons`).
  const mag = p.stun > 0 ? 0 : Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
  p.moving = mag > PLAYER.moveDeadzone;
  if (p.moving) {
    const ux = input.moveX / mag;
    const uy = input.moveY / mag;
    // Sobre una mancha de hielo de la nevera va más lento.
    const k = Math.min(1, mag) * w.st.speed * iceSlowAt(w, p.x, p.y) * dt;
    p.facingX = ux;
    p.facingY = uy;
    p.x += ux * k;
    p.y += uy * k;
    blockCircle(w, p, p.r, ux, uy, 1);
    blockByHeavies(w);
    p.vx = (p.x - p.prevX) / dt;
    p.vy = (p.y - p.prevY) / dt;
  }
  p.inv -= dt;
  p.turbo -= dt;
  p.rush -= dt;
  p.nuka -= dt;
  p.boots -= dt;
  p.healBudget = Math.min(CAPS.killHealPerSec, p.healBudget + CAPS.killHealPerSec * dt);
  if (w.st.regen > 0) heal(w, w.st.regen * dt);
}

function updateRadiation(w: World, dt: number): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  for (const h of w.hazards) {
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    if (dx * dx + dy * dy < h.r * h.r) {
      addRad(w, RAD.puddle * dt);
      break;
    }
  }
  for (let i = 0; i < w.slimes.count; i++) {
    const s = w.slimes.items[i]!;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (dx * dx + dy * dy < s.r * s.r) {
      addRad(w, s.rad * dt);
      break;
    }
  }
  if (w.rain > 0) addRad(w, RAD.rain * dt);
  if (w.st.radDecayBonus) p.rad -= w.st.radDecayBonus * dt;
  p.rad = clamp(p.rad, 0, RAD.max);
  const immune = p.god || !!(survivorStats(w.charId) as SurvivorStats).radImmune;
  const tier = radTier(p.rad);
  if (tier.drain && !immune) {
    p.hp -= tier.drain * dt;
    noteHurt(w.rs, hurtIndex('rad'), tier.drain * dt, w.time);
  }
  if (p.rad >= RAD.max && !immune && !p.radSaved && w.mods.radSave) {
    // Árbol: sobrevive una vez a la RAD máxima.
    p.radSaved = true;
    p.rad = TREE_FX.saveTo;
    banner(w, 'banner.radSave');
  } else if (p.rad >= RAD.max && !immune) {
    banner(w, 'banner.radDeath');
    w.rs.lastSrc = hurtIndex('rad');
    killPlayer(w);
  }
}

/** Orden de sistemas (05_TECH.md §3): input → jugador → director → armas → proyectiles → IA → recogida. */
export function tick(w: World, input: InputState, dt: number): void {
  if (w.over || w.choice) {
    // Pausado: congela la interpolación.
    w.player.prevX = w.player.x;
    w.player.prevY = w.player.y;
    return;
  }
  const p = w.player;
  w.time += dt;
  w.ticks++;
  recalc(w);
  updatePlayer(w, input, dt);
  refreshHazards(w);
  refreshObstacles(w);
  updateRadiation(w, dt);

  w.enemyGrid.build(w.enemies.items, w.enemies.count);
  if (p.deadAt === null) {
    updateSpawning(w, dt);
    updateObjective(w, dt);
    updateMirror(w);
    updateDownpour(w, dt);
  }
  updateWeapons(w, dt);
  updateShots(w, dt);
  updateLobs(w, dt);
  updateFirePools(w, dt);
  updateBurns(w, dt);
  updateMines(w, dt);
  resolveBlasts(w);
  updateEnemies(w, dt);
  if (w.time >= w.rs.nextPressure) {
    w.rs.nextPressure = w.time + PRESSURE.every;
    samplePressure(
      w.rs,
      w.time,
      w.enemies.count,
      surroundedBy(w, PRESSURE.r, PRESSURE.sectors, PRESSURE.minSectors, sectorOcc),
    );
  }
  updateEnemyBullets(w, dt);
  updateTelegraphs(w, dt);
  updateBarrels(w, dt);
  resolveBlasts(w);
  compactEnemies(w);
  updatePickups(w, dt);
  updateSlimes(w, dt);
  updateFx(w, dt);
  // Pico de DPS para el resumen (cada 0,25 s basta).
  if (w.ticks % 15 === 0) {
    const dps = currentDps(w);
    if (dps > w.peakDps) w.peakDps = dps;
  }

  // La Tormenta: al acabar el tiempo, daño creciente hasta morir.
  if (w.time >= RUN.stormStart && !w.won) {
    if (!w.storm) {
      w.storm = true;
      banner(w, 'banner.storm');
    }
    if (!p.god) {
      const d = (RUN.stormDps + RUN.stormDpsGrowth * (w.time - RUN.stormStart)) * dt;
      p.hp -= d;
      noteHurt(w.rs, hurtIndex('tormenta'), d, w.time);
    }
  }
  if (p.god && p.hp < 1) p.hp = 1;
  if (p.hp <= 0 && p.deadAt === null) killPlayer(w);
  // La run acaba cuando termina la animación de muerte.
  if (p.deadAt !== null && w.time - p.deadAt >= PLAYER.deathDelay) w.over = true;
}

/** Mata al jugador (daño letal o depuración). La animación `death` se reproduce desde `deadAt`. */
export function killPlayer(w: World): void {
  const p = w.player;
  if (p.deadAt !== null) return;
  p.hp = 0;
  p.deadAt = w.time;
  p.moving = false;
}

/** DPS de los últimos 3 s. */
export function currentDps(w: World): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += w.dpsB[(w.dpsBucket - i) & 15]!;
  return sum / 3;
}

export interface RunResults {
  charId: StatSurvivorId;
  seed: number;
  won: boolean;
  time: number;
  kills: number;
  level: number;
  bosses: number;
  dmg: number;
  bossDmg: number;
  rad: number;
  /** Incluye los cupones recogidos en la partida (`coupons`). */
  credits: number;
  coupons: number;
  consUsed: number;
  /** Consumibles que sobraron (vuelven a la Mochila). */
  consLeft: Record<ConsumableId, number>;
  consStart: Record<ConsumableId, number>;
  /** Daño por fuente, de mayor a menor (solo las que hicieron daño). */
  dmgBy: { src: string; dmg: number }[];
  weapons: { id: WeaponId; lvl: number }[];
  items: ItemId[];
  maxHit: number;
  peakDps: number;
  peakKills5: number;
  bestStreak: number;
  objectives: number;
  /** Siguió en el modo infinito tras el Coloso; `winTime` es cuándo cayó. */
  endless: boolean;
  winTime: number;
  daily: string | null;
  dailyMod: DailyMod | null;
  /** Daño y bajas por tramo de `SUMMARY.bucket` s (gráfica del ticket). */
  timeDmg: number[];
  timeKills: number[];
}

export function results(w: World): RunResults {
  const min = w.time / 60;
  const dmgBy = DAMAGE_SOURCES.map((src, i) => ({ src: src as string, dmg: Math.round(w.dmgBy[i]!) }))
    .filter((x) => x.dmg > 0)
    .sort((a, b) => b.dmg - a.dmg);
  return {
    charId: w.charId,
    seed: w.seed,
    won: w.won,
    time: w.time,
    kills: w.kills,
    level: w.level,
    bosses: w.bosses,
    dmg: Math.round(w.dmgTotal),
    bossDmg: Math.round(w.bossDmg),
    rad: Math.round(w.player.radPeak),
    credits:
      Math.floor(min * CREDITS.perMin + w.kills / CREDITS.perKills + w.bosses * CREDITS.perBoss) + w.coupons,
    coupons: w.coupons,
    consUsed: w.consUsed,
    consLeft: { ...w.cons },
    consStart: { ...w.consStart },
    dmgBy,
    weapons: w.weapons.map((x) => ({ id: x.id, lvl: x.lvl })),
    items: [...w.items],
    maxHit: Math.round(w.maxHit),
    peakDps: Math.round(w.peakDps),
    peakKills5: w.peakKills5,
    bestStreak: w.bestStreak,
    objectives: w.objectivesDone,
    endless: w.endless,
    winTime: w.winTime,
    daily: w.daily,
    dailyMod: w.dailyMod,
    timeDmg: w.timeDmg.map(Math.round),
    timeKills: [...w.timeKills],
  };
}
