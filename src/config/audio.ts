// Mezcla del audio (04_ART_UI.md §4). Los sonidos son grabaciones de tools/build_audio.py (assets/audio/), todas
// normalizadas a la misma sonoridad; aquí se decide cuánto pesa cada una en la mezcla y cómo se comportan.
export type MusicMood = 'menu' | 'run' | 'boss';

export interface SfxDef {
  /**
   * Volumen en la mezcla. Los archivos tienen la misma sonoridad entre variantes pero no entre sonidos (un disparo
   * mide menos que un golpe sostenido); estos valores los llevan a la jerarquía de la mezcla, medida con
   * tools/build_audio.py: explosiones arriba, armas, muertes, impactos y la interfaz abajo.
   */
  readonly gain: number;
  /** Copias sonando a la vez como mucho; la más vieja se corta. */
  readonly voices: number;
  /** Separación mínima entre dos disparos del mismo sonido, en s. */
  readonly gap: number;
  /** Variación aleatoria de tono, ± semitonos. */
  readonly pitch: number;
  /** Cuánto baja la música al sonar (0–1); para golpes grandes. */
  readonly duck?: number;
  /** Envío a la reverb del páramo (0–1). Los sonidos lejanos suman más. */
  readonly reverb?: number;
  /** Interfaz: sin posición, sin reverb y sin filtro de poca vida. */
  readonly ui?: boolean;
  /** No la corta el límite global de voces (golpes al jugador, avisos). */
  readonly priority?: boolean;
}

const S = (
  gain: number,
  voices: number,
  gap: number,
  pitch: number,
  extra: Partial<Pick<SfxDef, 'duck' | 'reverb' | 'ui' | 'priority'>> = {},
): SfxDef => ({ gain, voices, gap, pitch, reverb: 0.15, ...extra });

