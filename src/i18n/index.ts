import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// DECISIÓN: hasta que exista el store de ajustes (F3-01), el idioma inicial sale del navegador.
const initial: Language = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;
