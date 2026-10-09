// @ts-check
import { defineConfig } from 'astro/config';

// Base-aware paths (BRIEF §C): the site deploys to a GitHub Pages subpath now
// (https://auhin-hub.github.io/blitz-technical-house/) and can move to a custom
// domain later with no rewrite. Always build URLs from import.meta.env.BASE_URL
// (see src/lib/config.ts) — never hard-code the leading "/blitz-technical-house".
export default defineConfig({
  site: 'https://auhin-hub.github.io',
  base: '/blitz-technical-house',
  trailingSlash: 'ignore',
  // Static output — the front-end is static (GitHub Pages); it talks to Supabase
  // at runtime from light client islands. (Astro's default is already 'static'.)
  output: 'static',
  build: {
    // Emit /page/index.html so the base-aware routes resolve cleanly on Pages.
    format: 'directory',
  },
});
