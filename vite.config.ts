import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative assets keep the app working on Vercel, Netlify, Supabase Hosting,
  // GitHub Pages subpaths, and local `dist/index.html` previews.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
