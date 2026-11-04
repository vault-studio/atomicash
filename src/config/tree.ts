// Árbol de cada superviviente: nodos unidos al centro que se aprenden con puntos. Los puntos salen del nivel y de las
// estrellas del personaje y se pueden recolocar gratis en cualquier momento.
// DECISIÓN (usuario, 2026-11-04): tres ramas. Radiación, igual para todos, con dos caminos (resistir o aprovechar la
// RAD alta); Pasiva y Oficio, propias de cada personaje; y nodos mixtos que unen las ramas. Sustituye al árbol pagado
// con chapas. Con 15 puntos y 7 nodos por rama caben dos ramas completas y uno más, o cualquier reparto mixto.
import { TUNING } from './tuning';
import type { StatKey } from './traits';
import type { RosterId } from './survivors';

/**
 * Mejoras de run que no son rasgos. Salvo que se diga otra cosa, `v` es un porcentaje.
 * - Run: `coupons` cupones · `banish`, `lock`, `reroll` usos por partida · `hunter` daño a jefes y élites ·
 *   `coldBlood` racha que se conserva al recibir un golpe · `smuggler` la tragaperras tira dos veces (1 = sí).
 * - Armas: `melee` cuerpo a cuerpo · `starter` arma inicial y su fusión · `fusionDmg` armas fusionadas · `burnDmg`
 *   quemaduras · `meleeStun` probabilidad de aturdir cuerpo a cuerpo · `meleeHeal` PV por baja cuerpo a cuerpo.
 * - Consumibles: `consDur` duración · `stimHeal` curación del estimulante · `consExtra` unidades más de cada tipo al
 *   salir · `consSave` probabilidad de no gastarlo.
 * - Radiación: `radRes` menos RAD recibida · `radPen` menos pérdida de PV máximos por RAD · `radSave` una vez por
 *   partida, sobrevive a la RAD máxima · `radBoost` bonus de daño de los tramos de RAD · con RAD alta
 *   (`TREE_FX.highRad`): `radHighDmg` daño, `radHighCd` enfriamiento, `radHighRegen` PV/s.
 * - Movimiento: `moveDmg` daño mientras se mueve · `dodgeRush` velocidad tras esquivar (`TREE_FX.rushDur` s) ·
 *   `levelHeal` % de PV al subir de nivel.
 */
export type TreeMod =
  | 'coupons'
  | 'banish'
  | 'lock'
  | 'reroll'
  | 'hunter'
  | 'coldBlood'
  | 'smuggler'
  | 'melee'
  | 'starter'
  | 'fusionDmg'
  | 'burnDmg'
  | 'meleeStun'
  | 'meleeHeal'
  | 'consDur'
  | 'stimHeal'
  | 'consExtra'
  | 'consSave'
  | 'radRes'
  | 'radPen'
  | 'radSave'
  | 'radBoost'
  | 'radHighDmg'
  | 'radHighCd'
  | 'radHighRegen'
  | 'moveDmg'
  | 'dodgeRush'
  | 'levelHeal';

export type NodeSize = 'small' | 'big' | 'unique';

/** Lo que da un nodo: un rasgo o un modificador, y cuánto. */
export interface NodeGain {
  readonly stat?: StatKey;
  readonly mod?: TreeMod;
  /** Cuánto suma: puntos del rasgo o del modificador. */
  readonly v: number;
}

/**
 * Rama del nodo: `r` tronco de Radiación, `ra` camino de resistencia, `rb` camino de mutación, `p` Pasiva, `l` Oficio
 * (la historia del personaje) y `m` mixto.
 */
export type TreeBranch = 'root' | 'r' | 'ra' | 'rb' | 'p' | 'l' | 'm';

export interface TreeNode {
  readonly size: NodeSize;
  /** Posición en el dibujo, en unidades de 0 a 100 (centro en 50, 50). */
  readonly x: number;
  readonly y: number;
  /** Nodos con los que se une (la unión vale en los dos sentidos). */
  readonly links: readonly string[];
  readonly branch: TreeBranch;
  /** Lo que da. Uno, salvo los mixtos, que dan dos cosas más pequeñas. */
  readonly gains: readonly NodeGain[];
}

/** Punto de una rama a `d` (0–1) del centro, en el ángulo `deg` (0 = derecha, sentido horario en pantalla). */
const at = (deg: number, d: number): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return {
    x: Math.round((50 + Math.cos(a) * d * 46) * 10) / 10,
    y: Math.round((50 + Math.sin(a) * d * 46) * 10) / 10,
  };
};

// Ángulos de las ramas: Radiación arriba (con un camino a cada lado), Pasiva abajo a la izquierda y Oficio abajo a la
// derecha. Los mixtos quedan entre dos ramas, en dos alturas, y permiten cruzar de una a otra sin volver al centro.
// Pasiva y Oficio van en zigzag (`ZIG` grados a cada lado): siete nodos en línea recta no caben en el radio.
const ZIG = 12;
const P = 150;
const L = 30;
const RA = -112;
const RB = -68;
const MRP = 199;
const MPL = 90;
const MLR = -19;

