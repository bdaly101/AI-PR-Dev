/**
 * Global test setup for Vitest
 * This file runs before all tests and sets up mock environment variables
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables before any imports that depend on config
process.env.GITHUB_APP_ID = '12345';
process.env.GITHUB_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEA\ntest-key-content\n-----END RSA PRIVATE KEY-----';
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.OPENAI_API_KEY = 'sk-test-openai-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Clean up mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Global test utilities
export const TEST_OWNER = 'test-owner';
export const TEST_REPO = 'test-repo';
export const TEST_PR_NUMBER = 1;
export const TEST_INSTALLATION_ID = 12345;
export const TEST_COMMIT_SHA = 'abc123def456';

