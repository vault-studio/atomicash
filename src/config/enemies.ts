// Balance de enemigos y jefes del Acto 1. Valores de partida del prototipo (atomic-ash-proto.html).
import { TUNING as T, type DeepReadonly, type Retype } from './tuning';
import { ENTITIES, type EntityId } from './entities';

export interface EnemyStats {
  readonly hp: number;
  /** Daño de contacto. */
  readonly dmg: number;
  /** px/s */
  readonly speed: number;
  readonly xp: number;
  /** Radio de colisión explícito; si falta, tamaño × ENEMY_RULES.radiusPerSize. */
  readonly r?: number;
  /** Resistencia al empuje: multiplica el empuje recibido (0 = inamovible). */
  readonly kbRes?: number;
  /** Multiplica el daño que recibe (0,6 = blindaje que para el 40 %). */
  readonly armor?: number;
  /** RAD que da su golpe de contacto. */
  readonly rad?: number;
  readonly boss?: boolean;
  /** Vuela: no colisiona, no hace daño de contacto y no lo alcanzan las armas de suelo. */
  readonly flying?: boolean;
  /** Máquina, chapa u hormigón: los golpes y la muerte suenan a metal en vez de a carne. */
  readonly metal?: boolean;
}

/**
 * Valores en `src/data/tuning.json` → `enemies`. Notas por campo:
 * - `blindado`: Tanque: lento, aguanta mucho (vida y chapa) y casi no se deja empujar.
 * - `predicador`: Apoyo: se queda a distancia y enfurece a los de alrededor con sus sermones.
 * - `excavadora`: Ariete: muy lenta, embiste con la pala, aguanta mucho y no se deja empujar.
 * - `rey_rata`: Jefes: no escalan con el tiempo ni se reciclan.
 * - `dirigible`: Choque fijo: el sprite es enorme (entities.ts) pero solo el casco recibe balas, y un radio así
 *   de grande agrandaría todas las consultas de la rejilla.
 */
export const ENEMY_STATS: Readonly<Record<keyof typeof T.enemies, EnemyStats>> = T.enemies;

export type StatEnemyId = keyof typeof ENEMY_STATS;
export const STAT_ENEMY_IDS = Object.keys(ENEMY_STATS) as StatEnemyId[];
export type BossKind = 'rey_rata' | 'dirigible' | 'coloso';
export const BOSS_IDS: readonly BossKind[] = ['rey_rata', 'dirigible', 'coloso'];
/** Enemigos normales (los que pueden salir en oleadas). */
export const MOB_IDS = STAT_ENEMY_IDS.filter((id) => !(ENEMY_STATS[id] as EnemyStats).boss);

export const statsOf = (id: StatEnemyId): EnemyStats => ENEMY_STATS[id];

/**
 * Parámetros de comportamiento (F2-03). Los tiempos van en segundos y las distancias en px de mundo.
 *
 * Valores en `src/data/tuning.json` → `ai`. Notas por campo:
 * - `tirador`: Se acerca hasta `hold` (algo menos que `range`) y ahí se planta quieto a disparar; `fireCd` ≈ su
 *   animación de disparo. Plantado, no vuelve a andar hasta que te alejas `hold + resume` (si no, da pasitos de
 *   correr en el sitio).
 * - `predicador`: Sermón cada `every` s si el jugador está a menos de `range`: enfurece (RAGE) al instante a los
 *   enemigos normales que tenga a `r` px. DECISIÓN: conviene matarlo primero, por eso no pega casi nada y se queda
 *   detrás.
 * - `rey_rata`: Ciclo: se para a llamar a las ratas (`summonStop` s) y luego encadena `chain` embestidas, cada
 *   una con su aviso (`aim`) y separadas solo `gap` s. `every` es lo que tarda en actuar al aparecer. DECISIÓN:
 *   antes alternaba una embestida y una llamada cada 3,8 s y pasaba casi todo el combate persiguiendo.
 * - `rey_rata.p2`: Fase 2 (por debajo de `p2`): más embestidas por ciclo, avisos más cortos y más ratas.
 * - `dirigible.lift`: Altura de vuelo en pantalla (los demás voladores usan ENEMY_RULES.flyHeight). El sprite es
 *   tan grande que ya queda muy por encima de su sombra; con más altura se saldría de la vista.
 * - `dirigible.laneR`: Anchura del pasillo que marca el bombardeo en el suelo.
 * - `coloso.stompR`: Salto: despega desde donde está y cae donde estaba el jugador al saltar, en `stompWarn` s,
 *   con una onda de `stompR`. DECISIÓN: zona grande pero que da tiempo: el más lento (190 px/s) sale en 1 s y le
 *   quedan 0,6 s para reaccionar.
 * - `coloso.jumpH`: Altura del salto en pantalla (px), para el dibujo.
 */
export const AI = T.ai as Retype<
  typeof T.ai,
  {
    rey_rata: { summonType: StatEnemyId };
    aspiradora: { childType: StatEnemyId };
    dirigible: { p2SummonType: StatEnemyId };
  }
>;

/** Sprite según la fase del jefe (biblia de arte: variantes `_dmg`, `_p2`, `_p3`). */
export const BOSS_VARIANTS: Readonly<
  Partial<Record<StatEnemyId, readonly { below?: number; phase?: number; id: EntityId }[]>>
> = {
  rey_rata: [{ below: 0.5, id: 'rey_rata_dmg' }],
  dirigible: [{ below: 0.5, id: 'dirigible_dmg' }],
  coloso: [
    { phase: 2, id: 'coloso_p2' },
    { phase: 3, id: 'coloso_p3' },
  ],
};

/**
 * Cada jefe sale al llegar a su minuto (`at`, en s) o a su número de bajas (`kills`), lo que pase antes.
 * DECISIÓN: quien mata rápido no espera al reloj; quien va lento tiene el jefe a su hora igualmente.
 */
