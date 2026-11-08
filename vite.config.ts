import { defineConfig } from 'vite';

// base: './' makes every asset path relative, so the same build works on
// GitHub Pages (https://<user>.github.io/<repo>/), Netlify, Vercel or a local folder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
