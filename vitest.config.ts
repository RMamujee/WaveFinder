import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror the "@/*" -> "./*" path mapping from tsconfig.json so test files can
// import application modules with the same specifiers used in source.
const repoRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '')

export default defineConfig({
  resolve: {
    alias: {
      '@': repoRoot,
      // `server-only` is a build-time marker package Next aliases during its
      // own bundling; it isn't resolvable under plain Node/vitest. Point it at
      // Next's no-op (react-server) shim so server modules guarded with
      // `import 'server-only'` can be imported in tests.
      'server-only': fileURLToPath(
        new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
