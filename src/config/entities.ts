// Registro de entidades según la «Biblia de arte y manifiesto de assets» (2026-10-27).
// El ID es la clave en código, en rutas de sprites y en i18n (`entities.<id>`).
// Tamaño relativo: rata/dron = 1. Radio de colisión y escala del sprite salen de aquí.

export type Category = 'characters' | 'enemies' | 'bosses' | 'props';
export type AnimMethod = 'mixamo' | 'rigid' | 'deform' | 'rigid_mixamo' | 'static';
export type Availability = 'playable' | 'later' | 'locked';
export type AnimId =
  'idle' | 'run' | 'move' | 'hit' | 'attack' | 'attack_1' | 'attack_2' | 'death' | 'victory';

/** Animaciones por tipo (biblia §5). */
export const ANIMS_BY_CATEGORY: Record<Category, readonly AnimId[]> = {
  characters: ['idle', 'run', 'hit', 'death', 'victory'],
  enemies: ['move', 'attack', 'death'],
  bosses: ['idle', 'move', 'attack_1', 'attack_2', 'death'],
  props: [],
};

interface EntityInput {
  readonly category: Category;
  readonly size: number;
  readonly color: string;
  readonly method: AnimMethod;
  /** Acto en el que aparece; fuera de él solo sale en eventos especiales. */
  readonly act: 1 | 2 | 3;
  /** Solo supervivientes. */
  readonly status?: Availability;
  /** Variante de fase de un jefe: comparte animaciones con la base. */
  readonly variantOf?: string;
  /** Animaciones extra (p. ej. `idle` en enemigos estáticos). */
  readonly extraAnims?: readonly AnimId[];
  /** Props: superviviente o enemigo que la usa. */
  readonly owner?: string;
}

