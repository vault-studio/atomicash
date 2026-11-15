// Listado de la izquierda: sprites por categorías, con buscador. Se arrastran al mapa.
import { useMemo, useState } from 'react';
import { Thumb } from './ArtView';
import { GROUP_LABELS, type Entry, type Group } from './catalog';
import { useEditor } from './state';

const THUMB = 56;
const GROUPS: readonly Group[] = ['decor', 'enemies', 'bosses', 'pickups'];

export function Palette({
  entries,
  onDrag,
}: {
  entries: readonly Entry[];
  onDrag: (e: Entry | null) => void;
}) {
  const { biome, filterBiome, setMeta } = useEditor();
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<Group>>(new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!q || e.id.includes(q)) &&
        (!filterBiome || biome === 'any' || e.biome === 'any' || e.biome === biome),
    );
  }, [entries, query, filterBiome, biome]);

  const toggle = (g: Group): void => {
    const next = new Set(closed);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setClosed(next);
  };

  return (
    <aside className="ev-palette">
      <input
        className="ev-search"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <label className="ev-check">
        <input
          type="checkbox"
          checked={filterBiome}
          onChange={(e) => setMeta({ filterBiome: e.target.checked })}
        />
        Solo decorado del bioma
      </label>
      {GROUPS.map((g) => {
        const list = visible.filter((e) => e.group === g);
        return (
          <section key={g}>
            <h3 onClick={() => toggle(g)}>
              {closed.has(g) ? '▸' : '▾'} {GROUP_LABELS[g]} <small>({list.length})</small>
            </h3>
            {!closed.has(g) && (
              <div className="ev-items">
                {list.map((e) => (
                  <div
                    key={e.key}
                    className="ev-item"
                    title={`${e.id}${e.cells > 1 ? ` · ${e.cells === 9 ? '3×3' : '2'} casillas` : ''}`}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData('text/plain', e.key);
                      ev.dataTransfer.effectAllowed = 'copy';
                      onDrag(e);
                    }}
                    onDragEnd={() => onDrag(null)}
                  >
                    <div className="ev-thumb">
                      <Thumb entry={e} size={THUMB} />
                    </div>
                    <span>{e.id}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
