import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: false,
    // QA harnesses run headless Edge against .qa/.figma; watching its locked
    // profile files crashes the dev server with EBUSY.
    watch: { ignored: ['**/.qa/**', '**/.figma/**'] },
  },
});
