// Teclado → dirección de pantalla normalizada. El joystick táctil llega en F1-03.

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];

export class KeyboardInput {
  private readonly keys = new Set<string>();
  private readonly onDown = (e: KeyboardEvent): void => {
    if ([...LEFT, ...RIGHT, ...UP, ...DOWN].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private readonly onUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private readonly onBlur = (): void => this.keys.clear();

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  /** Dirección en pantalla (y hacia abajo), magnitud 0 o 1. */
  read(): { x: number; y: number } {
    const any = (codes: string[]): boolean => codes.some((c) => this.keys.has(c));
    let x = 0;
    let y = 0;
    if (any(LEFT)) x -= 1;
    if (any(RIGHT)) x += 1;
    if (any(UP)) y -= 1;
    if (any(DOWN)) y += 1;
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.keys.clear();
  }
}
