import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only the Next app is tested by Vitest. Edge functions under supabase/
    // are Deno and run via `deno test`.
    include: ['src/**/*.{test,spec}.ts'],
  },
})
