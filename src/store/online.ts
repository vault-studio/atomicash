// Estado online: la cuenta (en memoria) y preferencias locales (consentimiento y envío automático).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '../online/online';

interface OnlineStore {
  /** El jugador aceptó conectarse alguna vez: se reconecta solo al abrir. */
  connected: boolean;
  autoSubmit: boolean;
  lastSyncAt: string | null;
  account: Account | null;
  status: 'idle' | 'busy' | 'error';
  set(p: Partial<Omit<OnlineStore, 'set'>>): void;
}

export const useOnline = create<OnlineStore>()(
  persist(
    (set) => ({
      connected: false,
      autoSubmit: true,
      lastSyncAt: null,
      account: null,
      status: 'idle',
      set: (p) => set(p),
    }),
    {
      name: 'atomicash-online',
      version: 1,
      partialize: (s) => ({
        connected: s.connected,
        autoSubmit: s.autoSubmit,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);
