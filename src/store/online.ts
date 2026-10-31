// Estado online: la cuenta (en memoria) y preferencias locales (consentimiento y envío automático).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account, AuthReturn } from '../online/online';

/** La nube tiene otra partida distinta de la de este dispositivo (p. ej. al entrar con Google desde otro). */
export interface SaveConflict {
  localRuns: number;
  cloudRuns: number;
  cloudAt: string;
}

interface OnlineStore {
  /** El jugador aceptó conectarse alguna vez: se reconecta solo al abrir. */
  connected: boolean;
  autoSubmit: boolean;
  lastSyncAt: string | null;
  account: Account | null;
  status: 'idle' | 'busy' | 'error';
  /** Error con el que volvió el login de Google. */
  authReturn: AuthReturn | null;
  /** Hasta que el jugador elija, no se sube nada para no pisar ninguna de las dos. */
  conflict: SaveConflict | null;
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
      authReturn: null,
      conflict: null,
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
