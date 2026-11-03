// Panel superpuesto del depurador: pestañas a la derecha, con scroll propio. F1 lo muestra/oculta (lo gestiona DevApp).
import { useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { FileTab } from './FileTab';
import { StatsTab } from './StatsTab';
import { GameTab } from './GameTab';
import { ValuesTab } from './ValuesTab';
import type { DevCtx, DevTab } from './devTypes';

/**
 * Pestañas del panel. Para añadir una (p. ej. «Estadísticas», tarea aparte) basta una entrada aquí: recibe el
 * contexto de la partida y devuelve su contenido.
 */
export const DEV_TABS: readonly DevTab[] = [
  { id: 'game', label: 'Partida', render: (ctx) => <GameTab ctx={ctx} /> },
  { id: 'values', label: 'Valores', render: (ctx) => <ValuesTab ctx={ctx} /> },
  { id: 'file', label: 'Archivo', render: (ctx) => <FileTab ctx={ctx} /> },
  { id: 'stats', label: 'Stats', render: (ctx) => <StatsTab ctx={ctx} /> },
];

/** Campos donde se escribe: con uno enfocado, el panel se queda las teclas (WASD, flechas, K, J...). */
const TYPING = 'input:not([type=checkbox]):not([type=range]):not([type=file]), textarea, select';

export function DevPanel({ ctx, onClose }: { ctx: DevCtx; onClose: () => void }) {
  const [tab, setTab] = useState(DEV_TABS[0]!.id);
  const current = DEV_TABS.find((t) => t.id === tab) ?? DEV_TABS[0]!;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'F1' && (e.target as HTMLElement).matches(TYPING)) e.stopPropagation();
  };
  // Los botones, casillas y deslizadores sueltan el foco al usarse: así el juego sigue recibiendo el teclado.
  const release =
    (selector: string) =>
    (e: { target: EventTarget }): void => {
      const t = e.target as HTMLElement;
      if (t.matches(selector)) t.blur();
    };

  return createPortal(
    <aside
      className="dev-panel"
      onKeyDown={onKeyDown}
      onPointerUp={release('button, input[type=checkbox], input[type=range]')}
      onChange={release('select')}
    >
      <header className="dev-head">
        <strong>DEPURADOR</strong>
        <span className="dev-dim">F1</span>
        <button className="dev-x" onClick={onClose} title="Ocultar (F1)">
          ×
        </button>
      </header>
      <nav className="dev-tabs">
        {DEV_TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === current.id ? 'is-on' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="dev-body">{current.render(ctx)}</div>
    </aside>,
    document.body,
  );
}
