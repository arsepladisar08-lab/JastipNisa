/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ADMIN_WHATSAPP?: string
  readonly VITE_OFFICIAL_CATALOG_URL?: string
  readonly VITE_GAS_WEBAPP_URL?: string
  readonly VITE_ENABLE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __JN_BOOT__?: {
    page?: unknown
    token?: unknown
    webAppUrl?: unknown
  }
}
