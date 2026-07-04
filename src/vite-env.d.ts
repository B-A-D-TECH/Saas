/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TAX_RATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
