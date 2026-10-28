// Armas y fusiones («Apaño»). Valores de partida del prototipo; nombres y textos en i18n (`weapons.<id>`).
// DECISIÓN: se usan las armas del prototipo y de la biblia de arte en vez de la tabla de 03_CONTENT.md.
// Para llegar a 12+ armas se añaden `megafono` y `rifle_cerrojo`, y dos fusiones nuevas
// (`nucleo_inestable`, `dardos_incendiarios`) para completar las 4 del MVP.

export type WeaponKind =
  | 'orbit'
  | 'bullet'
  | 'fan'
  | 'shotgun'
  | 'lob'
  | 'chain'
  | 'aura'
  | 'slam'
  | 'mines'
  | 'zap'
  | 'orb'
  | 'cone'
  | 'rifle'
  | 'unstable'
  | 'firedarts';

interface WeaponBase {
  readonly kind: WeaponKind;
  /** Exclusiva de un superviviente. */
  readonly owner?: string;
  readonly fusion?: boolean;
  /** Recibe el bonus de cuerpo a cuerpo. */
  readonly melee?: boolean;
  /** Color del placeholder y de los proyectiles. */
  readonly color: string;
}

export const WEAPONS = {
  llave: {
    kind: 'orbit',
    melee: true,
    orbit: 74,
    size: 10,
    dmg: 12,
    dmgPerLvl: 0.15,
    hitCd: 0.45,
    spin: 3.2,
    color: '#d8d8d8',
  },
  pistola_clavos: {
    kind: 'bullet',
    range: 560,
    dmg: 8,
    cd: 0.4,
    cdPerLvl: 0.9,
    speed: 560,
    spread: 0.1,
    color: '#e6e6a8',
  },
  jeringa: {
    kind: 'fan',
    range: 520,
    dmg: 10,
    cd: 1.0,
    speed: 430,
    fan: 0.55,
    healBase: 1,
    healPerLvl: 0.5,
    color: '#9fe6ff',
  },
  coctel: {
    kind: 'lob',
    range: 380,
    cd: 2.2,
    flight: 0.5,
    poolR: 58,
    poolTick: 0.25,
    dmg: 5,
    dmgPerLvl: 0.2,
    dur: 2.5,
    durPerLvl: 0.5,
    color: '#ff8a2a',
  },
  tesla: {
    kind: 'chain',
    range: 320,
    dmg: 15,
    dmgPerLvl: 0.2,
    cd: 1.4,
    jump: 160,
    jumps: 4,
    jumpsPerLvl: 2,
    color: '#7fd8ff',
  },
  geiger: {
    kind: 'aura',
    dmg: 4,
    dmgPerLvl: 0.2,
    tickCd: 0.3,
    r: 72,
    rPerLvl: 14,
    rPerRad: 0.9,
    color: '#7dff6a',
  },
  escopeta_chatarra: {
    kind: 'shotgun',
    range: 300,
    dmg: 7,
    cd: 1.3,
    pellets: 6,
    pelletsPerLvl: 2,
    cone: 0.8,
    speed: 620,
    life: 0.38,
    color: '#ffd27a',
  },
  megafono: {
    kind: 'cone',
    range: 230,
    dmg: 14,
    dmgPerLvl: 0.15,
    cd: 1.0,
    angle: 0.9,
    anglePerLvl: 0.15,
    kb: 2.0,
    kbPerLvl: 0.3,
    color: '#f3e9d2',
  },
  rifle_cerrojo: {
    kind: 'rifle',
    range: 760,
    dmg: 40,
    dmgPerLvl: 0.2,
    cd: 1.6,
    pierce: 3,
    speed: 900,
    color: '#c9b27a',
  },
  // Exclusivas
  martillo_pilon: {
    kind: 'slam',
    owner: 'dot',
    melee: true,
    cd: 1.6,
    r: 85,
    rPerLvl: 10,
    dmg: 22,
    dmgPerLvl: 0.2,
    kb: 2.2,
    color: '#e8a33a',
  },
  petardos: {
    kind: 'mines',
    owner: 'benny',
    step: 70,
    stepPerLvl: -8,
    fuse: 0.5,
    r: 45,
    rPerLvl: 5,
    dmg: 14,
    dmgPerLvl: 0.15,
    maxMines: 80,
    color: '#ff5a5a',
  },
  desfibrilador: {
    kind: 'zap',
    owner: 'mae',
    cd: 2.0,
    range: 260,
    targets: 2,
    dmg: 16,
    dmgPerLvl: 0.15,
    regenBonus: 0.4,
    kb: 0.8,
    color: '#ffe14a',
  },
  nucleo_cobalto: {
    kind: 'orb',
    owner: 'errante',
    cd: 1.5,
    speed: 260,
    life: 2.2,
    size: 9,
    dmg: 20,
    dmgPerLvl: 0.2,
    pierce: 1,
    radBonus: 0.02,
    color: '#4aff9a',
  },
  // Fusiones
  dinamo: {
    kind: 'orbit',
    fusion: true,
    melee: true,
    count: 3,
    orbit: 92,
    size: 12,
    dmg: 34,
    hitCd: 0.45,
    spin: 3.6,
    chainJumps: 3,
    chainDmg: 18,
    color: '#7fd8ff',
  },
  remachadora: {
    kind: 'bullet',
    fusion: true,
    range: 620,
    dmg: 14,
    cd: 0.22,
    count: 3,
    pierce: 4,
    speed: 720,
    spread: 0.08,
    color: '#ffb347',
  },
  nucleo_inestable: {
    kind: 'unstable',
    fusion: true,
    dmg: 8,
    tickCd: 0.3,
    r: 120,
    rPerRad: 1.2,
    boltCd: 0.5,
    bolts: 2,
    boltDmg: 25,
    boltRadBonus: 0.01,
    color: '#b6ff3a',
  },
  dardos_incendiarios: {
    kind: 'firedarts',
    fusion: true,
    range: 540,
    dmg: 14,
    cd: 0.9,
    count: 6,
    speed: 460,
    fan: 0.7,
    poolR: 34,
    poolDmg: 4,
    poolDur: 1.5,
    healBase: 2,
    color: '#ff9f5a',
  },
} as const satisfies Record<string, WeaponBase & Record<string, unknown>>;

export type WeaponId = keyof typeof WEAPONS;
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export interface FusionDef {
  readonly a: WeaponId;
  readonly b: WeaponId;
  readonly result: WeaponId;
}

export const FUSIONS: readonly FusionDef[] = [
  { a: 'llave', b: 'tesla', result: 'dinamo' },
  { a: 'pistola_clavos', b: 'escopeta_chatarra', result: 'remachadora' },
  { a: 'geiger', b: 'megafono', result: 'nucleo_inestable' },
  { a: 'jeringa', b: 'coctel', result: 'dardos_incendiarios' },
];

/** Daño al nivel `lvl` para armas con `dmgPerLvl` (+x por nivel sobre el base). */
export const scaled = (base: number, perLvl: number, lvl: number): number => base * (1 + perLvl * (lvl - 1));

/** Fuentes de daño para las estadísticas: armas, consumibles y efectos. */
export const DAMAGE_SOURCES = [...WEAPON_IDS, 'granada', 'hinchado', 'bomba'] as const;
export type DamageSource = (typeof DAMAGE_SOURCES)[number];
export const SOURCE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  DAMAGE_SOURCES.map((s, i) => [s, i]),
);
