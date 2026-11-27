import {defineConfig} from 'vitest/config';

// Vitest unit-test config.
// The node:test suite (src/lib/__tests__/fixes.test.ts) stays on `tsx --test`
// in the "test" script; Vitest only picks up the Vitest-based suites so the
// two test runners never collide.
export default defineConfig({
  test: {
    include: [
      'src/lib/__tests__/arabicSearch.test.ts',
      'src/lib/__tests__/workingHours.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
