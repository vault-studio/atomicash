// Parámetros de control (02_GAMEPLAY.md §2).
export const JOYSTICK = {
  /** Distancia en px de pantalla a la que el joystick llega a velocidad máxima. */
  radius: 55,
  /** Por debajo de esta distancia en px no hay movimiento (evita derivas al tocar). */
  deadzone: 6,
  /** Fracción izquierda de la pantalla donde se puede empezar a arrastrar. */
  zoneFrac: 0.5,
} as const;
