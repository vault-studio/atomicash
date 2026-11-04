// Estadísticas de la partida para el depurador y la simulación (CAMBIOS §6.4). TS puro; se rellenan desde los sistemas.
import { STAT_ENEMY_IDS, type StatEnemyId } from '../config/enemies';

/** Fuentes de daño al jugador: cada tipo de enemigo y lo que no es un enemigo. */
export const HURT_SOURCES = [...STAT_ENEMY_IDS, 'barril', 'rad', 'tormenta', 'chatarra', 'acido'] as const;
export type HurtSource = (typeof HURT_SOURCES)[number];
export const HURT_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  HURT_SOURCES.map((s, i) => [s, i]),
);
export const hurtIndex = (s: StatEnemyId | HurtSource): number => HURT_INDEX[s] ?? -1;

export interface RunStats {
  /** Aturdimientos recibidos. */
  stuns: number;
  /** Cargas de interceptor que alcanzaron al jugador y las que esquivó (pasaron de largo). */
  chargesHit: number;
  chargesDodged: number;
  /** Impactos de tiradores especiales recibidos y esquivados. */
  shellsHit: number;
  shellsDodged: number;
  /** Veces que un enemigo se enfurece (por tiempo, vida, muerte de un aliado o sermón). */
  rages: number;
  /** Daño recibido por fuente (índice en HURT_SOURCES). */
  readonly dmgTaken: Float64Array;
  /** Última fuente que hizo daño (−1 = ninguna): la causa de la muerte. */
  lastSrc: number;
  /** Bajas por tipo y suma de su tiempo para matar (del primer golpe a la muerte), por índice en STAT_ENEMY_IDS. */
  readonly killsBy: Float64Array;
  readonly ttkSum: Float64Array;
  /** Veces que el jugador queda rodeado (entra en el estado; ver `PRESSURE`). */
  surrounded: number;
  /** Rodeado ahora mismo (para contar solo las entradas). */
  inRing: boolean;
  /** Siguiente muestreo de presión, en s de run. */
  nextPressure: number;
  /** Por minuto (índice = minuto): vida perdida, bajas, XP ganada y media de enemigos vivos. */
  readonly hpLostMin: number[];
  readonly killsMin: number[];
  readonly xpMin: number[];
  readonly aliveSum: number[];
  readonly aliveSamples: number[];
  /** Segundo de run en que se alcanza cada nivel (índice = nivel). */
  readonly levelAt: number[];
  /** Mejoras elegidas y cuándo. */
  readonly picks: { t: number; kind: string; id: string }[];
  /** Segundo en que se consiguió cada arma (para su DPS medio). */
  readonly weaponAt: Record<string, number>;
}

export const createRunStats = (): RunStats => ({
  stuns: 0,
  chargesHit: 0,
  chargesDodged: 0,
  shellsHit: 0,
  shellsDodged: 0,
  rages: 0,
  dmgTaken: new Float64Array(HURT_SOURCES.length),
  lastSrc: -1,
  killsBy: new Float64Array(STAT_ENEMY_IDS.length),
  ttkSum: new Float64Array(STAT_ENEMY_IDS.length),
  surrounded: 0,
  inRing: false,
  nextPressure: 0,
  hpLostMin: [0],
  killsMin: [0],
  xpMin: [0],
  aliveSum: [0],
  aliveSamples: [0],
  levelAt: [0, 0],
  picks: [],
  weaponAt: {},
});

const ENEMY_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  STAT_ENEMY_IDS.map((s, i) => [s, i]),
);

/** Asegura el hueco del minuto actual en las series por minuto (solo reserva una vez por minuto). */
function minuteSlot(rs: RunStats, t: number): number {
  const m = Math.floor(t / 60);
  while (rs.hpLostMin.length <= m) {
    rs.hpLostMin.push(0);
    rs.killsMin.push(0);
    rs.xpMin.push(0);
    rs.aliveSum.push(0);
    rs.aliveSamples.push(0);
  }
  return m;
}

export function noteKill(rs: RunStats, type: StatEnemyId, t: number, hitAt: number): void {
  const i = ENEMY_INDEX[type] ?? -1;
  if (i < 0) return;
  rs.killsBy[i] = rs.killsBy[i]! + 1;
  rs.ttkSum[i] = rs.ttkSum[i]! + Math.max(0, t - (hitAt >= 0 ? hitAt : t));
  const m = minuteSlot(rs, t);
  rs.killsMin[m] = rs.killsMin[m]! + 1;
}

export function noteXp(rs: RunStats, t: number, xp: number): void {
  const m = minuteSlot(rs, t);
  rs.xpMin[m] = rs.xpMin[m]! + xp;
}

export function noteLevel(rs: RunStats, level: number, t: number): void {
  while (rs.levelAt.length <= level) rs.levelAt.push(-1);
  rs.levelAt[level] = t;
}

export function notePick(rs: RunStats, t: number, kind: string, id: string): void {
  rs.picks.push({ t, kind, id });
  if ((kind === 'new' || kind === 'fusion') && rs.weaponAt[id] === undefined) rs.weaponAt[id] = t;
}

/** Sector (0…sectors−1) en el que cae la dirección (dx, dy) alrededor del jugador. */
export const sectorOf = (dx: number, dy: number, sectors: number): number =>
  Math.min(sectors - 1, Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * sectors));

/**
 * Presión: rodeado = enemigos en al menos `minSectors` de los `sectors` sectores alrededor del jugador, dentro de `r`
 * px (ver `PRESSURE` en el archivo de datos). `occ` es un contador reutilizable para no reservar memoria.
 */
export function surroundedBy(
  w: {
    player: { x: number; y: number };
    enemies: { count: number; items: { x: number; y: number; dead: boolean }[] };
  },
  r: number,
  sectors: number,
  minSectors: number,
  occ: Uint8Array,
): boolean {
  occ.fill(0);
  let count = 0;
  const p = w.player;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > r * r) continue;
    const s = sectorOf(dx, dy, sectors);
    if (!occ[s]) {
      occ[s] = 1;
      if (++count >= minSectors) return true;
    }
  }
  return false;
}

/** Muestra de presión (enemigos vivos y si está rodeado), llamada desde el tick cada `every` s. */
export function samplePressure(rs: RunStats, t: number, alive: number, surrounded: boolean): void {
  const m = minuteSlot(rs, t);
  rs.aliveSum[m] = rs.aliveSum[m]! + alive;
  rs.aliveSamples[m] = rs.aliveSamples[m]! + 1;
  if (surrounded && !rs.inRing) rs.surrounded++;
  rs.inRing = surrounded;
}

/** Anota daño recibido de la fuente `src` (índice; −1 = desconocida: solo cuenta como vida perdida) en el segundo `t`. */
export function noteHurt(rs: RunStats, src: number, d: number, t: number): void {
  if (d <= 0) return;
  const m = minuteSlot(rs, t);
  rs.hpLostMin[m] = rs.hpLostMin[m]! + d;
  if (src < 0) return;
  rs.dmgTaken[src] = rs.dmgTaken[src]! + d;
  rs.lastSrc = src;
}
