// Placeholders (biblia §4 y 04_ART_UI.md §5): círculo del color de firma con el ID encima.
// El jugador lleva además un triángulo crema que marca hacia dónde mira.
import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../config/render';

export class Placeholder extends Container {
  private readonly arrow: Graphics | null;

  constructor(color: string, label: string, radius: number, withArrow: boolean) {
    super();
    const body = new Graphics()
      .circle(0, -radius, radius)
      .fill({ color })
      .stroke({ width: 1.5, color: 0x000000, alpha: 0.55 });
    this.addChild(body);

    const text = new Text({
      text: label,
      style: { fontFamily: 'monospace', fontSize: 12, fontWeight: '600', fill: 0xffffff },
    });
    text.alpha = 0.85;
    text.anchor.set(0.5, 1);
    text.position.set(0, -radius * 2 - 4);
    this.addChild(text);

    if (withArrow) {
      const s = radius * 0.9;
      this.arrow = new Graphics()
        .poly([s, 0, -s * 0.6, -s * 0.6, -s * 0.6, s * 0.6])
        .fill({ color: PALETTE.cream })
        .stroke({ width: 1, color: 0x000000, alpha: 0.6 });
      this.arrow.position.set(0, -radius);
      this.addChild(this.arrow);
    } else {
      this.arrow = null;
    }
  }

  /** Ángulo en pantalla (radianes) hacia donde apunta el triángulo. */
  setFacing(screenAngle: number): void {
    if (this.arrow) this.arrow.rotation = screenAngle;
  }
}
