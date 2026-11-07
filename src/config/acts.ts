// Actos de la campaña. Sus nombres están en i18n (`acts.1`…).
// Una partida encadena los tres actos: cada uno dura hasta matar a su jefe y el Acto 3 acaba con el Coloso. Las reglas
// de la campaña (jefes, desbloqueos por rol, eventos especiales y transición) están en `src/data/tuning.json` →
// `campaign`; las oleadas, en `waves`, llevan cada una su acto.
import type { BossKind, EnemyRole } from './enemies';
import type { RainKind } from './modes';
import { TUNING } from './tuning';

export const ACT_IDS = [1, 2, 3] as const;
export type ActId = (typeof ACT_IDS)[number];

export const LAST_ACT: ActId = 3;

export const isActId = (n: number): n is ActId => (ACT_IDS as readonly number[]).includes(n);

/** Lluvia de un evento especial: las que cambian el mapa o la radiactiva (`World.rain`). */
export type SpecialRain = RainKind | 'radioactive';

/**
 * Valores en `src/data/tuning.json` → `campaign`. Tiempos en s:
 * - `bossAt`: el jefe sale a este segundo de cada acto.
 * - `clearMin`/`clearMax`/`fade`: transición al caer el jefe. Se espera al menos `clearMin` y a que no queden cofres;
 *   en `clearMax` los cofres van al jugador. Luego la cortina tarda `fade` en cerrarse y otro tanto en abrirse.
 * - `specials.times`: segundos de cada acto con evento especial; `hordeChance`, probabilidad de que sea una emboscada
 *   y no una lluvia; `rains`, las lluvias posibles; `endlessEvery`, un evento cada tantos s en infinito.
 * - `gates`: segundo del acto desde el que aparece cada rol.
 * - `acts`: jefe de cada acto.
 */
export interface CampaignDef {
  readonly bossAt: number;
  readonly clearMin: number;
  readonly clearMax: number;
  readonly fade: number;
  readonly specials: {
    readonly times: readonly number[];
    readonly hordeChance: number;
    readonly rains: readonly SpecialRain[];
    readonly endlessEvery: number;
  };
  readonly gates: Readonly<Record<EnemyRole, number>>;
  readonly acts: Readonly<Record<ActId, { readonly boss: BossKind }>>;
}

export const CAMPAIGN = TUNING.campaign as unknown as CampaignDef;
