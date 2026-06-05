import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror the "@/*" -> "./*" path mapping from tsconfig.json so test files can
// import application modules with the same specifiers used in source.
const repoRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '')

export default defineConfig({
  resolve: {
    alias: {
      '@': repoRoot,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
