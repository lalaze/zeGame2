import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // Allow opening the dev server through Tailscale MagicDNS names.
    allowedHosts: ['.ts.net'],
  },
  test: {
    environment: 'node',
  },
});
