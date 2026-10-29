// Parámetros del audio procedural (04_ART_UI.md §4).
export type MusicMood = 'menu' | 'run' | 'boss';

export interface MusicDef {
  readonly bpm: number;
  /** 0 = recto, 0,33 ≈ swing. */
  readonly swing: number;
  /** Raíces MIDI de cada compás. */
  readonly prog: readonly number[];
  /** Intervalos del bajo por negra. */
  readonly bass: readonly number[];
  readonly chord: readonly number[];
  readonly arp: readonly number[];
  readonly kick: boolean;
}

export const AUDIO = {
  defaultMusic: 0.5,
  defaultSfx: 0.7,
  musicGain: 0.5,
  sfxGain: 0.6,
  /** Separación mínima entre dos sonidos iguales, en s (evita saturar con 300 enemigos). */
  minGap: {
    shot: 0.06,
    hit: 0.04,
    kill: 0.05,
    pickup: 0.05,
    hurt: 0.15,
    boom: 0.08,
    zap: 0.08,
    geiger: 0.02,
  } as Readonly<Record<string, number>>,
  /** Tono de la chatarra: sube medio tono por recogida seguida (separadas menos de `gap` s), hasta `max`. */
  pickupChain: { base: 900, gap: 0.35, max: 24 },
  /** Chasquidos del Geiger por segundo a RAD 100. */
  geigerRate: 14,
  music: {
    // Swing doo-wop: I–vi–IV–V en Do.
    menu: {
      bpm: 112,
      swing: 0.33,
      prog: [60, 57, 53, 55],
      bass: [0, 4, 7, 9],
      chord: [0, 4, 7],
      arp: [],
      kick: false,
    },
    // Electrónica retro con tensión en La menor.
    run: {
      bpm: 128,
      swing: 0,
      prog: [57, 57, 53, 55],
      bass: [0, 0, 7, 3],
      chord: [0, 3, 7],
      arp: [0, 3, 7, 10, 7, 3],
      kick: true,
    },
    boss: {
      bpm: 144,
      swing: 0,
      prog: [57, 58, 57, 52],
      bass: [0, 0, 1, 0],
      chord: [0, 3, 6],
      arp: [0, 6, 3, 9],
      kick: true,
    },
  } satisfies Record<MusicMood, MusicDef>,
} as const;
