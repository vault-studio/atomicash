// Entrada unificada: teclado y joystick táctil → dirección de pantalla. El joystick manda si está activo.
import { TouchJoystick } from './joystick';
import { KeyboardInput } from './keyboard';

export class InputManager {
  private readonly keyboard: KeyboardInput;
  private readonly joystick: TouchJoystick;
  private readonly onBlur = (): void => this.joystick.release();

  constructor(touchHost: HTMLElement) {
    this.keyboard = new KeyboardInput();
    this.joystick = new TouchJoystick(touchHost);
    window.addEventListener('blur', this.onBlur);
  }

  /** Dirección de pantalla (y hacia abajo), magnitud en [0, 1]. */
  read(): { x: number; y: number } {
    return this.joystick.active ? this.joystick.read() : this.keyboard.read();
  }

  /** Suelta cualquier control mantenido (al pausar o girar el móvil). */
  release(): void {
    this.joystick.release();
  }

  dispose(): void {
    window.removeEventListener('blur', this.onBlur);
    this.keyboard.dispose();
    this.joystick.dispose();
  }
}
