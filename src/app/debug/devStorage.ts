// Persistencia del depurador en localStorage (solo desarrollo). Todo envuelto en try/catch: puede estar bloqueado.
import { applyTuning, exportTuning } from '../../config/tuning';

export const TUNING_KEY = 'atomicash-dev-tuning';

/** Reaplica los valores guardados. Devuelve cuántas rutas se ignoraron, o null si no había nada guardado. */
export function loadSavedTuning(): { skipped: string[] } | null {
  try {
    const raw = localStorage.getItem(TUNING_KEY);
    if (!raw) return null;
    return { skipped: applyTuning(JSON.parse(raw)) };
  } catch {
    return null;
  }
}

/** Guarda los valores vigentes completos. */
export function saveTuning(): void {
  try {
    localStorage.setItem(TUNING_KEY, exportTuning());
  } catch {
    /* sin almacenamiento: los cambios valen solo para esta sesión */
  }
}

export function clearSavedTuning(): void {
  try {
    localStorage.removeItem(TUNING_KEY);
  } catch {
    /* nada que borrar */
  }
}