export const BOSSES: Readonly<Record<BossKind, { at: number; kills: number }>> = T.bosses;

/**
 * Furia: cualquier enemigo normal (ni jefe ni élite) que siga vivo `after` s después de aparecer se enfurece, se
 * pone rojo, pega y corre más y su vida (la que le queda y la máxima) se multiplica por `hp`. Su velocidad nunca pasa
 * de `speedCap` × la del jugador: te alcanza si te paras o te encierran, pero corriendo bien se le escapa. No hay furia (ni
 * por tiempo ni por sermón) hasta que el jugador llega al nivel `minLevel`; a partir de ahí los `after` s cuentan
 * desde ese momento para los que ya estaban, así no se enfurecen todos de golpe al subir de nivel.
 * DECISIÓN: para que no compense dejar a los bichos dando vueltas, y que de verdad puedan matarte (cañón de cristal:
 * pega mucho, pero con poca vida extra se le puede tumbar antes de que llegue).
 */
export const RAGE: DeepReadonly<typeof T.rage> = T.rage;

export const ENEMY_RULES = {
  /** Enemigos simultáneos; al superarlo se recicla el más lejano (05_TECH.md §3). */
  maxAlive: 400,
  /** Radio de colisión = tamaño × este valor. */
  radiusPerSize: 10,
  minRadius: 5,
  /** Empuje máximo por tick al separar dos enemigos solapados, en px. */
  separationMaxPush: 6,
  /** Fracción del solape que corrige cada enemigo (el otro corrige su parte en su turno). */
  separationShare: 0.5,
  /** Vecinos máximos que se miran por enemigo y tick. */
  maxNeighbors: 32,
  /** PV × (1 + t · hpPerSec). Los jefes no escalan. */
  hpPerSec: 1 / 250,
  /** Velocidad por debajo de la cual se considera quieto (para la animación). */
  movingSpeed: 5,
  bulletR: 5,
  bulletLife: 4,
  /** Altura de vuelo en el render, en px de pantalla. */
  flyHeight: 150,
  bossSpawnDist: 520,
} as const;

export function enemyRadius(id: StatEnemyId): number {
  const s: EnemyStats = ENEMY_STATS[id];
  return s.r ?? Math.max(ENEMY_RULES.minRadius, Math.round(ENTITIES[id].size * ENEMY_RULES.radiusPerSize));
}

/** Radio del enemigo más grande, para que las consultas del spatial hash no pierdan vecinos. */
export const MAX_ENEMY_RADIUS = Math.max(...STAT_ENEMY_IDS.map(enemyRadius));

/** Colores de las esquirlas al golpear o matar (solo visual): chispas de chatarra o vísceras del páramo. */
const SPARKS = [0xffd34a, 0xff8a2a, 0xb8bec6, 0x6c7178] as const;
const GUTS = [0x8bc34a, 0x5e8a2c, 0x7a3b2a, 0xc0d860] as const;
export const GORE: Readonly<Record<StatEnemyId, readonly number[]>> = {
  dron: SPARKS,
  necrofago: GUTS,
  saqueador: [0xa8382a, 0x6a2a20, 0xc8a070],
  tirador: [0xa8382a, 0x6a2a20, 0xc8a070],
  reptador: GUTS,
  hinchado: [0xc8dc50, 0x9dff00, 0x5e8a2c],
  cortacesped: SPARKS,
  torreta: SPARKS,
  babosa: [0x7dff3a, 0x4ac02a, 0xc0ff8a],
  aspiradora: SPARKS,
  aspiradora_cria: SPARKS,
  blindado: [0xb8bec6, 0x6c7178, 0xa8382a],
  predicador: [0xa8382a, 0x6a2a20, 0xf0e070],
  excavadora: SPARKS,
  rey_rata: [0xa8382a, 0x6a2a20, 0x8a7a6a],
  dirigible: SPARKS,
  coloso: SPARKS,
};
/** Esquirlas de los irradiados. */
export const GORE_IRR: readonly number[] = [0xa8ff70, 0x9dff00, 0xe8ffb0];

/** Prefijos de élite (dossier §4): cada uno con su color de aura y su truco. */
export type EliteId = 'blindado' | 'veloz' | 'radiactivo' | 'divisor' | 'vampirico';
export const ELITE_IDS: readonly EliteId[] = ['blindado', 'veloz', 'radiactivo', 'divisor', 'vampirico'];

/**
 * Élites: un enemigo de la oleada vigente, más grande y duro, cada 30–50 s. Suelta siempre un power-up y a veces
 * (`cacheChance`) el cofre especial.
 * DECISIÓN: el cofre especial (tragaperras de cupones y un nivel) es sobre todo de los edificios limpios; los cofres
 * de objeto son de los jefes y solo hay dos huecos, así que un élite no puede quitarle el hueco a un jefe.
 */
/**
 * Valores en `src/data/tuning.json` → `elites`. Notas por campo:
 * - `hp`: Multiplicadores sobre el enemigo normal.
 * - `kb`: Empuje que recibe (fracción).
 * - `scale`: Escala del sprite en el render.
 * - `exclude`: Tipos que nunca salen de élite (no se mueven o son crías).
 * - `barTime`: Segundos que sigue la barra en el HUD desde el último golpe.
 */
export const ELITES = T.elites as Retype<typeof T.elites, { exclude: readonly StatEnemyId[] }>;

/** Fracciones de vida donde cambia de fase cada jefe (marcas de la barra del HUD). */
export const BOSS_PHASES: Readonly<Record<BossKind, readonly number[]>> = {
  rey_rata: [0.5],
  dirigible: [0.5],
  coloso: [0.66, 0.33],
};
