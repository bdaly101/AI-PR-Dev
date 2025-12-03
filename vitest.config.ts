import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'vitest.config.ts',
        '**/*.d.ts',
        // M7 files - will be tested in future milestones
        'src/linting/**',
        'src/ai/changePlan.ts',
        'src/ai/changePlanner.ts',
        'src/services/changePlanService.ts',
        'src/database/repositories/changePlanRepo.ts',
        'src/utils/diff.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

