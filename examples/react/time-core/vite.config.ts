import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

export default defineConfig({
  plugins: [
    devtools({
      editor: {
        name: 'zed',
        open: async (path, lineNumber, columnNumber) => {
          const { exec } = await import('node:child_process')
          // Zed takes `path:line:column` as a positional arg — it has no `-g`
          // flag (that's VSCode's `code -g`). Passing `-g` makes the zed CLI
          // exit with "unexpected argument '-g' found" and open nothing.
          exec(
            `zed "${path.replaceAll('$', '\\$')}${lineNumber ? `:${lineNumber}` : ''}${columnNumber ? `:${columnNumber}` : ''}"`,
            (err) => {
              if (err) console.warn('[devtools] zed open failed:', err.message)
            },
          )
        },
      },
      removeDevtoolsOnBuild: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // App-local alias for shadcn components (@/components/ui/*).
      '@/components/ui': fileURLToPath(
        new URL('./src/components/ui', import.meta.url),
      ),
      // Dogfood time-core + react-adapter straight from source — no build step.
      '@tanstack/time-core': fileURLToPath(
        new URL('../../../packages/time-core/src/index.ts', import.meta.url),
      ),
      '@tanstack/react-adapter': fileURLToPath(
        new URL(
          '../../../packages/react-adapter/src/index.ts',
          import.meta.url,
        ),
      ),
    },
  },
})
