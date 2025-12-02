import { describe, it, expect } from 'vitest';
import {
  truncateDiff,
  truncateTotalDiff,
  shouldIgnoreFile,
  formatPRTitle,
  formatCommitMessage,
  formatFileSize,
  formatDiffForAI,
} from '../../../src/utils/formatters';
import { PR_LIMITS } from '../../../src/config/constants';

describe('utils/formatters', () => {
  describe('truncateDiff', () => {
    it('should not truncate short diffs', () => {
      const diff = 'line1\nline2\nline3';
      const result = truncateDiff(diff);
      expect(result.truncated).toBe(false);
      expect(result.content).toBe(diff);
      expect(result.originalLines).toBe(3);
    });

    it('should truncate diff exceeding max lines', () => {
      const lines = Array(600).fill('const x = 1;').join('\n');
      const result = truncateDiff(lines, 500);
      expect(result.truncated).toBe(true);
      expect(result.content).toContain('lines omitted for brevity');
      expect(result.originalLines).toBe(600);
    });

    it('should preserve first and last halves when truncating', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join('\n');
      const result = truncateDiff(lines, 20);
      expect(result.content).toContain('line1');
      expect(result.content).toContain('line100');
      expect(result.truncated).toBe(true);
    });

    it('should truncate by character count', () => {
      const longContent = 'x'.repeat(20000);
      const result = truncateDiff(longContent, 1000, 15000);
      expect(result.truncated).toBe(true);
      expect(result.content).toContain('diff truncated due to size');
      expect(result.content.length).toBeLessThanOrEqual(15100); // +buffer for message
    });

    it('should handle empty diff', () => {
      const result = truncateDiff('');
      expect(result.truncated).toBe(false);
      expect(result.content).toBe('');
      expect(result.originalLines).toBe(1);
    });

    it('should use default limits from constants', () => {
      const lines = Array(PR_LIMITS.MAX_DIFF_LINES_PER_FILE + 100)
        .fill('code')
        .join('\n');
      const result = truncateDiff(lines);
      expect(result.truncated).toBe(true);
    });
  });

  describe('truncateTotalDiff', () => {
    it('should not truncate when under limit', () => {
      const diffs = [
        { filename: 'file1.ts', diff: 'line1\nline2' },
        { filename: 'file2.ts', diff: 'line1\nline2\nline3' },
      ];
      const result = truncateTotalDiff(diffs, 100);
      expect(result.every(r => !r.truncated && !r.skipped)).toBe(true);
    });

    it('should truncate files when approaching limit', () => {
      const diffs = [
        { filename: 'file1.ts', diff: Array(50).fill('line').join('\n') },
        { filename: 'file2.ts', diff: Array(100).fill('line').join('\n') },
      ];
      const result = truncateTotalDiff(diffs, 80);
      expect(result[0].skipped).toBe(false);
      expect(result[1].truncated).toBe(true);
    });

    it('should skip remaining files when limit reached', () => {
      const diffs = [
        { filename: 'file1.ts', diff: Array(100).fill('line').join('\n') },
        { filename: 'file2.ts', diff: Array(50).fill('line').join('\n') },
        { filename: 'file3.ts', diff: 'small diff' },
      ];
      const result = truncateTotalDiff(diffs, 100);
      expect(result[0].skipped).toBe(false);
      expect(result[1].skipped).toBe(true);
      expect(result[2].skipped).toBe(true);
    });

    it('should handle empty array', () => {
      const result = truncateTotalDiff([]);
      expect(result).toHaveLength(0);
    });

    it('should use default max from constants', () => {
      const hugeDiff = Array(PR_LIMITS.MAX_TOTAL_DIFF_LINES + 100)
        .fill('code')
        .join('\n');
      const diffs = [{ filename: 'huge.ts', diff: hugeDiff }];
      const result = truncateTotalDiff(diffs);
      expect(result[0].truncated).toBe(true);
    });
  });

  describe('shouldIgnoreFile', () => {
    it('should ignore package-lock.json', () => {
      expect(shouldIgnoreFile('package-lock.json')).toBe(true);
    });

    it('should ignore yarn.lock', () => {
      expect(shouldIgnoreFile('yarn.lock')).toBe(true);
    });

    it('should ignore files in node_modules', () => {
      expect(shouldIgnoreFile('node_modules/lodash/index.js')).toBe(true);
    });

    it('should ignore minified files', () => {
      expect(shouldIgnoreFile('dist/app.min.js')).toBe(true);
      expect(shouldIgnoreFile('styles.min.css')).toBe(true);
    });

    it('should ignore source maps', () => {
      expect(shouldIgnoreFile('app.js.map')).toBe(true);
    });

    it('should ignore dist directory', () => {
      expect(shouldIgnoreFile('dist/index.js')).toBe(true);
    });

    it('should ignore build directory', () => {
      expect(shouldIgnoreFile('build/bundle.js')).toBe(true);
    });

    it('should not ignore regular source files', () => {
      expect(shouldIgnoreFile('src/index.ts')).toBe(false);
      expect(shouldIgnoreFile('src/utils/helper.js')).toBe(false);
    });

    it('should respect custom ignore patterns', () => {
      const customPatterns = ['*.test.ts', 'tests/**'];
      expect(shouldIgnoreFile('src/utils.test.ts', customPatterns)).toBe(true);
      expect(shouldIgnoreFile('tests/unit/helper.ts', customPatterns)).toBe(true);
      expect(shouldIgnoreFile('src/utils.ts', customPatterns)).toBe(false);
    });

    it('should handle glob patterns with **', () => {
      const patterns = ['**/migrations/**'];
      expect(shouldIgnoreFile('db/migrations/001.sql', patterns)).toBe(true);
      expect(shouldIgnoreFile('src/db/migrations/schema.ts', patterns)).toBe(true);
    });

    it('should handle exact match patterns', () => {
      const patterns = ['Dockerfile'];
      expect(shouldIgnoreFile('Dockerfile', patterns)).toBe(true);
      expect(shouldIgnoreFile('path/to/Dockerfile', patterns)).toBe(true);
    });

    it('should handle empty ignore patterns', () => {
      expect(shouldIgnoreFile('any-file.ts', [])).toBe(false);
    });

    it('should handle Windows-style paths', () => {
      expect(shouldIgnoreFile('node_modules\\lodash\\index.js')).toBe(true);
    });
  });

  describe('formatPRTitle', () => {
    it('should not modify short titles', () => {
      const title = 'Add user authentication';
      expect(formatPRTitle(title)).toBe(title);
    });

    it('should trim whitespace', () => {
      expect(formatPRTitle('  Add feature  ')).toBe('Add feature');
    });

    it('should truncate long titles with ellipsis', () => {
      const longTitle = 'This is a very long pull request title that exceeds the maximum character limit and should be truncated';
      const formatted = formatPRTitle(longTitle);
      expect(formatted.length).toBeLessThanOrEqual(72);
      expect(formatted.endsWith('...')).toBe(true);
    });

    it('should respect custom max length', () => {
      const title = 'This is a medium length title';
      const formatted = formatPRTitle(title, 20);
      expect(formatted.length).toBeLessThanOrEqual(20);
      expect(formatted.endsWith('...')).toBe(true);
    });

    it('should not add ellipsis if title fits exactly', () => {
      const title = 'x'.repeat(72);
      expect(formatPRTitle(title)).toBe(title);
    });
  });

  describe('formatCommitMessage', () => {
    it('should format title only', () => {
      const result = formatCommitMessage('Add feature');
      expect(result).toBe('Add feature');
    });

    it('should format title and body', () => {
      const result = formatCommitMessage('Add feature', 'This is the body');
      expect(result).toBe('Add feature\n\nThis is the body');
    });

    it('should format title, body, and footer', () => {
      const result = formatCommitMessage(
        'Add feature',
        'This is the body',
        'Closes #123'
      );
      expect(result).toBe('Add feature\n\nThis is the body\n\nCloses #123');
    });

    it('should truncate long title', () => {
      const longTitle = 'x'.repeat(100);
      const result = formatCommitMessage(longTitle);
      expect(result.split('\n')[0].length).toBeLessThanOrEqual(72);
    });

    it('should handle empty body with footer', () => {
      const result = formatCommitMessage('Title', undefined, 'Footer');
      expect(result).toBe('Title\n\nFooter');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should handle zero', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });

  describe('formatDiffForAI', () => {
    it('should format diff with metadata', () => {
      const result = formatDiffForAI('src/index.ts', '+const x = 1;', 5, 2);
      expect(result).toContain('### File: src/index.ts');
      expect(result).toContain('**Changes:** +5 -2');
      expect(result).toContain('```diff');
      expect(result).toContain('+const x = 1;');
      expect(result).toContain('```');
    });

    it('should handle empty diff', () => {
      const result = formatDiffForAI('empty.ts', '', 0, 0);
      expect(result).toContain('### File: empty.ts');
      expect(result).toContain('**Changes:** +0 -0');
    });

    it('should preserve diff content exactly', () => {
      const diff = '@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;';
      const result = formatDiffForAI('test.ts', diff, 1, 0);
      expect(result).toContain(diff);
    });
  });
});

