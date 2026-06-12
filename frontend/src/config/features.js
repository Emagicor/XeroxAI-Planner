/**
 * Build-time feature flags (Vite env vars).
 *
 * Development: Test Suite tab + dev APIs enabled by default.
 * Production:   Analyze tab only — set VITE_APP_ENV=production or VITE_FEATURE_TEST_SUITE=false.
 */

function readAppEnv() {
  const explicit = import.meta.env.VITE_APP_ENV?.trim().toLowerCase()
  if (explicit === 'production' || explicit === 'development') return explicit
  return import.meta.env.PROD ? 'production' : 'development'
}

function readFlag(name, defaultValue) {
  const raw = import.meta.env[name]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true' || raw === '1'
}

export const appEnv = readAppEnv()
export const isProduction = appEnv === 'production'

export const features = {
  /** Batch QA tab — filesystem APIs via Vite dev plugin; off in production builds. */
  testSuite: readFlag('VITE_FEATURE_TEST_SUITE', !isProduction),
  /** Allow downloading raw analyze JSON from the results panel. */
  jsonDownload: readFlag('VITE_FEATURE_JSON_DOWNLOAD', true),
}
