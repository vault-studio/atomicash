import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';
import { useSave } from '../store/save';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// El idioma sale de los ajustes guardados (la primera vez, del navegador).
const initial: Language = useSave.getState().data.settings.language;

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;
