import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // Allow opening the dev server through Tailscale MagicDNS names.
    allowedHosts: ['.ts.net'],
  },
  build: {
    // Phaser alone is about 1.2 MB; it gets its own chunk so game updates don't re-download it.
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] } },
    },
  },
  test: {
    environment: 'node',
  },
});
