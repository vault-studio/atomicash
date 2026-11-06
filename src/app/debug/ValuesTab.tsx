// Pestaña «Valores»: editor en árbol de todo `TUNING`. Cada cambio se aplica en sitio con `applyTuning` (vale desde el
// siguiente reinicio) y se guarda en localStorage.
import { useReducer, useState } from 'react';
import { TUNING, applyTuning } from '../../config/tuning';
import type { DevCtx } from './devTypes';
import { saveTuning } from './devStorage';
import {
  getAt,
  isRec,
  makePatch,
  matchesFilter,
  parseJsonField,
  pathKey,
  subtreeMatches,
  type Path,
} from './devUtils';

type Commit = (path: Path, value: unknown) => void;

function NumField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="number"
      step="any"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

/** Un elemento de lista (o cualquier valor complejo) como JSON editable: solo se aplica si el texto es válido. */
function JsonField({ value, onCommit }: { value: unknown; onCommit: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value));
  const [bad, setBad] = useState(false);
  return (
    <textarea
      className={bad ? 'dev-bad' : undefined}
      rows={text.length > 40 ? 3 : 1}
      spellCheck={false}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseJsonField(e.target.value);
        setBad(!parsed);
        if (parsed) onCommit(parsed.value);
      }}
    />
  );
}

interface NodeProps {
  name: string | number;
  path: Path;
  value: unknown;
  filter: string;
  open: ReadonlySet<string>;
  toggle: (key: string) => void;
  commit: Commit;
}

function Node(p: NodeProps) {
  const { name, path, value, filter, open, toggle, commit } = p;
  const key = pathKey(path);
  const label = typeof name === 'number' ? `[${name}]` : name;

  if (Array.isArray(value)) {
    if (filter && !subtreeMatches(value, path, filter)) return null;
    const isOpen = !!filter || open.has(key);
    return (
      <div className="dev-node">
        <button className="dev-fold" onClick={() => toggle(key)}>
          {isOpen ? '▾' : '▸'} {label} <span className="dev-dim">[{value.length}]</span>
        </button>
        {isOpen && (
          <div className="dev-kids">
            {value.map((v, i) => {
              const sub = [...path, i];
              if (filter && !subtreeMatches(v, sub, filter)) return null;
              return (
                <div className="dev-item" key={`${key}.${value.length}.${i}`}>
                  <span className="dev-idx">[{i}]</span>
                  <JsonField value={v} onCommit={(nv) => commit(sub, nv)} />
                  <button
                    title="Quitar"
                    onClick={() =>
                      commit(
                        path,
                        value.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {value.length > 0 && !filter && (
              <button onClick={() => commit(path, [...value, structuredClone(value[value.length - 1])])}>
                + copiar el último
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isRec(value)) {
    if (filter && !subtreeMatches(value, path, filter)) return null;
    const isOpen = !!filter || open.has(key);
    return (
      <div className="dev-node">
        <button className="dev-fold" onClick={() => toggle(key)}>
          {isOpen ? '▾' : '▸'} {label}
        </button>
        {isOpen && (
          <div className="dev-kids">
            {Object.entries(value).map(([k, v]) => (
              <Node key={k} {...p} name={k} path={[...path, k]} value={v} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!matchesFilter(path, filter)) return null;
  return (
    <label className="dev-leaf">
      <span title={key}>{label}</span>
      {typeof value === 'number' ? (
        <NumField value={value} onCommit={(n) => commit(path, n)} />
      ) : typeof value === 'boolean' ? (
        <input type="checkbox" checked={value} onChange={(e) => commit(path, e.target.checked)} />
      ) : typeof value === 'string' ? (
        <input type="text" value={value} onChange={(e) => commit(path, e.target.value)} />
      ) : (
        <JsonField value={value} onCommit={(nv) => commit(path, nv)} />
      )}
    </label>
  );
}

export function ValuesTab({ ctx }: { ctx: DevCtx }) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  const toggle = (key: string): void =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(key)) n.add(key);
      return n;
    });

  const commit: Commit = (path, value) => {
    if (getAt(TUNING, path) === undefined) return;
    const skipped = applyTuning(makePatch(TUNING, path, value));
    saveTuning();
    setMsg(skipped.length ? `Ignorado (tipo distinto): ${skipped.join(', ')}` : '');
    refresh();
  };

  return (
    <>
      <div className="dev-row">
        <input
          type="search"
          placeholder="filtrar (p. ej. dron hp)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button onClick={() => setOpen(new Set())}>plegar</button>
      </div>
      <button className="dev-big" onClick={() => ctx.restart()}>
        Aplicar y reiniciar
      </button>
      {msg && <div className="dev-warn">{msg}</div>}
      <div className="dev-tree">
        {Object.entries(TUNING).map(([k, v]) => (
          <Node
            key={k}
            name={k}
            path={[k]}
            value={v}
            filter={filter.trim()}
            open={open}
            toggle={toggle}
            commit={commit}
          />
        ))}
      </div>
    </>
  );
}
