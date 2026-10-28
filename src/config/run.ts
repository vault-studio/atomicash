// Parámetros de la run. Todo número de balance vive en src/config (AGENTS.md §3).
// Valores de partida del prototipo (atomic-ash-proto.html).
export const RUN = {
  /** Paso fijo del motor (05_TECH.md §3). */
  tickHz: 60,
  /** Máximo de pasos por frame para no entrar en espiral si el navegador se congela. */
  maxStepsPerFrame: 5,
  /** Lado del mapa cuadrado, en px de mundo. */
  mapSize: 3200,
  /**
   * Lado aproximado de una casilla del suelo, en px de mundo: el render pone una baldosa por casilla y los charcos
   * radiactivos ocupan casillas enteras (así el lago de ácido pintado coincide con donde hace daño).
   * DECISIÓN: 120 deja un bidón a la altura de la cintura del superviviente y dibuja la baldosa a ~0,66×
   * (reducida, nítida). Con 320 el suelo salía a 1,8× y las piedras eran tan grandes como los personajes.
   */
  groundCell: 120,
  /** Duración de la run en segundos. */
  duration: 900,
  /** Lado de celda del spatial hash de colisiones, en px de mundo (05_TECH.md §3). */
  gridCell: 64,
  /** La Tormenta empieza al acabar el tiempo: daño creciente hasta morir. */
  stormStart: 900,
  stormDps: 5,
  stormDpsGrowth: 5,
} as const;

export const PLAYER = {
  /** Radio de colisión del jugador en px de mundo. */
  radius: 12,
  /** Por debajo de esta magnitud de entrada se considera quieto. */
  moveDeadzone: 0.05,
  magnetBase: 72,
  /** Invulnerabilidad tras recibir un golpe, en s. */
  invuln: 0.45,
  /** Tiempo entre golpes de contacto del mismo enemigo, en s. */
  contactCd: 0.7,
  weaponSlots: 4,
  maxWeaponLevel: 5,
  /** Cambios de tarjetas gratis por run. */
  rerolls: 1,
  /** Consumibles con los que empieza una partida rápida (sin Mochila). */
  startConsumables: { stim: 2, iodine: 2, grenade: 3, turbo: 1 },
  consumableMax: 9,
  /** Segundos desde la muerte hasta la pantalla de resultados (animación death). */
  deathDelay: 1.6,
} as const;

/**
 * El daño recibido escala con el tiempo: de `start` a `max` al llegar a `reachAtFrac` de la run.
 * DECISIÓN: subido de 0,55→1,3 a 0,7→1,6 (~25 % más) a cambio de los recogibles de campo (botiquín, imán y bomba).
 */
export const DMG_TAKEN = { start: 0.7, max: 1.6, reachAtFrac: 0.75 } as const;

export const CAPS = {
  cdReduction: 0.6,
  dmgReduction: 0.5,
  dodge: 0.4,
  crit: 0.6,
  critMult: 2,
  /** Curación máxima por segundo que dan las bajas con jeringas. */
  killHealPerSec: 4,
} as const;

export const XP = {
  /** XP para el nivel n: a + b·(n−1) + floor(c·(n−1)^1.5) (02_GAMEPLAY.md §4). */
  a: 10,
  b: 6,
  c: 0.8,
  /** Valores de chatarra de mayor a menor (grande, mediana, pequeña). */
  gems: [25, 5, 1],
  gemRadius: { 25: 7, 5: 5, 1: 3.5 } as Readonly<Record<number, number>>,
  /** Por encima de este número de gemas en el suelo, el valor nuevo se suma a una existente. */
  maxGems: 350,
  /** Velocidad inicial y aceleración de una gema atraída por el imán, en px/s y px/s². */
  pullSpeed: 250,
  pullAccel: 900,
} as const;

export const KNOCKBACK = { base: 120, decay: 9 } as const;

export const CREDITS = { perMin: 10, perKills: 20, perBoss: 50 } as const;

export const FX = {
  maxTexts: 120,
  textLife: 0.8,
  bannerLife: 2.6,
  maxBeams: 60,
  maxBooms: 80,
  maxCorpses: 150,
  corpseTime: 3,
  shakeMax: 10,
  shakeDecay: 10,
  /** Colores de explosiones y rayos (0xRRGGBB). */
  colors: {
    bloater: 0xc8dc50,
    tele: 0xff5a3c,
    hammer: 0xe8a33a,
    mine: 0xff5a5a,
    grenade: 0xffaa3c,
    chain: 0x7fd8ff,
    zap: 0xffe14a,
    unstable: 0xb6ff3a,
    cone: 0xf3e9d2,
  },
} as const;

export const xpForLevel = (n: number): number =>
  XP.a + XP.b * (n - 1) + Math.floor(XP.c * Math.pow(n - 1, 1.5));

/** Casillas del suelo por lado y su lado exacto `T` (el mapa se reparte sin sobrante). */
export function groundGrid(mapSize: number): { n: number; T: number } {
  const n = Math.round(mapSize / RUN.groundCell);
  return { n, T: mapSize / n };
}
