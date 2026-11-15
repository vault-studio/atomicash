// Editor de eventos especiales (solo desarrollo): listado de sprites, mapa isométrico y propiedades.
import { useEffect, useMemo, useState } from 'react';
import { loadCatalog, type Entry } from './catalog';
import { FileBar } from './FileBar';
import { Inspector } from './Inspector';
import { MapView } from './MapView';
import { Palette } from './Palette';
import { useEditor } from './state';

/** Atajos: Supr borra, F voltea, Ctrl+Z deshace. No actúan mientras se escribe en un campo. */
function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      const s = useEditor.getState();
      const sel = s.pieces.find((p) => p.uid === s.selected);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        s.undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        s.remove(sel.uid);
      } else if (e.key.toLowerCase() === 'f' && sel && !e.ctrlKey && !e.metaKey) {
        s.update(sel.uid, { flip: !sel.flip });
      } else if (e.key === 'Escape') s.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');
  const [dragEntry, setDragEntry] = useState<Entry | null>(null);
  useShortcuts();

  useEffect(() => {
    loadCatalog()
      .then(setEntries)
      .catch((e: unknown) => setError(String(e)));
  }, []);
  const byKey = useMemo(() => new Map((entries ?? []).map((e) => [e.key, e])), [entries]);

  if (error) return <p className="ev-loading">No se pudo leer el arte: {error}</p>;
  if (!entries) return <p className="ev-loading">Cargando el arte…</p>;
  return (
    <div className="ev-app">
      <FileBar />
      <div className="ev-body">
        <Palette entries={entries} onDrag={setDragEntry} />
        <MapView byKey={byKey} dragEntry={dragEntry} />
        <Inspector byKey={byKey} />
      </div>
    </div>
  );
}
