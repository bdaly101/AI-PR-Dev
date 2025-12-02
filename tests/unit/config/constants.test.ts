import { describe, it, expect } from 'vitest';
import {
  PR_LIMITS,
  SAFETY_LIMITS,
  AI_DEFAULTS,
  DEFAULT_IGNORE_PATTERNS,
} from '../../../src/config/constants';

describe('config/constants', () => {
  describe('PR_LIMITS', () => {
    it('should have reasonable max files limit', () => {
      expect(PR_LIMITS.MAX_FILES_PER_REVIEW).toBeGreaterThan(0);
      expect(PR_LIMITS.MAX_FILES_PER_REVIEW).toBeLessThanOrEqual(100);
    });

    it('should have reasonable diff line limits', () => {
      expect(PR_LIMITS.MAX_DIFF_LINES_PER_FILE).toBeGreaterThan(0);
      expect(PR_LIMITS.MAX_TOTAL_DIFF_LINES).toBeGreaterThan(PR_LIMITS.MAX_DIFF_LINES_PER_FILE);
    });

    it('should have reasonable character limit per file', () => {
      expect(PR_LIMITS.MAX_DIFF_CHARS_PER_FILE).toBeGreaterThan(0);
    });

    it('should have reasonable file size limit', () => {
      expect(PR_LIMITS.MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
      expect(PR_LIMITS.MAX_FILE_SIZE_BYTES).toBeLessThanOrEqual(1000000); // 1MB max
    });

    it('should have positive cache TTL', () => {
      expect(PR_LIMITS.PR_CONTEXT_CACHE_TTL).toBeGreaterThan(0);
    });
  });

  describe('SAFETY_LIMITS', () => {
    it('should have reasonable max files per AI PR', () => {
      expect(SAFETY_LIMITS.MAX_FILES_PER_PR).toBeGreaterThan(0);
      expect(SAFETY_LIMITS.MAX_FILES_PER_PR).toBeLessThanOrEqual(20);
    });

    it('should have reasonable max lines changed', () => {
      expect(SAFETY_LIMITS.MAX_LINES_CHANGED).toBeGreaterThan(0);
      expect(SAFETY_LIMITS.MAX_LINES_CHANGED).toBeLessThanOrEqual(500);
    });

    it('should limit commits per PR to 1', () => {
      expect(SAFETY_LIMITS.MAX_COMMITS_PER_PR).toBe(1);
    });

    it('should have allowed base branches defined', () => {
      expect(SAFETY_LIMITS.ALLOWED_BASE_BRANCHES).toBeInstanceOf(Array);
      expect(SAFETY_LIMITS.ALLOWED_BASE_BRANCHES.length).toBeGreaterThan(0);
    });

    it('should exclude main/master from allowed branches', () => {
      expect(SAFETY_LIMITS.ALLOWED_BASE_BRANCHES).not.toContain('main');
      expect(SAFETY_LIMITS.ALLOWED_BASE_BRANCHES).not.toContain('master');
    });

    it('should have forbidden paths defined', () => {
      expect(SAFETY_LIMITS.FORBIDDEN_PATHS).toBeInstanceOf(Array);
      expect(SAFETY_LIMITS.FORBIDDEN_PATHS.length).toBeGreaterThan(0);
    });

    it('should forbid infrastructure files', () => {
      const forbiddenPatterns = SAFETY_LIMITS.FORBIDDEN_PATHS;
      expect(forbiddenPatterns).toContain('Dockerfile');
      expect(forbiddenPatterns.some(p => p.includes('workflows'))).toBe(true);
      expect(forbiddenPatterns.some(p => p.includes('terraform'))).toBe(true);
    });

    it('should forbid package management files', () => {
      const forbiddenPatterns = SAFETY_LIMITS.FORBIDDEN_PATHS;
      expect(forbiddenPatterns).toContain('package.json');
      expect(forbiddenPatterns).toContain('package-lock.json');
    });

    it('should forbid environment files', () => {
      const forbiddenPatterns = SAFETY_LIMITS.FORBIDDEN_PATHS;
      expect(forbiddenPatterns).toContain('.env');
      expect(forbiddenPatterns.some(p => p.includes('.env'))).toBe(true);
    });
  });

  describe('AI_DEFAULTS', () => {
    it('should have provider set to openai', () => {
      expect(AI_DEFAULTS.PROVIDER).toBe('openai');
    });

    it('should have review model defined', () => {
      expect(AI_DEFAULTS.REVIEW_MODEL).toBeDefined();
      expect(typeof AI_DEFAULTS.REVIEW_MODEL).toBe('string');
    });

    it('should have conservative review temperature', () => {
      expect(AI_DEFAULTS.REVIEW_TEMPERATURE).toBeGreaterThanOrEqual(0);
      expect(AI_DEFAULTS.REVIEW_TEMPERATURE).toBeLessThanOrEqual(1);
    });

    it('should have very low code generation temperature', () => {
      expect(AI_DEFAULTS.CODE_GEN_TEMPERATURE).toBeGreaterThanOrEqual(0);
      expect(AI_DEFAULTS.CODE_GEN_TEMPERATURE).toBeLessThanOrEqual(0.5);
    });

    it('should have reasonable max review tokens', () => {
      expect(AI_DEFAULTS.MAX_REVIEW_TOKENS).toBeGreaterThan(0);
      expect(AI_DEFAULTS.MAX_REVIEW_TOKENS).toBeLessThanOrEqual(8000);
    });
  });

  describe('DEFAULT_IGNORE_PATTERNS', () => {
    it('should be an array', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toBeInstanceOf(Array);
    });

    it('should include lock files', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('package-lock.json');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('yarn.lock');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('pnpm-lock.yaml');
    });

    it('should include minified files', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.min.js');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.min.css');
    });

    it('should include source maps', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.map');
    });

    it('should include build directories', () => {
      expect(DEFAULT_IGNORE_PATTERNS.some(p => p.includes('dist'))).toBe(true);
      expect(DEFAULT_IGNORE_PATTERNS.some(p => p.includes('build'))).toBe(true);
    });

    it('should include node_modules', () => {
      expect(DEFAULT_IGNORE_PATTERNS.some(p => p.includes('node_modules'))).toBe(true);
    });

    it('should include coverage directory', () => {
      expect(DEFAULT_IGNORE_PATTERNS.some(p => p.includes('coverage'))).toBe(true);
    });

    it('should include generated files', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.generated.*');
    });
  });
});

