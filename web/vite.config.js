import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built site works from any sub-path
  // (GitHub Pages serves it at /<repo-name>/).
  base: './',
  server: { port: 5173 },
  preview: { port: 4173 },
});
