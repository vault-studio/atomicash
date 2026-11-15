// Configuración de enemigos y jefes: API pública. Los números están en src/data/tuning.json.
export type {
  EnemyRole,
  EnemyStats,
  RageProfile,
  RageOverride,
  DashSpec,
  GunnerAI,
  SalvoAI,
  InterceptorAI,
} from './types';
export {
  ENEMY_STATS,
  STAT_ENEMY_IDS,
  BOSS_IDS,
  MIRROR_ID,
  MOB_IDS,
  statsOf,
  AI,
  BOSS_VARIANTS,
  RAGE,
  ENEMY_RULES,
  enemyRadius,
  MAX_ENEMY_RADIUS,
  GORE,
  GORE_IRR,
  ELITE_IDS,
  ARMOR,
  ELITES,
  BOSS_PHASES,
} from './stats';
export type { StatEnemyId, BossKind, EliteId } from './stats';
