// Creación del mundo de una run: pools, jugador, armas iniciales, opciones y semilla.
import { ENEMY_RULES } from '../../config/enemies';
import { FX, JUICE, PLAYER, RUN, SUMMARY, xpForLevel } from '../../config/run';
import { survivorStats, type StatSurvivorId } from '../../config/survivors';
import type { StatKey } from '../../config/traits';
import { DAMAGE_SOURCES, type WeaponId } from '../../config/weapons';
import { SPAWN } from '../../config/waves';
import { refreshHazards } from '../hazards';
import { createObstacleGrid, refreshObstacles } from '../obstacles';
import { createBeam, createBoom, createParticle, createText } from '../fx';
import { decimalFields, Pool } from '../pool';
import { createRng } from '../rng';
import { createRunStats } from '../runStats';
import { SpatialHash } from '../spatialHash';
import { createStats, recalc } from '../stats';
import { resetActTimers } from '../systems/campaign';
import { createPickup } from '../systems/combat';
import { createBullet, createEnemy, createSlime, createTele } from '../systems/enemies';
import { createMirror } from '../systems/mirror';
import { createBarrel } from '../systems/modes';
import { createFirePool, createLob, createMine, createShot, createWeapon } from '../systems/weapons';
import type { World } from '../types';
import { defaultView } from '../view';
import { SFX_COUNT } from '../sfx';
import { STAT_KEYS, type WorldOptions, createCorpse, createPoint, createWreck } from './options';

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
    actStart: 0,
    actBossDown: false,
    actClearAt: -1,
    actFadeAt: -1,
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
    nextSpecial: 0,
    specialIdx: 0,
    rain: 0,
    storm: false,
    lastBossAt: -999.5,
    bossSpawned: {},
    bossAlive: 0,
    nextElite: 0,
    mirror: createMirror(seed),
    barrels: new Pool(createBarrel, 24),
    barrelT: 3,
    objective: null,
    nextObjective: 0,
    downpour: null,
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
  decimalFields(w);
  decimalFields(w.player);
  decimalFields(w.st);
  decimalFields(w.rs);
  recalc(w);
  w.player.hp = w.st.maxHp;
  refreshHazards(w);
  refreshObstacles(w);
  resetActTimers(w);
  return w;
}
