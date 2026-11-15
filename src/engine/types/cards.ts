import type { ItemId } from '../../config/items';
import type { Rarity, TraitId } from '../../config/traits';
import type { WeaponId } from '../../config/weapons';

export type Card =
  | { kind: 'up' | 'new' | 'fusion'; id: WeaponId }
  | { kind: 'trait'; id: TraitId; rarity: Rarity; value: number }
  | { kind: 'item'; id: ItemId }
  | { kind: 'coupons'; n: number }
  | { kind: 'heal' }
  | { kind: 'purge' };

export interface Choice {
  /**
   * `cache`: tragaperras del cofre especial (una tarjeta de cupones y un nivel). `endless`: ha caído el Coloso y se
   * pregunta si seguir en el modo infinito (sin tarjetas).
   */
  type: 'level' | 'item' | 'cache' | 'endless';
  cards: Card[];
}
