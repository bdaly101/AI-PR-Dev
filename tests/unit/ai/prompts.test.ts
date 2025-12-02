import { describe, it, expect } from 'vitest';
import {
  REVIEWER_SYSTEM_PROMPT,
  DEV_AGENT_SYSTEM_PROMPT,
  buildReviewerPrompt,
  buildReviewerSystemPrompt,
  buildFixLintsPrompt,
  buildAddTypesPrompt,
  buildImproveDocsPrompt,
  prompts,
} from '../../../src/ai/prompts';
import type { PRContext } from '../../../src/github/prHelpers';

describe('ai/prompts', () => {
  const mockPRContext: PRContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 1,
    title: 'Add user authentication feature',
    description: 'This PR adds JWT-based authentication',
    author: 'testuser',
    baseBranch: 'main',
    headBranch: 'feature/auth',
    commitSha: 'abc123',
    totalFiles: 3,
    totalAdditions: 100,
    totalDeletions: 20,
    reviewedFiles: 3,
    skippedFiles: 0,
    truncatedFiles: 0,
    files: [
      {
        filename: 'src/auth/login.ts',
        status: 'added',
        additions: 50,
        deletions: 0,
        changes: 50,
        patch: '+const login = () => {};',
        truncated: false,
        skipped: false,
      },
      {
        filename: 'src/auth/jwt.ts',
        status: 'added',
        additions: 30,
        deletions: 0,
        changes: 30,
        patch: '+const generateToken = () => {};',
        truncated: false,
        skipped: false,
      },
    ],
    formattedDiff: '```diff\n+const x = 1;\n```',
    warnings: [],
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };

  describe('REVIEWER_SYSTEM_PROMPT', () => {
    it('should contain expert code reviewer instruction', () => {
      expect(REVIEWER_SYSTEM_PROMPT).toContain('expert code reviewer');
    });

    it('should specify JSON output format', () => {
      expect(REVIEWER_SYSTEM_PROMPT).toContain('JSON');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('summary');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('severity');
    });

    it('should include all required response fields', () => {
      expect(REVIEWER_SYSTEM_PROMPT).toContain('summary');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('severity');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('strengths');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('risks');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('suggestions');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('inlineComments');
    });

    it('should include severity values', () => {
      expect(REVIEWER_SYSTEM_PROMPT).toContain('info');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('warning');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('critical');
    });

    it('should include risk categories', () => {
      expect(REVIEWER_SYSTEM_PROMPT).toContain('bug');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('security');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('performance');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('style');
      expect(REVIEWER_SYSTEM_PROMPT).toContain('maintainability');
    });
  });

  describe('DEV_AGENT_SYSTEM_PROMPT', () => {
    it('should contain code improvement instruction', () => {
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('code improvements');
    });

    it('should include safety principles', () => {
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('NEVER hallucinate');
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('ONLY modify code');
    });

    it('should list allowed changes', () => {
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('linting');
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('type annotations');
    });

    it('should list prohibited changes', () => {
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('infrastructure files');
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('database schemas');
    });

    it('should include change plan schema', () => {
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('title');
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('description');
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('changes');
      expect(DEV_AGENT_SYSTEM_PROMPT).toContain('impactAnalysis');
    });
  });

  describe('buildReviewerPrompt', () => {
    it('should include PR title', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('Add user authentication feature');
    });

    it('should include PR description', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('JWT-based authentication');
    });

    it('should include author', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('testuser');
    });

    it('should include branch information', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('main');
      expect(prompt).toContain('feature/auth');
    });

    it('should include file count', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('3 of 3 files reviewed');
    });

    it('should include change statistics', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('+100');
      expect(prompt).toContain('-20');
    });

    it('should include changed files list', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('src/auth/login.ts');
      expect(prompt).toContain('src/auth/jwt.ts');
    });

    it('should include formatted diff', () => {
      const prompt = buildReviewerPrompt(mockPRContext);
      expect(prompt).toContain('const x = 1');
    });

    it('should handle empty description', () => {
      const contextWithoutDesc = {
        ...mockPRContext,
        description: '',
      };
      const prompt = buildReviewerPrompt(contextWithoutDesc);
      expect(prompt).toContain('No description provided');
    });

    it('should include warnings if present', () => {
      const contextWithWarnings = {
        ...mockPRContext,
        warnings: ['Some files were truncated', 'Large PR'],
      };
      const prompt = buildReviewerPrompt(contextWithWarnings);
      expect(prompt).toContain('Review Notes');
      expect(prompt).toContain('Some files were truncated');
    });

    it('should skip files that are skipped', () => {
      const contextWithSkipped = {
        ...mockPRContext,
        files: [
          ...mockPRContext.files,
          {
            filename: 'package-lock.json',
            status: 'modified' as const,
            additions: 1000,
            deletions: 500,
            changes: 1500,
            truncated: false,
            skipped: true,
            skipReason: 'Lock file',
          },
        ],
      };
      const prompt = buildReviewerPrompt(contextWithSkipped);
      expect(prompt).not.toContain('package-lock.json');
    });
  });

  describe('buildReviewerSystemPrompt', () => {
    it('should include base prompt', () => {
      const prompt = buildReviewerSystemPrompt('normal');
      expect(prompt).toContain('expert code reviewer');
    });

    it('should include strictness guidelines for relaxed', () => {
      const prompt = buildReviewerSystemPrompt('relaxed');
      expect(prompt).toContain('lenient');
    });

    it('should include strictness guidelines for strict', () => {
      const prompt = buildReviewerSystemPrompt('strict');
      expect(prompt).toContain('thorough');
    });

    it('should default to normal', () => {
      const normalPrompt = buildReviewerSystemPrompt('normal');
      const defaultPrompt = buildReviewerSystemPrompt();
      // Both should contain 'Balanced' as that's in normal guidelines
      expect(normalPrompt).toContain('Balanced');
      expect(defaultPrompt).toContain('Balanced');
    });
  });

  describe('buildFixLintsPrompt', () => {
    it('should include command name', () => {
      const prompt = buildFixLintsPrompt(
        [{ path: 'src/test.ts', content: 'const x = 1' }],
        [{ file: 'src/test.ts', line: 1, rule: 'no-unused-vars', message: 'x is unused' }]
      );
      expect(prompt).toContain('/ai-fix-lints');
    });

    it('should include lint errors', () => {
      const prompt = buildFixLintsPrompt(
        [{ path: 'src/test.ts', content: 'const x = 1' }],
        [{ file: 'src/test.ts', line: 1, rule: 'no-unused-vars', message: 'x is unused' }]
      );
      expect(prompt).toContain('src/test.ts');
      expect(prompt).toContain('Line 1');
      expect(prompt).toContain('no-unused-vars');
      expect(prompt).toContain('x is unused');
    });

    it('should include file contents', () => {
      const prompt = buildFixLintsPrompt(
        [{ path: 'src/test.ts', content: 'const x = 1;\nconst y = 2;' }],
        []
      );
      expect(prompt).toContain('const x = 1');
      expect(prompt).toContain('const y = 2');
    });

    it('should include instructions', () => {
      const prompt = buildFixLintsPrompt([], []);
      expect(prompt).toContain('Fix only the specific lint errors');
      expect(prompt).toContain('Do not change any logic');
    });
  });

  describe('buildAddTypesPrompt', () => {
    it('should include command name', () => {
      const prompt = buildAddTypesPrompt(
        [{ path: 'src/test.ts', content: 'function test() {}' }],
        []
      );
      expect(prompt).toContain('/ai-add-types');
    });

    it('should include files to improve', () => {
      const prompt = buildAddTypesPrompt(
        [{ path: 'src/utils.ts', content: 'export function helper(x) { return x; }' }],
        []
      );
      expect(prompt).toContain('src/utils.ts');
      expect(prompt).toContain('export function helper');
    });

    it('should include type definition files', () => {
      const prompt = buildAddTypesPrompt(
        [{ path: 'src/utils.ts', content: 'function test() {}' }],
        [{ path: 'src/types.ts', content: 'export interface User { name: string }' }]
      );
      expect(prompt).toContain('Known Type Definitions');
      expect(prompt).toContain('interface User');
    });

    it('should include instructions for type additions', () => {
      const prompt = buildAddTypesPrompt([], []);
      expect(prompt).toContain('return type annotations');
      expect(prompt).toContain('parameter type annotations');
      expect(prompt).toContain('Replace `any` types');
    });
  });

  describe('buildImproveDocsPrompt', () => {
    it('should include command name', () => {
      const prompt = buildImproveDocsPrompt([
        { path: 'src/test.ts', content: 'function test() {}' },
      ]);
      expect(prompt).toContain('/ai-improve-docs');
    });

    it('should include file contents', () => {
      const prompt = buildImproveDocsPrompt([
        { path: 'src/utils.ts', content: 'export function calculate(a, b) { return a + b; }' },
      ]);
      expect(prompt).toContain('src/utils.ts');
      expect(prompt).toContain('function calculate');
    });

    it('should include documentation instructions', () => {
      const prompt = buildImproveDocsPrompt([]);
      expect(prompt).toContain('JSDoc');
      expect(prompt).toContain('Do NOT change any code logic');
    });
  });

  describe('legacy prompts', () => {
    describe('prompts.reviewPR', () => {
      it('should create review prompt from parameters', () => {
        const prompt = prompts.reviewPR(
          'Test PR Title',
          'Test description',
          '+const x = 1;'
        );
        expect(prompt).toContain('Test PR Title');
        expect(prompt).toContain('Test description');
        expect(prompt).toContain('const x = 1');
      });
    });

    describe('prompts.reviewFile', () => {
      it('should create file review prompt', () => {
        const prompt = prompts.reviewFile(
          'src/test.ts',
          'const x = 1;',
          '+const x = 1;'
        );
        expect(prompt).toContain('src/test.ts');
        expect(prompt).toContain('const x = 1');
        expect(prompt).toContain('JSON');
      });
    });

    describe('prompts.fixLints', () => {
      it('should create fix lints prompt', () => {
        const prompt = prompts.fixLints(
          'src/test.ts',
          'const x = 1;',
          'Line 1: unused variable'
        );
        expect(prompt).toContain('src/test.ts');
        expect(prompt).toContain('const x = 1');
        expect(prompt).toContain('unused variable');
      });
    });

    describe('prompts.generateFixDescription', () => {
      it('should create fix description prompt', () => {
        const prompt = prompts.generateFixDescription(
          ['file1.ts', 'file2.ts'],
          '- Fixed lint error in file1\n- Fixed type error in file2'
        );
        expect(prompt).toContain('file1.ts');
        expect(prompt).toContain('file2.ts');
        expect(prompt).toContain('Fixed lint error');
      });
    });
  });
});

