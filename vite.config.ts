import { defineConfig } from 'vite';
import { resolve } from 'path';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Declare the dashboard as an explicit HTML entry so Vite compiles its
      // TypeScript and rewrites the <script> tag. (The popup and content
      // scripts are handled by CRXJS via the manifest; the dashboard is only a
      // web_accessible_resource, which CRXJS copies verbatim, so it needs this.)
      input: {
        dashboard: resolve(__dirname, 'src/dashboard/dashboard.html'),
      },
    },
  },
});
