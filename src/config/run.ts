// Parámetros de la run. Todo número de balance vive en src/config (AGENTS.md §3).
// Valores de partida del prototipo (atomic-ash-proto.html).
export const RUN = {
  /** Paso fijo del motor (05_TECH.md §3). */
  tickHz: 60,
  /** Máximo de pasos por frame para no entrar en espiral si el navegador se congela. */
  maxStepsPerFrame: 5,
  /**
   * El mapa no tiene bordes; este lado solo sitúa el punto de inicio (en su centro) y dimensiona la rejilla de
   * colisiones, que se repite.
   */
  mapSize: 3200,
  /**
   * Lado de una casilla del suelo, en px de mundo: el render pone una baldosa por casilla y los charcos
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
  /** Armas a la vez: la inicial y dos más. */
  weaponSlots: 3,
  /** Huecos de objeto: uno por cada jefe que suelta cofre (Rey Rata y Dirigible). */
  itemSlots: 2,
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
  /** Multiplicador de la experiencia que suelta cada enemigo (ver SPAWN.rateMult). */
  // DECISIÓN: ×1,25 sobre el 2,5 anterior para subir de nivel un 25 % más rápido.
  killMult: 3.125,
  /**
   * Bolitas que suelta un enemigo normal y uno irradiado (los raros); se reparten toda su experiencia.
   * DECISIÓN: una sola bolita por baja, que vale lo que antes varias: menos ruido en el suelo y más fácil de leer.
   * Los jefes siguen soltando su lluvia de chatarra.
   */
  killGems: 1,
  rareGems: 3,
} as const;

export const KNOCKBACK = { base: 120, decay: 9 } as const;

export const CREDITS = { perMin: 10, perKills: 20, perBoss: 50 } as const;

/**
 * Cupones recogidos en la partida (se suman a los del final). Los enemigos normales sueltan a veces un cupón; el cofre
 * especial de un edificio limpio da un buen puñado y un nivel.
 */
export const COUPONS = { dropChance: 0.01, drop: 5, r: 6, cache: 100 } as const;

/**
 * Tragaperras del cofre especial: cupones al azar en vez de una cantidad fija (y siempre un nivel).
 * DECISIÓN: la media (~125) queda algo por encima de los 100 fijos de antes para compensar la espera de la animación.
 * `chance` se reparte en orden: premio gordo, doble y normal (el resto).
 */
export const CACHE_ROLL = {
  normal: [70, 130],
  double: [180, 260],
  jackpot: 500,
  doubleChance: 0.15,
  jackpotChance: 0.03,
} as const;

/**
 * Sensación de impacto (dossier §1). Congelaciones en s, esquirlas por baja y zoom de cámara con la pantalla llena.
 */
export const JUICE = {
  hitStop: { boss: 0.28, bomb: 0.09, grenade: 0.05, hurt: 0.035, max: 0.3 },
  parts: { max: 420, perKill: 5, perBossKill: 40, perHit: 1, speed: 140, up: 160, gravity: 520, life: 0.55 },
  /** Aplastado del sprite al recibir un golpe (fracción). */
  squash: 0.16,
  /** Zoom de cámara: con `from` enemigos vivos empieza a alejarse, hasta `minZoom` con `to`. */
  zoom: { from: 90, to: 260, minZoom: 0.86, lerp: 1.5 },
  /** Número de daño: escala por cifra (log10) y rebote al aparecer. */
  dmgScale: { base: 0.8, perDigit: 0.22, max: 1.9, pop: 0.45, popTime: 0.12 },
} as const;

/**
 * Racha de bajas (dossier §12): bajas seguidas sin recibir daño. Cada tramo multiplica la experiencia de las bajas;
 * un golpe recibido (no esquivado) la pierde. De mayor a menor.
 */
export const STREAK = {
  tiers: [
    { at: 300, mult: 2 },
    { at: 100, mult: 1.5 },
  ],
  /** Desde cuántas bajas se ve el contador en el HUD. */
  show: 10,
} as const;

/** Multiplicador de experiencia de una racha de `n` bajas. */
export function streakMult(n: number): number {
  for (const t of STREAK.tiers) if (n >= t.at) return t.mult;
  return 1;
}

/** Resumen final: tramos de la gráfica de daño, en s. */
export const SUMMARY = { bucket: 30, window: 5 } as const;

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
    freeze: 0x7fd8ff,
  },
} as const;

export const xpForLevel = (n: number): number =>
  XP.a + XP.b * (n - 1) + Math.floor(XP.c * Math.pow(n - 1, 1.5));