export const AUDIO = {
  defaultMusic: 0.5,
  defaultSfx: 0.7,
  /**
   * Ganancia de los buses antes del volumen del jugador. Todo a −6 dB respecto a la mezcla medida en
   * tools/build_audio.py (mismo equilibrio): así los disparos llegan al compresor final por debajo de su umbral y
   * la música no «bombea» en combate.
   */
  musicGain: 0.45,
  sfxGain: 0.42,
  ambGain: 0.4,
  /** Margen antes del compresor final (−3 dB). */
  headroom: 0.7,
  /** Voces de efectos a la vez en total. */
  maxVoices: 40,
  /** Ruta de los sonidos, relativa a la base del juego. */
  dir: 'assets/audio/',
  sfx: {
    // Armas
    nail: S(3.1, 3, 0.05, 1.2),
    rivet: S(1.4, 3, 0.06, 1),
    shotgun: S(3.25, 2, 0.08, 0.8, { reverb: 0.25 }),
    rifle: S(3.65, 2, 0.1, 0.6, { reverb: 0.3, duck: 0.15 }),
    dart: S(1.25, 4, 0.03, 1.5, { reverb: 0.05 }),
    shot: S(1.35, 3, 0.07, 1),
    throw: S(1.05, 2, 0.08, 1.5, { reverb: 0.05 }),
    molotov: S(1.65, 3, 0.08, 1, { reverb: 0.25 }),
    pop: S(2.4, 4, 0.04, 1.5, { reverb: 0.25 }),
    slam: S(3.0, 2, 0.1, 0.8, { duck: 0.25, reverb: 0.25 }),
    sonic: S(1.2, 2, 0.1, 0.8, { reverb: 0.2 }),
    tesla: S(2.0, 3, 0.06, 2),
    defib: S(3.7, 3, 0.08, 1),
    zap: S(2.9, 3, 0.06, 2),
    eshot: S(1.35, 3, 0.07, 1, { reverb: 0.35 }),
    // Impactos y muertes (con cientos de enemigos: pocas voces y separadas)
    hit: S(0.55, 4, 0.035, 2, { reverb: 0.05 }),
    hitMetal: S(0.8, 4, 0.04, 2, { reverb: 0.1 }),
    kill: S(0.87, 4, 0.05, 2),
    killMetal: S(1.05, 3, 0.06, 1.5),
    boom: S(2.8, 3, 0.08, 1.5, { duck: 0.35, reverb: 0.35 }),
    // Jugador
    hurt: S(1.7, 1, 0.15, 1, { duck: 0.3, reverb: 0.05, priority: true }),
    dodge: S(1.1, 1, 0.1, 1.5, { reverb: 0.05, priority: true }),
    pickup: S(0.73, 4, 0.04, 0, { reverb: 0.05 }),
    geiger: S(2.6, 6, 0.012, 3, { reverb: 0 }),
    death: S(2.4, 1, 1, 0, { duck: 0.6, reverb: 0.4, priority: true }),
    // Avisos e interfaz
    boss: S(2.8, 1, 3, 0, { duck: 0.5, reverb: 0.4, priority: true }),
    level: S(1.05, 1, 0.2, 0, { ui: true, priority: true }),
    chest: S(1.35, 1, 0.3, 0, { ui: true, duck: 0.3, priority: true }),
    select: S(1.9, 2, 0.03, 1, { ui: true, priority: true }),
    win: S(1.4, 1, 0.5, 0, { ui: true, duck: 0.5, priority: true }),
    victory: S(2.1, 1, 1, 0, { ui: true, duck: 0.6, priority: true }),
  } satisfies Record<string, SfxDef>,
  /** Tono de la chatarra: sube medio tono por recogida seguida (separadas menos de `gap` s), hasta `max`. */
  pickupChain: { gap: 0.35, max: 7 },
  /** Posición en el estéreo: `pan` a un ancho de pantalla, y caída de volumen con la distancia (en pantallas). */
  space: { pan: 0.85, near: 0.35, falloff: 1.4, farReverb: 0.4, cull: 1.8 },
  /** Bajada de la música en los golpes grandes: entra en `attack` s y vuelve en `release` s. */
  duck: { attack: 0.03, release: 0.9 },
  /** Reverb sintetizada: cola del páramo abierto. Sin graves en el envío y con un poco de retardo previo. */
  reverb: { seconds: 2.2, decay: 3.2, damp: 4500, highpass: 250, predelay: 0.03, wet: 0.5 },
  music: {
    /** Fundido entre pistas, en s. */
    crossfade: 4,
    /** Pistas de cada momento; se barajan y se encadenan. */
    tracks: {
      menu: ['menu_1', 'menu_2', 'menu_3'],
      run: ['run_1', 'run_2', 'run_3'],
      boss: ['boss_1'],
    },
    /** Los discos de los menús suenan por una radio vieja del búnker. */
    radio: { lo: 180, hi: 4200 },
  } satisfies { crossfade: number; tracks: Record<MusicMood, readonly string[]>; radio: object },
  amb: {
    /** Lecho de cada momento. */
    bed: { menu: 'bunker', run: 'wind', boss: 'wind' } satisfies Record<MusicMood, string>,
    bedGain: 0.9,
    fade: 3,
    /** Sonidos sueltos del páramo durante la run: cada cuánto (s, mín–máx) y volumen. */
    oneShots: {
      thunder: { every: [28, 70], gain: 0.55 },
      gust: { every: [18, 40], gain: 0.4 },
      far: { every: [60, 140], gain: 0.45 },
    },
  },
  /**
   * Música según la partida (dossier §13): con más enemigos sube la música y baja el viento; con poca vida todo se
   * apaga (filtro de paso bajo) y se oye el corazón. Con la racha la música brilla un poco más.
   */
  layers: {
    /** Enemigos en pantalla que cuentan como intensidad 1. */
    fullAt: 110,
    /** Lo que suma una horda avisada o un élite vivo. */
    horde: 0.35,
    elite: 0.2,
    fade: 0.8,
    lowHp: 0.3,
    lowpass: { open: 20000, closed: 750 },
    /** Volumen de la música con intensidad 0 y 1, y del viento. */
    music: [0.7, 1],
    wind: [1, 0.55],
    heartbeat: { bpm: 72, gain: 0.5 },
  },
  /** Chasquidos del Geiger por segundo a RAD 100. */
  geigerRate: 14,
} as const;

export type SoundId = keyof typeof AUDIO.sfx;
