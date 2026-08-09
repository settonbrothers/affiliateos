import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Component tests render JSX with react-dom/server; without the automatic
  // runtime the transform leaves bare `React.createElement` calls behind.
  esbuild: { jsx: 'automatic' },
  // Match the `@/*` path alias in tsconfig.json. Type-only imports get erased,
  // so this only started mattering once a module under test imported a real
  // value from `@/`.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Only the Next app is tested by Vitest. Edge functions under supabase/
    // are Deno and run via `deno test`.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
