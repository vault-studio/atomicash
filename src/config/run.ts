// Parámetros de la run. Todo número de balance vive en src/config (AGENTS.md §3).
export const RUN = {
  /** Paso fijo del motor (05_TECH.md §3). */
  tickHz: 60,
  /** Máximo de pasos por frame para no entrar en espiral si el navegador se congela. */
  maxStepsPerFrame: 5,
  /** Lado del mapa cuadrado, en px de mundo. */
  mapSize: 3200,
  /** Duración de la run en segundos. */
  duration: 900,
  /** Lado de celda del spatial hash de colisiones, en px de mundo (05_TECH.md §3). */
  gridCell: 64,
} as const;

export const PLAYER = {
  /** Radio de colisión del jugador en px de mundo. */
  radius: 12,
  /** Por debajo de esta magnitud de entrada se considera quieto. */
  moveDeadzone: 0.05,
} as const;
