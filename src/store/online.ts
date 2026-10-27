// Estado online: la cuenta (en memoria) y preferencias locales (consentimiento, envío automático, ocultos).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '../online/online';

interface OnlineStore {
  /** El jugador aceptó conectarse alguna vez: se reconecta solo al abrir. */
  connected: boolean;
  autoSubmit: boolean;
  /** Entradas del ranking ocultadas por este jugador. */
  hiddenRuns: number[];
  lastSyncAt: string | null;
  account: Account | null;
  status: 'idle' | 'busy' | 'error';
  set(p: Partial<Omit<OnlineStore, 'set'>>): void;
  hide(id: number): void;
}

export const useOnline = create<OnlineStore>()(
  persist(
    (set, get) => ({
      connected: false,
      autoSubmit: true,
      hiddenRuns: [],
      lastSyncAt: null,
      account: null,
      status: 'idle',
      set: (p) => set(p),
      hide: (id) => set({ hiddenRuns: [...new Set([...get().hiddenRuns, id])].slice(-500) }),
    }),
    {
      name: 'atomicash-online',
      version: 1,
      partialize: (s) => ({
        connected: s.connected,
        autoSubmit: s.autoSubmit,
        hiddenRuns: s.hiddenRuns,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);
