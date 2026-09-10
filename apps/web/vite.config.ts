import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: { '/socket': { target: 'ws://localhost:8787', ws: true } }
  }
});
