// Iconos 128×128 de armas y rasgos (`assets/icons/`, recortados con tools/slice_icons.py). Los publica el plugin artAssets.
import type { TraitId } from '../config/traits';
import type { WeaponId } from '../config/weapons';

const BASE = `${import.meta.env.BASE_URL}assets/icons/`;

export const weaponIcon = (id: WeaponId): string => `${BASE}${id}.png`;
export const traitIcon = (id: TraitId): string => `${BASE}traits/${id}.png`;

/** Icono de una fuente de daño del resumen: las armas tienen; granadas, bombas y barriles aún no. */
export const sourceIcon = (src: string): string | undefined =>
  src === 'granada' || src === 'hinchado' || src === 'bomba' || src === 'barril'
    ? undefined
    : weaponIcon(src as WeaponId);
