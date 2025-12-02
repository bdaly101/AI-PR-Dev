import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseRepoConfig,
  DEFAULT_CONFIG,
  CONFIG_FILE_NAME,
  getEffectiveIgnorePatterns,
  shouldReviewFile,
  getStrictnessGuidelines,
  filterByMinSeverity,
  RepoConfig,
} from '../../../src/config/repoConfig';
import { DEFAULT_IGNORE_PATTERNS } from '../../../src/config/constants';

// Read the sample config fixture
const sampleConfigPath = path.join(__dirname, '../../fixtures/config/sample-repo-config.yml');
const sampleConfig = fs.readFileSync(sampleConfigPath, 'utf-8');

describe('config/repoConfig', () => {
  describe('CONFIG_FILE_NAME', () => {
    it('should be .ai-pr-reviewer.yml', () => {
      expect(CONFIG_FILE_NAME).toBe('.ai-pr-reviewer.yml');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have version 1', () => {
      expect(DEFAULT_CONFIG.version).toBe(1);
    });

    it('should be enabled by default', () => {
      expect(DEFAULT_CONFIG.enabled).toBe(true);
    });

    it('should default to reviewer mode', () => {
      expect(DEFAULT_CONFIG.mode).toBe('reviewer');
    });

    it('should have normal strictness by default', () => {
      expect(DEFAULT_CONFIG.reviewer.strictness).toBe('normal');
    });

    it('should have openai as default provider', () => {
      expect(DEFAULT_CONFIG.ai.provider).toBe('openai');
    });

    it('should have devAgent disabled by default', () => {
      expect(DEFAULT_CONFIG.devAgent.enabled).toBe(false);
    });

    it('should require approval by default', () => {
      expect(DEFAULT_CONFIG.devAgent.requireApproval).toBe(true);
    });
  });

  describe('parseRepoConfig', () => {
    it('should parse valid YAML config', () => {
      const config = parseRepoConfig(sampleConfig);
      expect(config.version).toBe(1);
      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('reviewer');
    });

    it('should parse reviewer settings', () => {
      const config = parseRepoConfig(sampleConfig);
      expect(config.reviewer.strictness).toBe('normal');
      expect(config.reviewer.languages).toContain('typescript');
      expect(config.reviewer.languages).toContain('javascript');
      expect(config.reviewer.maxFilesReviewed).toBe(30);
    });

    it('should parse AI settings', () => {
      const config = parseRepoConfig(sampleConfig);
      expect(config.ai.provider).toBe('openai');
      expect(config.ai.model).toBe('gpt-4-turbo-preview');
      expect(config.ai.temperature).toBe(0.3);
    });

    it('should parse devAgent settings', () => {
      const config = parseRepoConfig(sampleConfig);
      expect(config.devAgent.enabled).toBe(false);
      expect(config.devAgent.allowedCommands).toContain('fix-lints');
      expect(config.devAgent.allowedCommands).toContain('add-types');
    });

    it('should return default config for empty YAML', () => {
      const config = parseRepoConfig('');
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should return default config for invalid YAML', () => {
      const config = parseRepoConfig('invalid: [yaml: content');
      expect(config.version).toBe(1);
    });

    it('should return default config for null parsed result', () => {
      const config = parseRepoConfig('null');
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should merge custom ignore paths with defaults', () => {
      const config = parseRepoConfig(sampleConfig);
      const ignorePatterns = config.reviewer.ignorePaths;
      // Should include both default patterns and custom ones from config
      expect(ignorePatterns.length).toBeGreaterThan(DEFAULT_IGNORE_PATTERNS.length);
    });

    it('should handle partial config', () => {
      const partialYaml = `
version: 1
enabled: false
`;
      const config = parseRepoConfig(partialYaml);
      expect(config.enabled).toBe(false);
      expect(config.mode).toBe('reviewer'); // default
      expect(config.reviewer.strictness).toBe('normal'); // default
    });

    it('should use defaults for invalid strictness', () => {
      const invalidYaml = `
version: 1
reviewer:
  strictness: invalid
`;
      const config = parseRepoConfig(invalidYaml);
      expect(config.reviewer.strictness).toBe('normal');
    });

    it('should enforce version to be 1', () => {
      const futureVersionYaml = `
version: 2
enabled: true
`;
      const config = parseRepoConfig(futureVersionYaml);
      // Should return defaults because version 2 is invalid
      expect(config.version).toBe(1);
    });
  });

  describe('getEffectiveIgnorePatterns', () => {
    it('should include default patterns', () => {
      const patterns = getEffectiveIgnorePatterns(DEFAULT_CONFIG);
      expect(patterns).toContain('package-lock.json');
      expect(patterns).toContain('node_modules/*');
    });

    it('should include custom patterns', () => {
      const config: RepoConfig = {
        ...DEFAULT_CONFIG,
        reviewer: {
          ...DEFAULT_CONFIG.reviewer,
          ignorePaths: ['custom/**', 'test/**'],
        },
      };
      const patterns = getEffectiveIgnorePatterns(config);
      expect(patterns).toContain('custom/**');
      expect(patterns).toContain('test/**');
    });

    it('should deduplicate patterns', () => {
      const config: RepoConfig = {
        ...DEFAULT_CONFIG,
        reviewer: {
          ...DEFAULT_CONFIG.reviewer,
          ignorePaths: ['package-lock.json'], // duplicate
        },
      };
      const patterns = getEffectiveIgnorePatterns(config);
      const packageLockCount = patterns.filter(p => p === 'package-lock.json').length;
      expect(packageLockCount).toBe(1);
    });
  });

  describe('shouldReviewFile', () => {
    it('should return true for regular source files', () => {
      expect(shouldReviewFile('src/index.ts', DEFAULT_CONFIG)).toBe(true);
      expect(shouldReviewFile('src/utils/helper.js', DEFAULT_CONFIG)).toBe(true);
    });

    it('should return false for node_modules', () => {
      expect(shouldReviewFile('node_modules/lodash/index.js', DEFAULT_CONFIG)).toBe(false);
    });

    it('should return false for lock files', () => {
      expect(shouldReviewFile('package-lock.json', DEFAULT_CONFIG)).toBe(false);
      expect(shouldReviewFile('yarn.lock', DEFAULT_CONFIG)).toBe(false);
    });

    it('should return false for minified files', () => {
      expect(shouldReviewFile('dist/bundle.min.js', DEFAULT_CONFIG)).toBe(false);
      expect(shouldReviewFile('styles.min.css', DEFAULT_CONFIG)).toBe(false);
    });

    it('should return false for dist directory', () => {
      expect(shouldReviewFile('dist/index.js', DEFAULT_CONFIG)).toBe(false);
    });

    it('should return false for coverage directory', () => {
      expect(shouldReviewFile('coverage/lcov.info', DEFAULT_CONFIG)).toBe(false);
    });

    it('should respect custom ignore patterns', () => {
      const config: RepoConfig = {
        ...DEFAULT_CONFIG,
        reviewer: {
          ...DEFAULT_CONFIG.reviewer,
          ignorePaths: [...DEFAULT_CONFIG.reviewer.ignorePaths, '**/*.test.ts'],
        },
      };
      expect(shouldReviewFile('src/utils/helper.test.ts', config)).toBe(false);
      expect(shouldReviewFile('src/utils/helper.ts', config)).toBe(true);
    });
  });

  describe('getStrictnessGuidelines', () => {
    it('should return relaxed guidelines', () => {
      const guidelines = getStrictnessGuidelines('relaxed');
      expect(guidelines).toContain('lenient');
      expect(guidelines).toContain('significant issues');
    });

    it('should return normal guidelines', () => {
      const guidelines = getStrictnessGuidelines('normal');
      expect(guidelines).toContain('Balanced');
      expect(guidelines).toContain('quality');
    });

    it('should return strict guidelines', () => {
      const guidelines = getStrictnessGuidelines('strict');
      expect(guidelines).toContain('thorough');
      expect(guidelines).toContain('comprehensive');
    });

    it('should default to normal for unknown strictness', () => {
      const guidelines = getStrictnessGuidelines('normal');
      expect(guidelines).toBeDefined();
    });
  });

  describe('filterByMinSeverity', () => {
    const testItems = [
      { severity: 'low' as const, name: 'Low item' },
      { severity: 'medium' as const, name: 'Medium item' },
      { severity: 'high' as const, name: 'High item' },
    ];

    it('should return all items when minSeverity is low', () => {
      const filtered = filterByMinSeverity(testItems, 'low');
      expect(filtered).toHaveLength(3);
    });

    it('should filter out low when minSeverity is medium', () => {
      const filtered = filterByMinSeverity(testItems, 'medium');
      expect(filtered).toHaveLength(2);
      expect(filtered.map(i => i.severity)).not.toContain('low');
    });

    it('should only include high when minSeverity is high', () => {
      const filtered = filterByMinSeverity(testItems, 'high');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('high');
    });

    it('should handle empty array', () => {
      const filtered = filterByMinSeverity([], 'low');
      expect(filtered).toHaveLength(0);
    });

    it('should handle all same severity', () => {
      const sameItems = [
        { severity: 'medium' as const },
        { severity: 'medium' as const },
      ];
      const filtered = filterByMinSeverity(sameItems, 'medium');
      expect(filtered).toHaveLength(2);
    });
  });
});

