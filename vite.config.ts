/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rubexper/',
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