const DEFS = {
  // ---------- Supervivientes (characters) ----------
  dot: { category: 'characters', size: 1.3, color: '#E8A33A', method: 'mixamo', act: 1, status: 'playable' },
  mae: { category: 'characters', size: 1.3, color: '#F07FA8', method: 'mixamo', act: 1, status: 'locked' },
  errante: {
    category: 'characters',
    size: 1.3,
    color: '#C9B27A',
    method: 'mixamo',
    act: 1,
    status: 'locked',
  },
  benny: {
    category: 'characters',
    size: 1.3,
    color: '#5FB0FF',
    method: 'mixamo',
    act: 1,
    status: 'playable',
  },
  // DECISIÓN: la biblia da «negro / carmesí» para Silas; el color de firma es el carmesí.
  silas: { category: 'characters', size: 1.3, color: '#8B1E2D', method: 'mixamo', act: 1, status: 'locked' },
  gus: { category: 'characters', size: 1.3, color: '#3FB7A9', method: 'mixamo', act: 1, status: 'playable' },
  ilse: { category: 'characters', size: 1.3, color: '#2EC4B6', method: 'mixamo', act: 1, status: 'locked' },
  kip: { category: 'characters', size: 1.0, color: '#8FE3B0', method: 'rigid', act: 1, status: 'locked' },
  rosalind: {
    category: 'characters',
    size: 1.3,
    color: '#6B7A3A',
    method: 'mixamo',
    act: 1,
    status: 'locked',
  },

  // ---------- Enemigos (enemies) ----------
  // DECISIÓN: la biblia no fija color de firma para enemigos; se usan los del prototipo.
  // Hinchado y cortacésped no salen en oleadas ni guarniciones: quedan para futuros eventos.
  dron: { category: 'enemies', size: 0.8, color: '#9FB3C0', method: 'rigid', act: 2 },
  necrofago: { category: 'enemies', size: 1.3, color: '#8F9A6A', method: 'mixamo', act: 1 },
  saqueador: { category: 'enemies', size: 1.3, color: '#B0533C', method: 'mixamo', act: 3 },
  tirador: { category: 'enemies', size: 1.3, color: '#D08A3A', method: 'mixamo', act: 3 },
  reptador: { category: 'enemies', size: 1.2, color: '#6FBF4A', method: 'mixamo', act: 1 },
  hinchado: { category: 'enemies', size: 1.6, color: '#D6C38A', method: 'deform', act: 1 },
  cortacesped: { category: 'enemies', size: 1.5, color: '#8AA0B0', method: 'rigid', act: 1 },
  torreta: {
    category: 'enemies',
    size: 1.6,
    color: '#9A6AC9',
    method: 'rigid',
    act: 2,
    extraAnims: ['idle'],
  },
  babosa: { category: 'enemies', size: 1.8, color: '#4F6B2A', method: 'deform', act: 1 },
  aspiradora: { category: 'enemies', size: 1.7, color: '#B8A070', method: 'rigid', act: 2 },
  aspiradora_cria: { category: 'enemies', size: 0.4, color: '#D8C090', method: 'rigid', act: 2 },
  excavadora: { category: 'enemies', size: 1.8, color: '#C9A04A', method: 'rigid', act: 2 },
  blindado: { category: 'enemies', size: 1.5, color: '#7A7A7A', method: 'mixamo', act: 3 },
  // Tirador especial (CAMBIOS §3). Modelo sin esqueleto: lo monta y anima tools/render_mortero.py.
  mortero: { category: 'enemies', size: 1.6, color: '#8A6A4A', method: 'rigid_mixamo', act: 3 },
  predicador: { category: 'enemies', size: 1.4, color: '#F0E070', method: 'mixamo', act: 3 },
  // Robot de carrera (CAMBIOS §2).
  interceptor: { category: 'enemies', size: 1.1, color: '#3FE0FF', method: 'rigid', act: 2 },
  // Copia del jugador (evento «Tú mismo, otra vez»): se dibuja con los sprites de su personaje (`Enemy.skin`).
  copia: { category: 'enemies', size: 1.3, color: '#C070FF', method: 'mixamo', act: 1 },
  // Tiradores y corredores nuevos.
  liquidador: { category: 'enemies', size: 1.3, color: '#8FD14A', method: 'rigid_mixamo', act: 1 },
  sabueso: { category: 'enemies', size: 1.2, color: '#D9E04A', method: 'rigid', act: 1 },
  bidonero: { category: 'enemies', size: 1.6, color: '#5E9C3A', method: 'rigid_mixamo', act: 1 },
  nevera: { category: 'enemies', size: 1.7, color: '#BFE6F2', method: 'rigid', act: 2 },
  motorista: { category: 'enemies', size: 1.5, color: '#C06A2A', method: 'rigid', act: 3 },
  moscon: { category: 'enemies', size: 0.8, color: '#3AA0A0', method: 'rigid', act: 2 },

  // ---------- Jefes (bosses) y variantes de fase ----------
  rey_rata: { category: 'bosses', size: 4, color: '#7A5A40', method: 'mixamo', act: 1 },
  rey_rata_dmg: {
    category: 'bosses',
    size: 4,
    color: '#7A5A40',
    method: 'mixamo',
    act: 1,
    variantOf: 'rey_rata',
  },
  // DECISIÓN: el Dirigible es una mole que tapa el cielo, 3,5 veces su tamaño original (5).
  dirigible: { category: 'bosses', size: 17.5, color: '#C8B0E0', method: 'rigid', act: 2 },
  dirigible_dmg: {
    category: 'bosses',
    size: 17.5,
    color: '#C8B0E0',
    method: 'rigid',
    act: 2,
    variantOf: 'dirigible',
  },
  coloso: { category: 'bosses', size: 6, color: '#8C8C84', method: 'mixamo', act: 3 },
  coloso_p2: { category: 'bosses', size: 6, color: '#8C8C84', method: 'mixamo', act: 3, variantOf: 'coloso' },
  coloso_p3: { category: 'bosses', size: 6, color: '#8C8C84', method: 'mixamo', act: 3, variantOf: 'coloso' },

  // ---------- Props y armas (props) ----------
  llave: { category: 'props', size: 0.5, color: '#D8D8D8', method: 'static', act: 1, owner: 'dot' },
  martillo_pilon: { category: 'props', size: 0.5, color: '#E8A33A', method: 'static', act: 1, owner: 'dot' },
  jeringa: { category: 'props', size: 0.5, color: '#9FE6FF', method: 'static', act: 1, owner: 'mae' },
  desfibrilador: { category: 'props', size: 0.5, color: '#FFE14A', method: 'static', act: 1, owner: 'mae' },
  escopeta_chatarra: {
    category: 'props',
    size: 0.5,
    color: '#FFD27A',
    method: 'static',
    act: 1,
    owner: 'errante',
  },
  nucleo_cobalto: {
    category: 'props',
    size: 0.5,
    color: '#4AFF9A',
    method: 'static',
    act: 1,
    owner: 'errante',
  },
  pistola_clavos: {
    category: 'props',
    size: 0.5,
    color: '#E6E6A8',
    method: 'static',
    act: 1,
    owner: 'benny',
  },
  petardos: { category: 'props', size: 0.5, color: '#FF5A5A', method: 'static', act: 1, owner: 'benny' },
  rifle_tirador: {
    category: 'props',
    size: 0.5,
    color: '#A08060',
    method: 'static',
    act: 1,
    owner: 'tirador',
  },
  escudo_puerta: {
    category: 'props',
    size: 0.5,
    color: '#7A7A7A',
    method: 'static',
    act: 2,
    owner: 'blindado',
  },
} as const satisfies Record<string, EntityInput>;

