// Contenido del árbol: qué da cada nodo (rama común de Radiación y ramas propias de cada personaje).
import type { StatKey } from '../traits';
import type { RosterId } from '../survivors';
import type { TreeNodeId } from './shape';
import type { NodeGain, TreeMod } from './types';

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

export const gainsOf = (char: RosterId, id: TreeNodeId): readonly NodeGain[] => {
  if (id === 'root') return [];
  return id in RADIATION ? RADIATION[id as RadNodeId] : OWN[char][id as OwnNodeId];
};
