// Pestaña «Archivo»: exportar, importar, volver a los valores por defecto y guardarlos como nuevos por defecto.
import { useState } from 'react';
import { applyTuning, exportTuning, resetTuning } from '../../config/tuning';
import type { DevCtx } from './devTypes';
import { clearSavedTuning, saveTuning } from './devStorage';

const listSkipped = (skipped: readonly string[]): string =>
  skipped.length ? ` Rutas ignoradas (${skipped.length}): ${skipped.join(', ')}` : ' Sin rutas ignoradas.';

export function FileTab({ ctx }: { ctx: DevCtx }) {
  const [msg, setMsg] = useState('');

  const download = (): void => {
    const url = URL.createObjectURL(new Blob([exportTuning()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tuning.json';
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Descargado tuning.json con los valores actuales.');
  };

  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    try {
      const skipped = applyTuning(JSON.parse(await file.text()));
      saveTuning();
      setMsg(`Importado ${file.name}.${listSkipped(skipped)} Vale desde el próximo reinicio.`);
    } catch (e) {
      setMsg(`No se pudo importar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const reset = (): void => {
    resetTuning();
    clearSavedTuning();
    setMsg('Valores por defecto restaurados y borrados del navegador. Vale desde el próximo reinicio.');
  };

  const saveDefaults = async (): Promise<void> => {
    if (!window.confirm('¿Sobrescribir src/data/tuning.json con los valores actuales?')) return;
    try {
      const res = await fetch('/__tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-atomicash-dev': '1' },
        body: exportTuning(),
      });
      const body = (await res.json()) as { ok: boolean; error?: string; file?: string };
      setMsg(body.ok ? `Guardado en ${body.file}.` : `No se guardó: ${body.error ?? res.status}`);
    } catch (e) {
      setMsg(`No se guardó: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <section className="dev-sec">
        <h3>Valores de balance</h3>
        <div className="dev-dim">
          {ctx.savedTuning
            ? `Al cargar se reaplicaron los valores guardados en el navegador.${listSkipped(ctx.savedTuning.skipped)}`
            : 'No había valores guardados en el navegador al cargar.'}
        </div>
        <button onClick={download}>Exportar tuning.json</button>
        <label className="dev-file">
          Importar .json
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <button onClick={reset}>Volver a defaults</button>
        <button onClick={() => void saveDefaults()}>Guardar como defaults</button>
        <div className="dev-dim">
          «Guardar como defaults» escribe src/data/tuning.json (solo con el servidor de desarrollo).
        </div>
      </section>
      {msg && <div className="dev-status">{msg}</div>}
    </>
  );
}
