// Parámetros de render y contrato de sprite sheets (biblia de arte §4).
import type { ActId } from './acts';
import type { AnimId, Category } from './entities';
import type { BuildingKind } from './props';

export const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'] as const;
/** Alias en español que algunos JSON pueden traer (S, SO, O, NO…). */
export const DIRECTIONS_ES = ['S', 'SO', 'O', 'NO', 'N', 'NE', 'E', 'SE'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const SPRITES = {
  /** Base de la carpeta de arte, relativa a la URL de la app. */
  assetBase: 'assets/',
  manifest: 'manifest.json',
  /** Celda por categoría: 256 personajes/enemigos, 512 jefes. */
  cell: { characters: 256, enemies: 256, bosses: 512, props: 256 } satisfies Record<Category, number>,
  /** Pivote en los pies como fracción de la celda: (128, 200) en 256 y (256, 400) en 512. */
  pivotFrac: [0.5, 200 / 256] as const,
  /** Frames por defecto si el JSON no los trae (el código los lee del JSON; esto es solo respaldo). */
  defaultFrames: {
    idle: 8,
    run: 12,
    move: 12,
    attack: 8,
    attack_1: 8,
    attack_2: 8,
    hit: 4,
    death: 12,
    victory: 16,
  } satisfies Record<AnimId, number>,
  defaultFps: 12,
  /** Animaciones que se reproducen una vez. `death` se queda en el último frame (biblia §11.4). */
  oneShot: ['death', 'hit', 'attack', 'attack_1', 'attack_2', 'victory'] as readonly AnimId[],
  /** Corrige el pivote de un JSON sin tocar el archivo: { id: [x, y] } o { 'id_anim': [x, y] }. */
  // Las hojas viejas de Dot (prototipo) traen el pivote mal; las de idle y victory ya vienen bien.
  pivotOverride: { dot_run: [128, 213], dot_hit: [128, 213], dot_death: [128, 213] } as Readonly<
    Record<string, readonly [number, number]>
  >,
} as const;

export const VIEW = {
  /** Vista de referencia; la escala de cámara se ajusta para que quepa. */
  // DECISIÓN: vista más cerca (antes 1100×620, tope 1.4): personajes y enemigos se ven más grandes, como en otros
  // juegos del género; el radar compensa lo que se deja de ver.
  width: 820,
  height: 460,
  minScale: 0.45,
  maxScale: 2.4,
  /** Escala de la celda en pantalla = tamaño de la entidad × este valor. */
  scalePerSize: { characters: 0.32, enemies: 0.32, bosses: 0.14, props: 0.32 } satisfies Record<
    Category,
    number
  >,
  /** Lado de celda de las hojas para el que vale `scalePerSize`; una hoja de 384 px se dibuja a 256/384. */
  refCell: 256,
  /** Radio del placeholder = tamaño × este valor (en px de mundo). */
  placeholderRadiusPerSize: 10,
  gridStep: 100,
} as const;

/** Paleta base (04_ART_UI.md §1) más colores del suelo del prototipo. */
export const PALETTE = {
  background: 0x16140f,
  ground: 0x2a261c,
  mapEdge: 0x8a3324,
  grid: 0xfff0c8,
  gridAlpha: 0.05,
  cream: 0xf3e9d2,
  crt: 0x3cff6b,
  shadow: 0x000000,
} as const;

/**
 * Radar del HUD: recogibles y cajas de alrededor, cada tipo con su color; lo que queda fuera del alcance se marca
 * con una flecha en el borde. Alcance en px isométricos de pantalla (la vista de referencia mide 1280 de ancho).
 */
/**
 * Filtro de pantalla vieja de la run (ajuste «Filtro CRT»): curvatura del tubo, separación de rojo y azul en px de
 * pantalla (más hacia los bordes), intensidad de la banda de luz que baja y del parpadeo.
 */
export const OLD_SCREEN = { curve: 0.12, aberration: 3.2, roll: 0.07, flicker: 0.03 } as const;

/**
 * Niebla de radiación: desde `from` de RAD la pantalla se tiñe de verde nuclear y se cierra hacia el personaje; en
 * `full` solo queda un hueco de `hole` px de mundo alrededor de él (a 100 se muere). `lift` sube el centro del pie
 * al cuerpo.
 */
export const RAD_FOG = {
  from: 20,
  full: 95,
  color: 0x5cff1f,
  maxAlpha: 0.97,
  hole: 36,
  lift: 30,
  /** Fracción del radio del degradado que queda limpia; el resto sube suave hasta verde opaco. */
  soft: 0.3,
  /** Al empezar, el hueco limpio mide esta fracción de la media diagonal de la pantalla. */
  start: 0.55,
} as const;

export const RADAR = {
  range: 1500,
  /** Lado del radar en px CSS (el HUD lo encoge en pantallas bajas). */
  size: 176,
  /** Vueltas por segundo del barrido. */
  sweep: 0.35,
  phosphor: '#3cff6b',
  dim: 'rgba(60, 255, 107, 0.28)',
  bg: 'rgba(6, 20, 9, 0.88)',
  barrel: '#ff5a3c',
  /** Evento en el que hay que entrar: amarillo «aguanta», rojo «limpia la zona». */
  objective: '#ffe14a',
  objectivePurge: '#ff5a3c',
  /** Aro de una zona en la que se está luchando. */
  fight: '#ff3c28',
  /** Trazo oscuro de los marcadores. */
  ink: '#06140a',
  lake: 'rgba(157, 255, 0, 0.2)',
  kinds: {
    medkit: '#ff4d4d',
    magnet: '#4db8ff',
    bomb: '#ff9a2e',
    crate: '#ffe14a',
    chest: '#c77dff',
    cache: '#3fb8af',
    freeze: '#bfefff',
    nuka: '#ff3d6a',
    boots: '#e8a33a',
  } as Readonly<
    Record<'medkit' | 'magnet' | 'bomb' | 'crate' | 'chest' | 'cache' | 'freeze' | 'nuka' | 'boots', string>
  >,
  /** Edificios de 3×3: un rombo del color de lo que los rodea. */
  buildings: {
    raiders: '#ff6a3d',
    robots: '#4de3ff',
    necro: '#c9ff4d',
    supply: '#ffe14a',
  } as Readonly<Record<BuildingKind, string>>,
  /** Medio lado del rombo de un edificio, en px CSS. */
  buildingSize: 8,
  /** Lado del dibujo de un cofre y radio del marcador de un evento, en px CSS. */
  chestSize: 22,
  eventSize: 9,
} as const;

/** Lo que tarda en hacer caso una pantalla abierta al apretar: el clic de ese toque llega después. */
export const TAP_GUARD_MS = 350;

/**
 * Mapa de la pausa. `range`: unidades de mundo isométricas de la mitad de su alto. `cells`: casillas que se miran a
 * cada lado del jugador (hasta salir de pantalla en un móvil apaisado). `grid`: lado de la cuadrícula. `arrowRange`: hasta dónde lleva flecha en el borde una zona que no cabe. Tamaños en px CSS.
 */
export const MAP = {
  range: 1100,
  arrowRange: 2400,
  cells: 34,
  grid: 400,
  margin: 22,
  font: 13,
  zone: 12,
  chest: 30,
  event: 13,
  bg: '#050d07',
  object: 'rgba(60, 255, 107, 0.3)',
  enemy: '#ff5a3c',
} as const;

/** Colores de la run (placeholders de proyectiles, chatarra, charcos…). */
export const RUN_COLORS = {
  gem: { 1: 0xe8d36a, 5: 0x6ad8e8, 25: 0xff8ad8 } as Readonly<Record<number, number>>,
  gemBig: 0xff8ad8,
  stim: 0xff5577,
  chest: 0xd8a53a,
  crate: 0x8a7a4a,
  coupon: 0xf3e9d2,
  couponInk: 0xd7263d,
  cache: 0x3fb8af,
  cacheTrim: 0xffe14a,
  medkit: 0xf2efe6,
  medkitCross: 0xd8322e,
  magnet: 0xd8322e,
  magnetTip: 0xc8ccd0,
  bomb: 0x2a2a2a,
  bombFuse: 0xffb347,
  hazard: 0x9dff00,
  hazardAlpha: 0.18,
  /** Mancha de hielo de la nevera, si no carga la baldosa de `TILES.iceLake`. */
  ice: { color: 0xc4e8f6, edge: 0x7fd8ff, alpha: 0.55 },
  /** Bala radiactiva del liquidador cuando falta su tira. */
  radBullet: 0x9dff00,
  /** Suelo roto si faltan sus baldosas y lo que cae si faltan sus tiras, en px de pantalla. */
  crater: { color: 0x14100c, alpha: 0.5, r: 50, vary: 0.35, cracks: 7, reach: 1.4, short: 0.65, width: 2.5 },
  falling: {
    height: 340,
    from: 0.15,
    scrap: { color: 0x8a6a4a, edge: 0x2a2018, size: 26 },
    acid: { color: 0x9dff00, edge: 0x3a6a00, size: 24 },
  },
  slime: 0x7dff3a,
  pool: 0xff7a2a,
  tele: 0xff3c28,
  objective: 0xffe14a,
  /** Tinte de la copia del jugador y bomba del evento «Tú mismo, otra vez» (cuerpo y pulso). */
  mirror: 0xc070ff,
  mirrorBomb: 0x2a1018,
  mirrorPulse: 0xff2a2a,
  barrel: 0xc0321e,
  barrelBand: 0xffd34a,
  mine: 0xff5a5a,
  ebullet: 0xff6a3a,
  shadow: 0x000000,
  irradiated: 0xa8ff70,
  /** Enemigo enfurecido (gana al verde de irradiado). */
  rage: 0xff4a3a,
  /** Luces de la cinemática de victoria: rayos dorados y verde radiactivo alternos. */
  victoryA: 0xffd34d,
  victoryB: 0x9dff3a,
  /** Luces de la cinemática de derrota (el Coloso celebra) y su texto. */
  defeatA: 0xff4a3a,
  defeatB: 0xffa03a,
  defeatText: 0xff3a2a,
  flash: 0xffb0b0,
  frozen: 0x9fdcff,
  freeze: 0x7fd8ff,
  freezeCore: 0xe8f8ff,
  nuka: 0xff3d6a,
  nukaGlow: 0xffe14a,
  boots: 0xe8a33a,
  rain: 0x9dff00,
  storm: 0x8a3324,
  aura: 0x7dff6a,
  text: {
    dmg: 0xeeeeee,
    crit: 0xffe14a,
    hurt: 0xff6050,
    dodge: 0x99ccff,
    pickup: 0xffffff,
    slogan: 0xd6b0ff,
  },
} as const;

/**
 * Enemigo enfurecido: se ve más grande (`scale`) mientras dura, y en el último `warn` s parpadea entre rojo y normal
 * a `blinkHz` veces por segundo para avisar de que se le va a pasar.
 */
export const RAGE_VIEW = { scale: 1.25, warn: 1, blinkHz: 6 } as const;

/**
 * Baldosas de suelo recortadas de las láminas de ARTE/ con tools/slice_tiles.py (rombo
 * 2:1 de 256×128). `tiles.json` dice qué baldosa lleva lago de ácido, cuánto sobresale por arriba y si lo que
 * sobresale va aparte (`top`) para ordenarlo con los personajes.
 * DECISIÓN: el suelo es una sola lámina de arena con dos lagos de ácido (grande y pequeño). Casi todo es arena, sobre
 * todo la lisa sin matojos (deja leer bien personajes y proyectiles), y los lagos solo salen donde hay charco
 * radiactivo: el verde en el suelo siempre significa daño. La decoración irá encima como objetos sin baldosa.
 */
export const TILES = {
  dir: 'assets/tiles/',
  index: 'assets/tiles/tiles.json',
  /** Lámina de la que sale el lago que deja la nevera, en cualquier acto. */
  iceLake: 'hielo',
  /**
   * Por acto: lámina del suelo, peso de cada baldosa y tinte, que oscurece el suelo y los objetos para que destaquen
   * los personajes. Todas las láminas tienen la misma rejilla: la 1 y la 4 son lisas, la 0 y la 3 llevan matojos, y
   * la 2 y la 5 son los lagos (ácido en el acto 1).
   * DECISIÓN: en los actos 2 y 3 los matojos destacan más que en la arena y salen la mitad de veces.
   */
  acts: {
    1: { sand: 'suelo', weights: [1, 6, 1, 1, 6, 1], tint: 0xb8a890 },
    2: { sand: 'hielo', weights: [1, 12, 1, 1, 12, 1], tint: 0xc0c8d4 },
    3: { sand: 'plantas', weights: [1, 12, 1, 1, 12, 1], tint: 0xb8b8a0 },
  } as Readonly<
    Record<ActId, { readonly sand: string; readonly weights: readonly number[]; readonly tint: number }>
  >,
  /** Baldosas de suelo roto, debajo de los escombros (tools/slice_destrozos.py). */
  broken: 'roto',
  /** Láminas de decoración con baldosa; sus baldosas con ácido también son lagos. */
  deco: [] as readonly string[],
  /** Probabilidad de que una casilla sin charco lleve decoración. */
  decoChance: 0.07,
  /** Objetos sueltos (sin baldosa) de tools/slice_props.py; qué hay y dónde, en config/props.ts. */
  propsDir: 'assets/props/',
  /** Ancho del rombo en la imagen, en px. */
  imageWidth: 256,
  /** El suelo roto y los escombros ya vienen oscuros: con el tinte del acto se confundirían entre ellos. */
  brokenTint: 0xdccab0,
  rubbleTint: 0xffffff,
  /** Solape para que no se vean costuras. */
  overlap: 1.03,
} as const;

/** Lo que escribe tools/slice_tiles.py en `tiles.json`. */
export interface TileInfo {
  readonly file: string;
  /** Px de la imagen por encima del rombo (objetos que sobresalen). */
  readonly head: number;
  /** Fracción de la cara cubierta de ácido, si la hay. */
  readonly acid?: number;
  /** Lo que sobresale, aparte, en el mismo lienzo que `file`. */
  readonly top?: string;
}

export interface TileIndex {
  readonly width: number;
  readonly height: number;
  readonly sets: Readonly<Record<string, readonly TileInfo[]>>;
}

/**
 * Dibujos de los objetos del mapa (tools/slice_pickups.py → `assets/pickups/`). `w` es el ancho del cuerpo en px de
 * mundo como múltiplo del radio del objeto (`fixed`: en px, para los que no tienen radio propio). `bob`: flota.
 * DECISIÓN: algo más grandes que su radio de recogida para que se lean entre la arena y los enemigos.
 */
export const PICKUP_ART = {
  dir: 'assets/pickups/',
  index: 'assets/pickups/pickups.json',
  w: {
    gem1: 2.8,
    gem5: 2.8,
    gem25: 4,
    stim: 3.6,
    coupon: 4.4,
    crate: 2.1,
    chest: 2.3,
    cache: 1.7,
    medkit: 3.2,
    magnet: 3,
    bomb: 2.8,
    freeze: 2.4,
    nuka: 2.4,
    boots: 3,
    barrel: 1.7,
    barrel_lit: 2.2,
  } as Readonly<Record<string, number>>,
  fixed: { beacon: 46 } as Readonly<Record<string, number>>,
  /** Petardos de la ristra: ancho, altura del arco, altura de salida (la mano) y vueltas en el aire, en radianes. */
  mine: { w: 18, arc: 70, lift: 22, spin: 9 },
  bob: [
    'stim',
    'coupon',
    'medkit',
    'magnet',
    'bomb',
    'freeze',
    'nuka',
    'boots',
    'chest',
    'crate',
    'cache',
  ] as readonly string[],
} as const;

export interface AuraArt {
  readonly strip: string;
  readonly ring: number;
  readonly ax: number;
  readonly ay: number;
  readonly fps: number;
  readonly alpha: number;
}

/**
 * Efectos con dibujo (tools/slice_fx.py → `assets/fx/`): tiras de frames del mismo tamaño. Sin la tira, FxLayer sigue
 * dibujando su placeholder. Tamaños en px de mundo: `r` es múltiplo del radio del efecto (charco, zona, explosión) o
 * del enemigo; `w`, ancho fijo. `ay` (y `ax`) es el punto de apoyo como fracción del frame; `fps` en las que hacen
 * bucle. Las planas (`flat`) se aplastan a 2:1 para casar con los círculos isométricos del suelo.
 */
export const FX_ART = {
  dir: 'assets/fx/',
  index: 'assets/fx/fx.json',
  zone: {
    ring: { r: 2.12, ay: 0.5 },
    glow: { r: 2, ay: 0.5, fps: 8, alpha: 0.55 },
    motes: { r: 2, ay: 0.82, fps: 8, alpha: 0.8 },
    /** Color de la zona de «limpia la zona» (la de «aguanta» usa `RUN_COLORS.objective`). */
    purge: 0xff5a3c,
  },
  tele: { circle: { r: 2.1 }, disc: { r: 2.1, alpha: 0.4 } },
  /**
   * Pasillo de embestida: franja de tierra levantada sin borde duro (`bands`: semiancho relativo y opacidad, de fuera
   * adentro) y galones que avanzan hacia donde va la carga (`gap` px entre ellos, `speed` px/s); los que ya ha
   * alcanzado el aviso se encienden. `dust` es el color de la tierra; el rojo del aviso va en los galones.
   */
  lane: {
    dust: 0x3a1a0c,
    bands: [
      { w: 1.3, a: 0.14 },
      { w: 1, a: 0.18 },
      { w: 0.65, a: 0.22 },
    ],
    glow: { w: 0.55, a: 0.26 },
    chevron: { gap: 46, speed: 90, len: 0.45, wing: 0.7, width: 3, dim: 0.22, lit: 0.85 },
  },
  /**
   * Lo que cae, en px de pantalla: `w` ancho, `ay` punto de la tira que marca su posición. La chatarra lleva una pieza
   * por frame; el resto, un bucle.
   */
  fall: {
    scrap: { strip: 'fall_scrap', w: 74, ay: 0.5, spin: 9 },
    acid: { strip: 'fall_acid', w: 44, ay: 0.72, fps: 10 },
    shell: { strip: 'fall_shell', w: 36, ay: 0.95, fps: 1 },
    // El obús con tinte: verde (barril de ácido del bidonero) y azul pálido (nevera).
    barrel: { strip: 'fall_shell', w: 36, ay: 0.95, fps: 1, tint: 0x7dff3a },
    ice: { strip: 'fall_shell', w: 36, ay: 0.95, fps: 1, tint: 0x8fd0ff },
  },
  /**
   * Auras de arma en el suelo. `ring`: parte del ancho del frame que ocupa el anillo, que marca el alcance; (`ax`, `ay`)
   * es su centro. Las escribe tools/slice_destrozos.py al recortar.
   */
  aura: {
    geiger: { strip: 'aura_geiger', ring: 0.844, ax: 0.512, ay: 0.566, fps: 8, alpha: 0.75 },
    nucleo_inestable: { strip: 'aura_core', ring: 0.868, ax: 0.506, ay: 0.585, fps: 10, alpha: 0.85 },
  } as Readonly<Record<string, AuraArt>>,
  pool: {
    fire: { r: 2.3, ay: 0.62, fps: 10 },
    /** `fade`: s finales en los que se apaga. `cull`: px de mundo; más lejos del jugador no se dibuja. */
    acid: { r: 2.3, ay: 0.58, fps: 7, fade: 3, cull: 1300 },
  },
  boom: {
    fire: { r: 2.2, ay: 0.72 },
    acid: { r: 2.4, ay: 0.68 },
    slam: { r: 2.3, ay: 0.55 },
    debris: { r: 3.4, ay: 0.78 },
    /** Las que barren la pantalla: `r` deja la explosión del ancho de la vista; `fade`, parte final en la que se apaga. */
    big: { r: 1, ay: 0.8, alpha: 0.9, fade: 0.3 },
    ice: { r: 1, ay: 0.72, alpha: 0.9, fade: 0.3 },
    /** Las explosiones más grandes que esto (bomba y crio-granada, que barren la pantalla) usan las tiras grandes. */
    maxR: 220,
  },
  shot: {
    pistola_clavos: { w: 28 },
    jeringa: { w: 36 },
    remachadora: { w: 28 },
    dardos_incendiarios: { w: 38 },
    rifle_cerrojo: { w: 34 },
    escopeta_chatarra: { w: 26 },
  } as Readonly<Record<string, { w: number }>>,
  /** Qué tira usa cada arma con proyectil dibujado (las demás, círculo de su color). */
  shotArt: {
    pistola_clavos: 'nail',
    jeringa: 'syringe',
    remachadora: 'rivet',
    dardos_incendiarios: 'dart',
    rifle_cerrojo: 'bullet',
    escopeta_chatarra: 'pellet',
  } as Readonly<Record<string, string>>,
  /** Punto de la tira que va en la posición del proyectil (la estela queda detrás). */
  shotAx: 0.68,
  ebullet: { r: 6.5, fps: 12 },
  molotov: { w: 30, fps: 14 },
  wrench: { size: 4.6 },
  coil: { size: 3.4, fps: 12 },
  wave: { len: 1.05 },
  enemy: {
    burn: { r: 3, ay: 0.95, fps: 12 },
    ice: { r: 3.2, ay: 0.88, thaw: 0.3 },
    stun: { r: 2.4, head: 3.4, fps: 10 },
    spawn: { r: 3.6, ay: 0.6, dur: 0.45 },
  },
  death: { w: 46, ay: 0.6, dur: 0.45 },
  /**
   * Muerte de los robots. Las piezas se recortan del sprite: `anims` y `dir` dicen de qué hoja y fila (primer frame);
   * salen `base + tamaño × perSize` trozos, hasta `max`, y se descartan los de menos de `minPiece` del robot; en el suelo
   * miden `restScale` de lo que medían en el robot. `seamDark` oscurece los cortes. `delay` s tras la muerte aparecen las piezas, ya con la explosión encima; se oscurecen hasta
   * `char` en `charTime` s y se apagan los últimos `fade` s. `colorPiece`: lado de cada trozo del robot sin sprite, en
   * fracción de su ancho, y `colorDark`, cuánto se oscurece su color. Explosión: una cada `per` px de ancho del robot, hasta `max`, separadas `gap` s; `w` en
   * fracción de su ancho. `scorch`: mancha quemada del suelo: `strip` de `w` veces el
   * ancho del robot, o un círculo de radio `r` si no carga.
   */
  wreck: {
    anims: ['move', 'idle'] as readonly AnimId[],
    dir: 1,
    pieces: { base: 6, perSize: 2, max: 14 },
    restScale: 0.85,
    minPiece: 0.02,
    shatter: { alpha: 60, tries: 12, uneven: 0.3, jag: 0.03, seam: 2.5 },
    seamDark: 0.4,
    delay: 0.05,
    char: 0.72,
    charTime: 0.8,
    fade: 2,
    colorPiece: 0.08,
    colorDark: 0.6,
    motion: { air: 0.55, fall: 450, reach: 0.8, pop: 0.7, heavy: 2, spin: 8, turn: 1.8 },
    blast: { per: 170, max: 5, gap: 0.13, dur: 0.5, w: 1.5, ay: 0.72, spread: 0.55 },
    scorch: { strip: 'scorch', w: 1.15, artAlpha: 0.9, r: 0.36, alpha: 0.3, color: 0x14100c, in: 0.25 },
  },
  levelup: { w: 78, ay: 0.92, dur: 0.9 },
  heal: { w: 56, ay: 0.9, dur: 0.6, minFrac: 0.08 },
} as const;