const SHAPE = {
  root: { size: 'small', ...at(0, 0), links: ['rT', 'p1', 'l1'], branch: 'root' },
  rT: { size: 'small', ...at(-90, 0.2), links: ['rA1', 'rB1'], branch: 'r' },
  rA1: { size: 'small', ...at(RA, 0.42), links: ['rA2', 'mRP1'], branch: 'ra' },
  rA2: { size: 'big', ...at(RA, 0.66), links: ['rAU', 'mRP2'], branch: 'ra' },
  rAU: { size: 'unique', ...at(RA, 0.94), links: [], branch: 'ra' },
  rB1: { size: 'small', ...at(RB, 0.42), links: ['rB2', 'mLR1'], branch: 'rb' },
  rB2: { size: 'big', ...at(RB, 0.66), links: ['rBU', 'mLR2'], branch: 'rb' },
  rBU: { size: 'unique', ...at(RB, 0.94), links: [], branch: 'rb' },
  p1: { size: 'small', ...at(P, 0.19), links: ['p2'], branch: 'p' },
  p2: { size: 'small', ...at(P - ZIG, 0.32), links: ['p3', 'mRP1', 'mPL1'], branch: 'p' },
  p3: { size: 'small', ...at(P + ZIG, 0.45), links: ['pB'], branch: 'p' },
  pB: { size: 'big', ...at(P, 0.57), links: ['p4'], branch: 'p' },
  p4: { size: 'small', ...at(P - ZIG, 0.7), links: ['p5', 'mRP2', 'mPL2'], branch: 'p' },
  p5: { size: 'small', ...at(P + ZIG, 0.82), links: ['pU'], branch: 'p' },
  pU: { size: 'unique', ...at(P, 0.95), links: [], branch: 'p' },
  l1: { size: 'small', ...at(L, 0.19), links: ['l2'], branch: 'l' },
  l2: { size: 'small', ...at(L - ZIG, 0.32), links: ['l3', 'mPL1', 'mLR1'], branch: 'l' },
  l3: { size: 'small', ...at(L + ZIG, 0.45), links: ['lB'], branch: 'l' },
  lB: { size: 'big', ...at(L, 0.57), links: ['l4'], branch: 'l' },
  l4: { size: 'small', ...at(L - ZIG, 0.7), links: ['l5', 'mPL2', 'mLR2'], branch: 'l' },
  l5: { size: 'small', ...at(L + ZIG, 0.82), links: ['lU'], branch: 'l' },
  lU: { size: 'unique', ...at(L, 0.95), links: [], branch: 'l' },
  mRP1: { size: 'small', ...at(MRP, 0.42), links: [], branch: 'm' },
  mRP2: { size: 'small', ...at(MRP, 0.74), links: [], branch: 'm' },
  mPL1: { size: 'small', ...at(MPL, 0.38), links: [], branch: 'm' },
  mPL2: { size: 'small', ...at(MPL, 0.72), links: [], branch: 'm' },
  mLR1: { size: 'small', ...at(MLR, 0.42), links: [], branch: 'm' },
  mLR2: { size: 'small', ...at(MLR, 0.74), links: [], branch: 'm' },
} as const satisfies Record<string, Omit<TreeNode, 'gains'>>;

export type TreeNodeId = keyof typeof SHAPE;
export const TREE_IDS = Object.keys(SHAPE) as TreeNodeId[];
export const TREE_ROOT: TreeNodeId = 'root';

type GainMap<K extends string> = Readonly<Record<K, readonly NodeGain[]>>;
type RadNodeId = 'rT' | 'rA1' | 'rA2' | 'rAU' | 'rB1' | 'rB2' | 'rBU';
type OwnNodeId = Exclude<TreeNodeId, 'root' | RadNodeId>;

const stat = (s: StatKey, v: number): NodeGain => ({ stat: s, v });
const mod = (m: TreeMod, v: number): NodeGain => ({ mod: m, v });

/** Rama de Radiación: la misma para todos. */
const RADIATION: GainMap<RadNodeId> = {
  rT: [mod('radRes', 5)],
  rA1: [mod('radRes', 15)],
  rA2: [mod('radPen', 50)],
  rAU: [mod('radSave', 1)],
  rB1: [mod('radHighDmg', 12)],
  rB2: [mod('radHighCd', 10)],
  rBU: [mod('radBoost', 50)],
};

