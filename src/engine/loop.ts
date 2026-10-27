// Bucle de paso fijo con acumulador (05_TECH.md §3). El render interpola con `alpha`.

export interface FixedStep {
  /** Duración de un paso en segundos. */
  readonly step: number;
  readonly maxSteps: number;
  acc: number;
}

export function createFixedStep(hz: number, maxSteps: number): FixedStep {
  return { step: 1 / hz, maxSteps, acc: 0 };
}

/**
 * Avanza el acumulador con el tiempo real del frame y ejecuta los pasos que toquen.
 * Si hay que hacer más de `maxSteps`, descarta el tiempo sobrante en vez de entrar en espiral.
 * Devuelve `alpha` en [0, 1): cuánto falta para el próximo paso, para interpolar el render.
 */
export function advance(fs: FixedStep, frameSec: number, onStep: (dt: number) => void): number {
  fs.acc += Math.max(0, frameSec);
  let steps = 0;
  while (fs.acc >= fs.step) {
    if (steps >= fs.maxSteps) {
      fs.acc %= fs.step;
      break;
    }
    onStep(fs.step);
    fs.acc -= fs.step;
    steps++;
  }
  return fs.acc / fs.step;
}
