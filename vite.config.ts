import { defineConfig } from 'vite';
import { offlinePrecache } from './scripts/precache.mjs';

export default defineConfig({
  base: './',
  plugins: [offlinePrecache()],
  server: {
    // Allow opening the dev server through Tailscale MagicDNS names.
    allowedHosts: ['.ts.net'],
  },
  build: {
    // Phaser alone is about 1.2 MB; it gets its own chunk so game updates don't re-download it.
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      input: { game: 'index.html', artwork: 'sprite-preview.html' },
      output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] } },
    },
  },
  test: {
    // Bound concurrent simulation/asset workers so complete-day economy checks
    // keep their original timeout and assertions on constrained cloud runners.
    maxWorkers: 2,
    environment: 'node',
  },
});
