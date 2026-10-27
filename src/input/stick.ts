// Matemática del joystick virtual. Pura para poder testearla.

export interface StickVector {
  /** Dirección de pantalla (y hacia abajo), magnitud en [0, 1]. */
  x: number;
  y: number;
  /** Desplazamiento del pomo en px, limitado al radio. */
  knobX: number;
  knobY: number;
}

/** Convierte el arrastre (dx, dy) desde el origen en dirección y magnitud analógicas. */
export function stickVector(dx: number, dy: number, radius: number, deadzone: number): StickVector {
  const l = Math.hypot(dx, dy);
  if (l === 0) return { x: 0, y: 0, knobX: 0, knobY: 0 };
  const knob = Math.min(l, radius);
  const knobX = (dx / l) * knob;
  const knobY = (dy / l) * knob;
  if (l <= deadzone) return { x: 0, y: 0, knobX, knobY };
  // La magnitud empieza en 0 al salir de la zona muerta para que no haya salto.
  const m = Math.min(1, (l - deadzone) / (radius - deadzone));
  return { x: (dx / l) * m, y: (dy / l) * m, knobX, knobY };
}
