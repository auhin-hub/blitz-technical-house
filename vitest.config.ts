import { defineConfig } from 'vitest/config';

// Unit tests for the pure calculator modules (src/lib/calc/*.ts). They have no
// DOM/Supabase/Chart.js runtime deps (engine is imported type-only), so the
// node environment is enough. These lock every formula to its workbook value.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
