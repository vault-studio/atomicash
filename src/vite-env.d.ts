/// <reference types="vite/client" />

// Fase 4: sin estas variables el juego funciona igual, solo local (docs/ONLINE.md).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
