import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// A normal Vue app that imports custom-dashboard-grid by package name
// like an outside project would, no aliases into the library source
export default defineConfig({
  plugins: [vue()],
})
