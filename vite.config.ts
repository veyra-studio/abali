import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Set VEYRA_CORE_SRC=../veyra-core to develop against the engine source
// (HMR across both repositories). Builds use the vendored release.
const coreSrc = process.env.VEYRA_CORE_SRC ? resolve(process.env.VEYRA_CORE_SRC, 'src') : null

export default defineConfig({
  // GitHub Pages project site: https://veyra-studio.github.io/abali/
  // Used in dev and preview too, so path mistakes surface before deploy.
  base: '/abali/',
  resolve: {
    alias: coreSrc
      ? [
          { find: /^@veyra\/core\/three$/, replacement: resolve(coreSrc, 'three/index.ts') },
          { find: /^@veyra\/core$/, replacement: resolve(coreSrc, 'index.ts') },
        ]
      : [],
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
})
