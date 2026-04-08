import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://lesley-literary.vercel.app',
  integrations: [
    react(),
    tailwind(),
  ],
  vite: {
    ssr: {
      noExternal: ['react-leaflet', 'leaflet'],
    },
  },
});
