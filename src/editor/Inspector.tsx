// Panel de la derecha: propiedades de la pieza seleccionada.
import { MAX_ENEMY_COUNT } from '../config/events';
import { Thumb } from './ArtView';
import { GROUP_LABELS, type Entry } from './catalog';
import { useEditor } from './state';

const TYPE_LABELS = { prop: 'Objeto del mapa', enemy: 'Enemigo', pickup: 'Recogible' } as const;

export function Inspector({ byKey }: { byKey: ReadonlyMap<string, Entry> }) {
  const { pieces, selected, update, remove } = useEditor();
  const p = pieces.find((q) => q.uid === selected);
  if (!p)
    return (
      <aside className="ev-inspector">
        <h2>Propiedades</h2>
        <p className="ev-hint">Selecciona una pieza del mapa.</p>
        <Help />
      </aside>
    );
  const entry = byKey.get(`${p.type}:${p.id}`);
  return (
    <aside className="ev-inspector">
      <h2>Propiedades</h2>
      {entry && (
        <div className="ev-thumb ev-thumb--big">
          <Thumb entry={entry} size={120} />
        </div>
      )}
      <dl>
        <dt>Tipo</dt>
        <dd>{entry ? GROUP_LABELS[entry.group] : TYPE_LABELS[p.type]}</dd>
        <dt>ID</dt>
        <dd>
          {p.id}
          {!entry && <em className="ev-warn"> (no está en el arte)</em>}
        </dd>
        <dt>Casilla</dt>
        <dd>
          {p.x}, {p.y}
        </dd>
      </dl>
      <label className="ev-check">
        <input type="checkbox" checked={p.flip} onChange={(e) => update(p.uid, { flip: e.target.checked })} />
        Volteado en horizontal (F)
      </label>
      <label className="ev-check">
        <input
          type="checkbox"
          checked={p.blocks}
          disabled={p.type !== 'prop'}
          onChange={(e) => update(p.uid, { blocks: e.target.checked })}
        />
        Bloquea el paso
      </label>
      {p.type === 'enemy' && (
        <label className="ev-field">
          Cantidad
          <input
            type="number"
            min={1}
            max={MAX_ENEMY_COUNT}
            value={p.count}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (n >= 1 && n <= MAX_ENEMY_COUNT) update(p.uid, { count: n });
            }}
          />
        </label>
      )}
      <button className="ev-danger" onClick={() => remove(p.uid)}>
        Borrar (Supr)
      </button>
      <Help />
    </aside>
  );
}

function Help() {
  return (
    <ul className="ev-help">
      <li>Arrastra del listado al mapa; soltar el mismo enemigo en su casilla suma uno.</li>
      <li>Arrastra una pieza para moverla; el fondo, para desplazar la vista.</li>
      <li>Rueda: zoom · Supr: borrar · F: voltear · Ctrl+Z: deshacer.</li>
      <li>Rojo en la rejilla: casillas que bloquean el paso.</li>
    </ul>
  );
}
