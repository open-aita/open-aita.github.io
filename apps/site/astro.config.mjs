import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://open-aita.github.io',
  output: 'static',
  outDir: '../../dist',
  compressHTML: false,
  server: { host: '127.0.0.1', port: 4174 },
});