export type EntityId = keyof typeof DEFS;
type IdsOf<C extends Category> = {
  [K in EntityId]: (typeof DEFS)[K]['category'] extends C ? K : never;
}[EntityId];
export type SurvivorId = IdsOf<'characters'>;
export type EnemyId = IdsOf<'enemies'>;
export type BossId = IdsOf<'bosses'>;
export type PropId = IdsOf<'props'>;

export interface EntityDef extends EntityInput {
  readonly id: EntityId;
  readonly anims: readonly AnimId[];
}

function build(): Record<EntityId, EntityDef> {
  const out: Partial<Record<EntityId, EntityDef>> = {};
  for (const [id, d] of Object.entries(DEFS) as [EntityId, EntityInput][]) {
    out[id] = { ...d, id, anims: [...ANIMS_BY_CATEGORY[d.category], ...(d.extraAnims ?? [])] };
  }
  // Se recorren todas las claves de DEFS, así que el registro queda completo.
  return out as Record<EntityId, EntityDef>;
}

export const ENTITIES = build();

export const ENTITY_IDS = Object.keys(ENTITIES) as EntityId[];

export function isEntityId(id: string): id is EntityId {
  return Object.prototype.hasOwnProperty.call(ENTITIES, id);
}

export function getEntity(id: EntityId): EntityDef {
  return ENTITIES[id];
}

/** Clave de una hoja de sprites: `<id>_<anim>`. */
export const sheetKey = (id: string, anim: string): string => `${id}_${anim}`;

/** Ruta de una hoja relativa a `assets/sprites`, sin extensión (formato de `manifest.json`). */
export const sheetPath = (def: EntityDef, anim: AnimId): string =>
  `${def.category}/${def.id}/${sheetKey(def.id, anim)}`;

/** Icono 128×128 de un arma o prop, relativo a `assets/`. */
export const iconPath = (id: PropId): string => `icons/${id}.png`;

/** Prioridad de arte del Acto 1 (biblia §10): jugables, enemigos del acto 1, jefes base y armas de los jugables. */
export function act1Priority(): EntityId[] {
  const playable = new Set<string>(ENTITY_IDS.filter((id) => ENTITIES[id].status === 'playable'));
  return ENTITY_IDS.filter((id) => {
    const d = ENTITIES[id];
    switch (d.category) {
      case 'characters':
        return playable.has(id);
      case 'enemies':
        return d.act === 1;
      case 'bosses':
        return !d.variantOf;
      case 'props':
        return d.owner !== undefined && playable.has(d.owner);
    }
  });
}
