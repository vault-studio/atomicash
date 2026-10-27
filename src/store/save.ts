// Store persistido del Búnker (05_TECH.md §4): Zustand + persist bajo `atomicash-save`, con versión y migrate.
// Las reglas viven en `src/meta` (TS puro); aquí solo se clona, se aplica y se guarda.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SAVE } from '../config/meta';
import { defaultSave, migrate, type SaveData } from '../meta/save';

interface SaveStore {
  data: SaveData;
  /** Aplica una regla sobre un borrador y guarda. Devuelve lo que devuelva la regla. */
  act<R>(fn: (d: SaveData) => R): R;
  replace(d: SaveData): void;
  reset(): void;
}

export const useSave = create<SaveStore>()(
  persist(
    (set, get) => ({
      data: defaultSave(),
      act(fn) {
        const draft = structuredClone(get().data);
        const r = fn(draft);
        set({ data: draft });
        return r;
      },
      replace(d) {
        set({ data: d });
      },
      reset() {
        set({ data: defaultSave() });
      },
    }),
    {
      name: SAVE.key,
      version: SAVE.version,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data }),
      migrate: (persisted, version) => {
        const p = persisted as { data?: unknown } | null;
        return { data: migrate(p?.data ?? p, version) };
      },
      // Lo guardado pasa siempre por `migrate`/`normalize`: nunca entra un dato con forma rara.
      merge: (persisted, current) => {
        const p = persisted as { data?: unknown } | null;
        return { ...current, data: migrate(p?.data, SAVE.version) };
      },
    },
  ),
);

export const useSaveData = <T>(sel: (d: SaveData) => T): T => useSave((s) => sel(s.data));
