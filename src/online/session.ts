// Orquestación online sobre los stores: conectar, sincronizar la partida y enviar runs al ranking.
// Cualquier fallo de red se traga aquí: el juego nunca depende de la conexión.
import type { RunResults } from '../engine/world';
import { useOnline } from '../store/online';
import { useSave } from '../store/save';
import {
  ONLINE_ENABLED,
  downloadSave,
  ensureAccount,
  signInGoogle,
  submitRun,
  takeAuthReturn,
  toSubmission,
  uploadSave,
} from './online';

/**
 * Conecta (crea un invitado la primera vez; también al volver del login de Google). Si la local está vacía, baja
 * la de la nube; si las dos tienen partida y la nube cambió desde la última sincronización, pregunta cuál conservar.
 */
export async function connect(): Promise<void> {
  if (!ONLINE_ENABLED) return;
  const on = useOnline.getState();
  // Solo se apunta si lo hay: una segunda llamada (StrictMode) ya no lo ve en la URL y no debe borrarlo.
  const ret = takeAuthReturn();
  on.set(ret ? { status: 'busy', authReturn: ret } : { status: 'busy' });
  try {
    const account = await ensureAccount();
    on.set({ account, connected: true, status: 'idle' });
    const local = useSave.getState().data;
    const cloud = await downloadSave(account.userId);
    if (!cloud) return;
    // Sin expediciones jugadas, la partida de la nube manda (la local acaba de crearse).
    if (local.profile.stats.runs === 0) {
      useSave.getState().replace(cloud.data);
      on.set({ lastSyncAt: cloud.updatedAt });
    } else if (
      !sameTime(cloud.updatedAt, on.lastSyncAt) &&
      JSON.stringify(cloud.data) !== JSON.stringify(local)
    ) {
      on.set({
        conflict: {
          localRuns: local.profile.stats.runs,
          cloudRuns: cloud.data.profile.stats.runs,
          cloudAt: cloud.updatedAt,
        },
      });
    }
  } catch {
    on.set({ status: 'error' });
  }
}

/** La base de datos devuelve `+00:00` y el cliente guarda `Z`: se comparan como instantes. */
const sameTime = (a: string, b: string | null): boolean => b !== null && Date.parse(a) === Date.parse(b);

/** Entra con Google desde cero o desde un invitado. Al volver, `connect` (en App) recoge la sesión. */
export async function loginGoogle(): Promise<void> {
  useOnline.getState().set({ connected: true, authReturn: null });
  await signInGoogle();
}

/** Sube la partida local y la marca como sincronizada. */
export async function pushSave(): Promise<boolean> {
  const acc = useOnline.getState().account;
  if (!acc) return false;
  try {
    const at = await uploadSave(acc.userId, useSave.getState().data);
    useOnline.getState().set({ lastSyncAt: at, conflict: null });
    return true;
  } catch {
    return false;
  }
}

/** Sustituye la partida local por la de la nube. */
export async function pullSave(): Promise<boolean> {
  const acc = useOnline.getState().account;
  if (!acc) return false;
  try {
    const cloud = await downloadSave(acc.userId);
    if (!cloud) return false;
    useSave.getState().replace(cloud.data);
    useOnline.getState().set({ lastSyncAt: cloud.updatedAt, conflict: null });
    return true;
  } catch {
    return false;
  }
}

/** Tras cada run: copia en la nube y, si hay apodo y está activado, envío al ranking. */
export function afterRun(r: RunResults): void {
  const on = useOnline.getState();
  if (!ONLINE_ENABLED || !on.account) return;
  // Con un conflicto pendiente no se sube: pisaría la partida de la nube antes de que el jugador elija.
  if (!on.conflict) void pushSave();
  if (on.autoSubmit && on.account.nickname) void submitRun(toSubmission(r)).catch(() => false);
}