/** Lo propio de cada superviviente: su Pasiva (`p`), su Oficio (`l`) y los mixtos (`m`). */
const OWN: Readonly<Record<RosterId, GainMap<OwnNodeId>>> = {
  // Dot, la mecánica: +15 % cuerpo a cuerpo. Pasiva: pegar fuerte de cerca. Oficio: el taller y sus fusiones.
  dot: {
    p1: [mod('melee', 6)],
    p2: [stat('kb', 15)],
    p3: [stat('hp', 10)],
    pB: [mod('meleeStun', 10)],
    p4: [mod('melee', 8)],
    p5: [stat('armor', 1)],
    pU: [mod('meleeHeal', 1)],
    l1: [mod('starter', 6)],
    l2: [mod('coupons', 8)],
    l3: [stat('cd', 3)],
    lB: [mod('reroll', 1)],
    l4: [mod('starter', 8)],
    l5: [mod('hunter', 15)],
    lU: [mod('fusionDmg', 20)],
    mRP1: [mod('radRes', 8), mod('melee', 4)],
    mRP2: [mod('radHighDmg', 6), mod('melee', 5)],
    mPL1: [mod('melee', 4), mod('starter', 4)],
    mPL2: [stat('armor', 1), stat('cd', 2)],
    mLR1: [stat('radDecay', 0.2), mod('starter', 4)],
    mLR2: [mod('radHighCd', 5), stat('crit', 2)],
  },
  // Gus, el cocinero: consumibles que duran más. Pasiva: la despensa. Oficio: los fogones del diner y su cóctel.
  gus: {
    p1: [mod('consDur', 15)],
    p2: [stat('hp', 12)],
    p3: [mod('stimHeal', 20)],
    pB: [mod('consExtra', 1)],
    p4: [mod('consDur', 20)],
    p5: [stat('regen', 0.3)],
    pU: [mod('consSave', 25)],
    l1: [mod('starter', 6)],
    l2: [stat('area', 6)],
    l3: [mod('coupons', 6)],
    lB: [mod('lock', 1)],
    l4: [mod('burnDmg', 20)],
    l5: [stat('luck', 4)],
    lU: [mod('levelHeal', 12)],
    mRP1: [mod('radRes', 8), mod('consDur', 8)],
    mRP2: [mod('radHighRegen', 0.4), stat('hp', 8)],
    mPL1: [mod('stimHeal', 10), mod('coupons', 4)],
    mPL2: [stat('regen', 0.2), stat('area', 4)],
    mLR1: [stat('radDecay', 0.2), stat('area', 4)],
    mLR2: [mod('radHighDmg', 6), mod('burnDmg', 10)],
  },
  // Benny, el mensajero: velocidad e imán. Pasiva: correr. Oficio: los recados y sus propinas.
  benny: {
    p1: [stat('spd', 3)],
    p2: [stat('mag', 12)],
    p3: [stat('dodge', 3)],
    pB: [mod('moveDmg', 8)],
    p4: [stat('spd', 4)],
    p5: [stat('dodge', 4)],
    pU: [mod('dodgeRush', 30)],
    l1: [mod('coupons', 8)],
    l2: [stat('xp', 6)],
    l3: [mod('starter', 6)],
    lB: [mod('banish', 1)],
    l4: [stat('luck', 4)],
    l5: [mod('coldBlood', 50)],
    lU: [mod('smuggler', 1)],
    mRP1: [mod('radRes', 8), stat('spd', 2)],
    mRP2: [mod('radHighCd', 5), stat('dodge', 2)],
    mPL1: [stat('mag', 8), mod('coupons', 4)],
    mPL2: [stat('xp', 3), stat('dodge', 2)],
    mLR1: [stat('radDecay', 0.2), stat('xp', 3)],
    mLR2: [mod('radHighDmg', 6), mod('starter', 4)],
  },
};

const gainsOf = (char: RosterId, id: TreeNodeId): readonly NodeGain[] => {
  if (id === 'root') return [];
  return id in RADIATION ? RADIATION[id as RadNodeId] : OWN[char][id as OwnNodeId];
};

const build = (char: RosterId): Record<TreeNodeId, TreeNode> =>
  Object.fromEntries(
    TREE_IDS.map((id) => [id, { ...SHAPE[id], gains: gainsOf(char, id) }]),
  ) as unknown as Record<TreeNodeId, TreeNode>;

/** Árbol completo (forma + lo que da cada nodo) de cada superviviente del plantel. */
export const TREES: Readonly<Record<RosterId, Readonly<Record<TreeNodeId, TreeNode>>>> = {
  dot: build('dot'),
  gus: build('gus'),
  benny: build('benny'),
};

/**
 * Puntos del árbol: uno cada `levelEvery` niveles y `perStar` por estrella. Con nivel 30 y 5 estrellas, 15. Cada nodo
 * cuesta un punto.
 */
export const TREE_POINTS = {
  levelEvery: 3,
  perStar: 1,
} as const;

export const treePointsFor = (level: number, stars: number): number =>
  Math.floor(level / TREE_POINTS.levelEvery) + stars * TREE_POINTS.perStar;

/** Valores de los efectos del árbol (`src/data/tuning.json` → `treeFx`). */
export const TREE_FX = TUNING.treeFx;

/** Árbol de un superviviente, o null si no es del plantel. */
export const treeOf = (id: string): Readonly<Record<TreeNodeId, TreeNode>> | null =>
  (TREES as Partial<Record<string, Readonly<Record<TreeNodeId, TreeNode>>>>)[id] ?? null;

/** Vecinos de un nodo (en los dos sentidos). */
export function treeNeighbors(id: TreeNodeId): TreeNodeId[] {
  const out = new Set<TreeNodeId>(SHAPE[id].links as readonly TreeNodeId[]);
  for (const k of TREE_IDS) if ((SHAPE[k].links as readonly string[]).includes(id)) out.add(k);
  return [...out];
}
