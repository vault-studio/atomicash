// Barra de arriba: id y nombres del evento, bioma, nuevo/guardar/abrir y deshacer.
import { useEffect, useState } from 'react';
import {
  EVENT_BIOMES,
  EVENT_SIZES,
  EVENT_ID_RE,
  validateEvent,
  validateEventNames,
  type EventBiome,
} from '../config/events';
import { listSaved, saveEvent, type SavedEvent } from './api';
import { useEditor } from './state';

/** Nombres de los actos (i18n `acts.*`); el editor está solo en español. */
const BIOME_LABELS: Readonly<Record<string, string>> = {
  1: 'Las Afueras',
  2: 'Las Heladas',
  3: 'La Espesura',
  any: 'Cualquiera',
};

export function FileBar() {
  const s = useEditor();
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const [open, setOpen] = useState('');

  const refresh = (): void => {
    listSaved()
      .then(setSaved)
      .catch((e: unknown) => s.setMeta({ message: `No se pudo listar: ${String(e)}` }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const save = (): void => {
    const event = s.toEvent();
    const names = { es: s.nameEs.trim(), en: s.nameEn.trim() };
    if (!EVENT_ID_RE.test(event.id)) return s.setMeta({ message: 'id: solo minúsculas, números y _' });
    if (!validateEventNames(names)) return s.setMeta({ message: 'Faltan los nombres ES y EN' });
    const check = validateEvent(event);
    if (!check.ok) return s.setMeta({ message: check.error });
    const exists = saved.some((e) => e.event.id === event.id);
    if (exists && open !== event.id && !confirm(`Ya hay un evento «${event.id}». ¿Sobrescribirlo?`)) return;
    saveEvent(check.event, names)
      .then((file) => {
        s.setMeta({ message: `Guardado en ${file}` });
        setOpen(event.id);
        refresh();
      })
      .catch((e: unknown) => s.setMeta({ message: `Error al guardar: ${String(e)}` }));
  };

  const load = (id: string): void => {
    const e = saved.find((x) => x.event.id === id);
    if (!e) return;
    if (s.past.length > 0 && !confirm('Se perderán los cambios sin guardar. ¿Abrir?')) return;
    s.load(e.event, e.names);
    setOpen(id);
  };

  return (
    <header className="ev-bar">
      <strong>Editor de eventos</strong>
      <label>
        id <input value={s.id} onChange={(e) => s.setMeta({ id: e.target.value })} placeholder="mi_evento" />
      </label>
      <label>
        ES <input value={s.nameEs} onChange={(e) => s.setMeta({ nameEs: e.target.value })} />
      </label>
      <label>
        EN <input value={s.nameEn} onChange={(e) => s.setMeta({ nameEn: e.target.value })} />
      </label>
      <label>
        Bioma{' '}
        <select
          value={String(s.biome)}
          onChange={(e) =>
            s.setBiome((e.target.value === 'any' ? 'any' : Number(e.target.value)) as EventBiome)
          }
        >
          {EVENT_BIOMES.map((b) => (
            <option key={b} value={String(b)}>
              {BIOME_LABELS[String(b)]}
            </option>
          ))}
        </select>
      </label>
      <label title="Lado del mapa en casillas; impar, con una casilla central">
        Tamaño{' '}
        <select value={s.size} onChange={(e) => s.setSize(Number(e.target.value))}>
          {EVENT_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}×{n}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => {
          if (s.past.length === 0 || confirm('¿Empezar uno nuevo? Se perderán los cambios sin guardar.')) {
            s.reset();
            setOpen('');
          }
        }}
      >
        Nuevo
      </button>
      <button className="ev-primary" onClick={save}>
        Guardar
      </button>
      <select value={open} onChange={(e) => load(e.target.value)} title="Abrir un evento guardado">
        <option value="">Abrir… ({saved.length})</option>
        {saved.map((e) => (
          <option key={e.event.id} value={e.event.id}>
            {e.names.es} ({e.event.id})
          </option>
        ))}
      </select>
      <button onClick={s.undo} disabled={s.past.length === 0}>
        Deshacer
      </button>
      <span className="ev-msg">
        {s.pieces.length} piezas · {s.message}
      </span>
    </header>
  );
}
