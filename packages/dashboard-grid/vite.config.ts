import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Builds the library the way it is published: one ES module,
// Vue as an external peer dependency, and all styles in dist/style.css
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue'],
    },
    sourcemap: true,
    // The build script clears dist itself, so watch mode keeps the type files
    emptyOutDir: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
