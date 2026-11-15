// Modelo de guardado (05_TECH.md §4), valores por defecto, migraciones y exportar/importar.
// TS puro: el store de Zustand solo envuelve estas funciones.
export { defaultLanguage, defaultSettings, newSurvivor, defaultSave } from './data';
export type { Language, Settings, OwnedSurvivor, MissionProgress, SaveData } from './data';
export { exportSave, importSave } from './io';
export { normalize, migrate } from './normalize';
