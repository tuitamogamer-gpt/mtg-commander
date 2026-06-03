/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin for a split-origin deploy; empty in dev (Vite proxy). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
