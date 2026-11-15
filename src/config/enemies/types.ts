// Tipos de la configuración de enemigos: stats, furia, embestida y bloques de IA.
/**
 * Papel en el cerco (CAMBIOS §4): perseguidores presionan, interceptores cortan rutas, pesados bloquean, normales
 * rellenan huecos, tiradores obligan a moverse y lanzadores lanzan varios proyectiles que rompen el terreno.
 */
export type EnemyRole = 'chaser' | 'interceptor' | 'heavy' | 'normal' | 'shooter' | 'launcher';

export interface EnemyStats {
  readonly role?: EnemyRole;
  /** Máximo en pantalla a la vez (0 o ausente = sin límite). */
  readonly cap?: number;
  /** `cap` cuenta todos los vivos con su mismo `role` (de cualquier tipo), no solo los de su tipo. */
  readonly capRole?: boolean;
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
  /** Blindaje plano: resta esto a cada impacto (ver `applyArmor` y `ARMOR.minFrac`). */
  readonly armor?: number;
  /** RAD que da su golpe de contacto. */
  readonly rad?: number;
  readonly boss?: boolean;
  /** Vuela: no colisiona, no hace daño de contacto y no lo alcanzan las armas de suelo. */
  readonly flying?: boolean;
  /** Máquina, chapa u hormigón: los golpes y la muerte suenan a metal en vez de a carne. */
  readonly metal?: boolean;
  /**
   * Robot: al morir revienta y deja sus piezas en el suelo, en vez de su animación de muerte. Solo visual (no hace
   * daño). Todo robot nuevo debe llevarlo (lo comprueba `tests/wreck.test.ts`).
   */
  readonly wreck?: boolean;
  /** Furia propia: campos sueltos sobre el perfil por defecto (`RAGE`) o `{ enabled: false }` para no enfurecerse. */
  readonly rage?: RageOverride;
  /** Habilidad de carrera/embestida con aviso (ver `DashSpec`). Si falta, no tiene. */
  readonly dash?: DashSpec;
}

/**
 * Perfil de furia (CAMBIOS §1). Condiciones: `chaseAfter` s persiguiendo, vida por debajo de `hpBelow` (fracción) o
 * muerte de un aliado a menos de `allyDeathR` px; las que valen 0 están desactivadas. Efectos mientras dura (`dur` s):
 * corre a max(su velocidad, la del jugador × `speed`) y pega `dmg` veces más; `hp` multiplica su vida solo la primera
 * vez. Al acabar no puede volver a enfurecerse hasta pasados `cd` s.
 */
export interface RageProfile {
  readonly minLevel: number;
  readonly chaseAfter: number;
  readonly hpBelow: number;
  readonly allyDeathR: number;
  readonly speed: number;
  readonly dmg: number;
  readonly hp: number;
  readonly dur: number;
  readonly cd: number;
}

/** Lo que un enemigo cambia del perfil por defecto; `enabled: false` lo deja sin furia. */
export type RageOverride = Partial<RageProfile> & { readonly enabled?: boolean };

/**
 * Embestida por datos: cada `every` s, si el jugador está a menos de `range` px, se queda parado `aim` s (con el
 * pasillo marcado en el suelo) y luego corre a `speed` px/s en la dirección fijada al empezar el aviso, siempre hasta
 * dejarlo `over` px atrás aunque huya por el pasillo (como mucho `maxDur` s, por si algo la frena).
 * `lead` = s máximos de anticipación: 0 apunta a donde está el jugador, > 0 a donde va a estar.
 */
export interface DashSpec {
  readonly every: number;
  readonly aim: number;
  readonly speed: number;
  readonly over: number;
  readonly maxDur: number;
  readonly range: number;
  readonly lead: number;
}

/** Bloque de IA de un tirador de balas (`ai.tirador`, `ai.liquidador`): `shotRad` suma RAD a cada disparo. */
export interface GunnerAI {
  readonly hold: number;
  readonly resume: number;
  readonly fireCd: number;
  readonly bulletSpd: number;
  readonly range: number;
  readonly shotRad?: number;
}

/**
 * Bloque de IA de un lanzador de salvas (`ai.mortero`, `ai.bidonero`, `ai.nevera`). `lake`: radio del lago que deja
 * cada impacto de barril (índice en `HAZARDS.cellRadii`).
 */
export interface SalvoAI {
  readonly hold: number;
  readonly range: number;
  readonly every: number;
  readonly shells: number;
  readonly warn: number;
  readonly stagger: number;
  readonly shellR: number;
  readonly shellDmg: number;
  readonly minGap: number;
  readonly lake?: number;
}

/**
 * Bloque de IA de un interceptor (`ai.interceptor`, `ai.sabueso`, `ai.motorista`). `radSpeed`: el sabueso corre más
 * cuanta más RAD lleva el jugador. `skidSpeed`/`exposedMult`: el motorista que falla derrapa (a esa fracción de su
 * velocidad, hasta parar) y recibe ese múltiplo de daño mientras tanto.
 */
export interface InterceptorAI {
  readonly turn: number;
  readonly lead: number;
  readonly stunCharge: number;
  readonly stunDur: number;
  readonly stunImmunity: number;
  readonly recover: number;
  readonly recoverSpeed: number;
  readonly missR: number;
  readonly radSpeed?: number;
  readonly skidSpeed?: number;
  readonly exposedMult?: number;
}
