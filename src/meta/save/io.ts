// Exportar e importar el guardado como texto.
import type { SaveData } from './data';
import { isObj, migrate, num } from './normalize';

const EXPORT_TAG = 'atomicash-save';

export function exportSave(s: SaveData): string {
  return JSON.stringify({ app: EXPORT_TAG, version: s.version, data: s });
}

/** Lee un JSON exportado. Devuelve null si no es una partida de Atomic Ash. */
export function importSave(json: string): SaveData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.app !== EXPORT_TAG || !isObj(raw.data)) return null;
  return migrate(raw.data, num(raw.version, 0));
}
