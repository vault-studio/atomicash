// Parámetros de la run. Todo número de balance vive en src/config (AGENTS.md §3).
// Valores de partida del prototipo (atomic-ash-proto.html).
import { TUNING as T, type DeepReadonly } from './tuning';
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

/**
 * Valores en `src/data/tuning.json` → `player`. Notas por campo:
 * - `radius`: Radio de colisión del jugador en px de mundo.
 * - `moveDeadzone`: Por debajo de esta magnitud de entrada se considera quieto.
 * - `invuln`: Invulnerabilidad tras recibir un golpe, en s.
 * - `contactCd`: Tiempo entre golpes de contacto del mismo enemigo, en s.
 * - `weaponSlots`: Armas a la vez: la inicial y dos más.
 * - `itemSlots`: Huecos de objeto: uno por cada jefe que suelta cofre (Rey Rata y Dirigible).
 * - `rerolls`: Cambios de tarjetas gratis por run.
 * - `startConsumables`: Consumibles con los que empieza una partida rápida (sin Mochila).
 * - `deathDelay`: Segundos desde la muerte hasta la pantalla de resultados (animación death).
 */
export const PLAYER: DeepReadonly<typeof T.player> = T.player;

/**
 * El daño recibido escala con el tiempo: de `start` a `max` al llegar a `reachAtFrac` de la run.
 * DECISIÓN: de 0,7→1,6 a 2→3. Con 0,7 un necrófago quitaba 6 PV y quedarse quieto salía gratis; ahora, sin
 * defensas, un superviviente de 100 PV aguanta 5–6 golpes de los normales (necrófago 16, saqueador 20). Casco,
 * chaleco y sutura son los que lo compensan.
 */
export const DMG_TAKEN: DeepReadonly<typeof T.dmgTaken> = T.dmgTaken;

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
 * Cada tramo es `[probabilidad, mínimo, máximo]` (ambos incluidos); las probabilidades suman 1. Media ≈ 246.
 * `jackpot` (500) es el premio gordo y desde `big` la máquina celebra un gran premio.
 */
export const CACHE_ROLL = {
  tiers: [
    [0.05, 500, 500],
    [0.25, 351, 499],
    [0.3, 151, 349],
    [0.4, 50, 149],
  ],
  jackpot: 500,
  big: 351,
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
  /**
   * Cinemática de victoria al abatir un jefe o un élite: el juego se para, la cámara se acerca `zoom` veces al
   * personaje (centrada `lift` px por encima de los pies) mientras hace la animación y vuelve. Tiempos en s;
   * `fallback` es la duración si el personaje no tiene hoja de victory.
   */
  victory: { zoom: 2.3, lift: 34, zoomIn: 0.45, hold: 0.35, zoomOut: 0.5, fallback: 2, rays: 14 },
  /**
   * Cinemática de derrota cuando el jugador muere con el Coloso en el mapa: la misma de victoria pero sobre el jefe, con luces rojas
   * y el «¡Perdiste!» encima. Se queda en primer plano `hold` s tras su animación y sale el resumen de la run.
   * `textIn` es lo que tarda el texto en aparecer.
   */
  defeat: { zoom: 1.35, lift: 120, hold: 1.2, textIn: 0.35 },
} as const;

/**
 * Fase de test: enseña en la run el botón que saca al Coloso. Ponlo a false al publicar.
 */
export const TEST_PHASE = true;

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
