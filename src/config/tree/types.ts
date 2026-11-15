// Tipos del árbol: mejoras especiales, tamaños, ganancias y nodos.
import type { StatKey } from '../traits';

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
