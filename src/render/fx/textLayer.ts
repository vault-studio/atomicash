// Textos flotantes (daño, críticos, eslóganes).
import { Container, Text, type TextStyleOptions } from 'pixi.js';
import { RUN_COLORS } from '../../config/render';
import { FX, JUICE } from '../../config/run';
import type { World } from '../../engine/types';
import { isoX, isoY } from '../iso';

const TEXT_STYLE: TextStyleOptions = {
  fontFamily: '"Pixelify Sans", monospace',
  fontSize: 14,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
};

/** Textos flotantes reutilizados (daño, críticos, recogidas, eslóganes). */
export class TextLayer extends Container {
  private readonly pool: Text[] = [];
  /** Tipo con el que se estilizó cada texto (cambiar el estilo regenera la textura). */
  private readonly kinds: string[] = [];

  constructor(private readonly translate: (key: string) => string) {
    super();
  }

  draw(w: World, showDmg: boolean): void {
    const n = w.texts.count;
    let used = 0;
    for (let i = 0; i < n; i++) {
      const ft = w.texts.items[i]!;
      if (ft.kind === 'dmg' && !showDmg) continue;
      let tx = this.pool[used];
      if (!tx) {
        tx = new Text({ text: '', style: TEXT_STYLE });
        tx.anchor.set(0.5, 1);
        this.pool.push(tx);
        this.addChild(tx);
      }
      used++;
      let s: string;
      switch (ft.kind) {
        case 'dmg':
          s = String(ft.value);
          break;
        case 'crit':
          s = `${ft.value}!`;
          break;
        case 'hurt':
          s = `-${ft.value}`;
          break;
        case 'dodge':
          s = this.translate('run.dodge');
          break;
        case 'pickup':
          s = ft.value ? `+${ft.value} ${this.translate(ft.key)}` : `+${this.translate(ft.key)}`;
          break;
        case 'slogan':
          s = this.translate(`slogans.${ft.value}`);
          break;
      }
      if (tx.text !== s) tx.text = s;
      if (this.kinds[used - 1] !== ft.kind) {
        this.kinds[used - 1] = ft.kind;
        tx.style.fill = RUN_COLORS.text[ft.kind];
        tx.style.fontSize = ft.kind === 'crit' ? 24 : ft.kind === 'dmg' ? 10 : 13;
      }
      const age = FX.textLife - ft.life;
      const rise = (age / FX.textLife) * 30;
      tx.position.set(isoX(ft.x, ft.y), isoY(ft.x, ft.y) - 40 - rise);
      // Más grande cuanto más daño, y un rebote al aparecer.
      const D = JUICE.dmgScale;
      let k = 1;
      if (ft.kind === 'dmg' || ft.kind === 'crit')
        k = Math.min(D.max, D.base + D.perDigit * Math.log10(Math.max(1, ft.value)));
      if (age < D.popTime) k *= 1 + D.pop * (1 - age / D.popTime);
      tx.scale.set(k);
      tx.alpha = Math.min(1, ft.life * 3);
      tx.visible = true;
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }
}
