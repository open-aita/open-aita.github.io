import { defineConfig } from 'astro/config';
import redirects from '../../content/redirects.json' with {type:'json'};

export default defineConfig({
  site: 'https://open-aita.github.io',
  output: 'static',
  outDir: '../../dist',
  compressHTML: false,
  redirects: Object.fromEntries(redirects.map(({from,to,statusCode})=>[from,{destination:to,status:statusCode}])),
  server: { host: '127.0.0.1', port: 4174 },
});
