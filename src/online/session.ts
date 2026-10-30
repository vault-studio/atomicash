// Orquestación online sobre los stores: conectar, sincronizar la partida y enviar runs al ranking.
// Cualquier fallo de red se traga aquí: el juego nunca depende de la conexión.
import type { RunResults } from '../engine/world';
import { useOnline } from '../store/online';
import { useSave } from '../store/save';
import { ONLINE_ENABLED, downloadSave, ensureAccount, submitRun, toSubmission, uploadSave } from './online';

/** Conecta (crea un invitado la primera vez). Si la nube tiene partida y la local está vacía, la baja. */
export async function connect(): Promise<void> {
  if (!ONLINE_ENABLED) return;
  const on = useOnline.getState();
  on.set({ status: 'busy' });
  try {
    const account = await ensureAccount();
    on.set({ account, connected: true, status: 'idle' });
    const local = useSave.getState().data;
    // Sin expediciones jugadas, la partida de la nube manda (la local acaba de crearse).
    if (local.profile.stats.runs === 0) {
      const cloud = await downloadSave(account.userId);
      if (cloud) {
        useSave.getState().replace(cloud.data);
        on.set({ lastSyncAt: cloud.updatedAt });
      }
    }
  } catch {
    on.set({ status: 'error' });
  }
}

/** Sube la partida local y la marca como sincronizada. */
export async function pushSave(): Promise<boolean> {
  const acc = useOnline.getState().account;
  if (!acc) return false;
  try {
    const at = await uploadSave(acc.userId, useSave.getState().data);
    useOnline.getState().set({ lastSyncAt: at });
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
    useOnline.getState().set({ lastSyncAt: cloud.updatedAt });
    return true;
  } catch {
    return false;
  }
}

/** Tras cada run: copia en la nube y, si hay apodo y está activado, envío al ranking. */
export function afterRun(r: RunResults): void {
  const on = useOnline.getState();
  if (!ONLINE_ENABLED || !on.account) return;
  void pushSave();
  if (on.autoSubmit && on.account.nickname) void submitRun(toSubmission(r)).catch(() => false);
}
