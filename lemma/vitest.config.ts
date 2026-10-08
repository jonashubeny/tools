import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
    // Generators are property-tested over many seeds; give slow CI machines room.
    testTimeout: 30_000,
  },
});
