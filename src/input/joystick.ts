// Joystick virtual flotante: aparece donde se toca, en la mitad izquierda de la pantalla.
import { JOYSTICK } from '../config/input';
import { stickVector } from './stick';

export class TouchJoystick {
  private pointerId: number | null = null;
  private ox = 0;
  private oy = 0;
  private x = 0;
  private y = 0;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null || e.button > 0) return;
    const rect = this.host.getBoundingClientRect();
    if (e.clientX - rect.left > rect.width * JOYSTICK.zoneFrac) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.ox = this.x = e.clientX - rect.left;
    this.oy = this.y = e.clientY - rect.top;
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      // Algunos navegadores no permiten capturar punteros sintéticos; el joystick sigue funcionando.
    }
    this.base.style.left = `${this.ox}px`;
    this.base.style.top = `${this.oy}px`;
    this.base.hidden = false;
    this.updateKnob();
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const rect = this.host.getBoundingClientRect();
    this.x = e.clientX - rect.left;
    this.y = e.clientY - rect.top;
    this.updateKnob();
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.release();
  };

  constructor(private readonly host: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joy';
    this.base.style.width = this.base.style.height = `${JOYSTICK.radius * 2}px`;
    this.base.hidden = true;
    this.knob = document.createElement('div');
    this.knob.className = 'joy__knob';
    this.base.appendChild(this.knob);
    host.appendChild(this.base);

    host.addEventListener('pointerdown', this.onDown);
    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerup', this.onUp);
    host.addEventListener('pointercancel', this.onUp);
    host.addEventListener('lostpointercapture', this.onUp);
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  /** Dirección de pantalla con magnitud analógica en [0, 1]. */
  read(): { x: number; y: number } {
    if (this.pointerId === null) return { x: 0, y: 0 };
    const v = stickVector(this.x - this.ox, this.y - this.oy, JOYSTICK.radius, JOYSTICK.deadzone);
    return { x: v.x, y: v.y };
  }

  /** Suelta el joystick (p. ej. al perder el foco o al pausar). */
  release(): void {
    this.pointerId = null;
    this.base.hidden = true;
  }

  private updateKnob(): void {
    const v = stickVector(this.x - this.ox, this.y - this.oy, JOYSTICK.radius, JOYSTICK.deadzone);
    this.knob.style.transform = `translate(${v.knobX}px, ${v.knobY}px)`;
  }

  dispose(): void {
    this.host.removeEventListener('pointerdown', this.onDown);
    this.host.removeEventListener('pointermove', this.onMove);
    this.host.removeEventListener('pointerup', this.onUp);
    this.host.removeEventListener('pointercancel', this.onUp);
    this.host.removeEventListener('lostpointercapture', this.onUp);
    this.base.remove();
  }
}
