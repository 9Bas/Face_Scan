/**
 * Startup sanity checks. Runs once when the app boots and console.warns
 * about misconfiguration that could leak secrets or break production.
 */

const VITE_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_WORKER_URL',
]

// Keys that must NEVER be present in the frontend bundle.
const FORBIDDEN_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_SECRET_ACCESS_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_ACCOUNT_ID',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_R2_SECRET_ACCESS_KEY',
]

export function runEnvChecks(): void {
  const isProd = import.meta.env.PROD

  // 1. Warn if required public keys are missing in production.
  if (isProd) {
    const missing = VITE_KEYS.filter((k) => !import.meta.env[k])
    if (missing.length) {
      // VITE_WORKER_URL is optional (Supabase Storage fallback), so soften it.
      const critical = missing.filter((k) => k !== 'VITE_WORKER_URL')
      if (critical.length) {
        console.warn(
          `[Face Scan] Missing required env vars in production: ${critical.join(', ')}`,
        )
      }
    }
  }

  // 2. Hard block: forbidden secrets in the frontend bundle.
  for (const key of FORBIDDEN_KEYS) {
    if (import.meta.env[key]) {
      console.error(
        `[Face Scan] SECURITY: "${key}" was found in the frontend bundle. ` +
          'Remove it from .env immediately — secrets must live server-side only.',
      )
    }
  }

  // 3. Confirm VITE_SUPABASE_URL looks like a Supabase project URL.
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (url && !/^https:\/\/[a-z0-9.-]+\.supabase\.(co|in)$/.test(url)) {
    console.warn(
      `[Face Scan] VITE_SUPABASE_URL doesn't look like a Supabase project URL: ${url}`,
    )
  }
}