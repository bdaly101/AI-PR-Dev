import { describe, it, expect } from 'vitest';
import {
  parseReviewResponse,
  parseAnyReviewResponse,
  parseLegacyResponse,
  ReviewResponseSchema,
  LegacyReviewResponseSchema,
  RiskSchema,
  InlineCommentSchema,
  ChangePlanSchema,
  FileChangeSchema,
  ImpactAnalysisSchema,
} from '../../../src/validation/schemas';
import validReviewResponse from '../../fixtures/ai/review-response-valid.json';
import legacyReviewResponse from '../../fixtures/ai/review-response-legacy.json';

describe('validation/schemas', () => {
  describe('ReviewResponseSchema', () => {
    it('should validate a complete valid review response', () => {
      const result = ReviewResponseSchema.safeParse(validReviewResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe(validReviewResponse.summary);
        expect(result.data.severity).toBe('warning');
        expect(result.data.strengths).toHaveLength(4);
        expect(result.data.risks).toHaveLength(3);
        expect(result.data.suggestions).toHaveLength(4);
        expect(result.data.inlineComments).toHaveLength(3);
      }
    });

    it('should reject response with missing summary', () => {
      const invalid = { ...validReviewResponse, summary: undefined };
      const result = ReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject response with summary too short', () => {
      const invalid = { ...validReviewResponse, summary: 'Too short' };
      const result = ReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject response with summary too long', () => {
      const invalid = { ...validReviewResponse, summary: 'x'.repeat(1001) };
      const result = ReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid severity level', () => {
      const invalid = { ...validReviewResponse, severity: 'extreme' };
      const result = ReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should accept all valid severity levels', () => {
      for (const severity of ['info', 'warning', 'critical']) {
        const valid = { ...validReviewResponse, severity };
        const result = ReviewResponseSchema.safeParse(valid);
        expect(result.success).toBe(true);
      }
    });

    it('should reject too many risks', () => {
      const tooManyRisks = Array(16).fill({
        category: 'bug',
        description: 'A bug was found',
        severity: 'low',
      });
      const invalid = { ...validReviewResponse, risks: tooManyRisks };
      const result = ReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject too many inline comments', () => {
      const tooManyComments = Array(26).fill({
        path: 'src/test.ts',
        line: 1,
        body: 'A comment',
      });
      const invalid = { ...validReviewResponse, inlineComments: tooManyComments };
      const result = ReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('RiskSchema', () => {
    it('should validate valid risk', () => {
      const risk = {
        category: 'security',
        description: 'SQL injection vulnerability found',
        severity: 'high',
      };
      const result = RiskSchema.safeParse(risk);
      expect(result.success).toBe(true);
    });

    it('should accept all valid categories', () => {
      const categories = ['bug', 'security', 'performance', 'style', 'maintainability'];
      for (const category of categories) {
        const risk = { category, description: 'Test description', severity: 'low' };
        const result = RiskSchema.safeParse(risk);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid category', () => {
      const risk = {
        category: 'invalid',
        description: 'Test',
        severity: 'low',
      };
      const result = RiskSchema.safeParse(risk);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const risk = {
        category: 'bug',
        description: '',
        severity: 'low',
      };
      const result = RiskSchema.safeParse(risk);
      expect(result.success).toBe(false);
    });

    it('should reject description too long', () => {
      const risk = {
        category: 'bug',
        description: 'x'.repeat(501),
        severity: 'low',
      };
      const result = RiskSchema.safeParse(risk);
      expect(result.success).toBe(false);
    });
  });

  describe('InlineCommentSchema', () => {
    it('should validate valid inline comment', () => {
      const comment = {
        path: 'src/auth/login.ts',
        line: 10,
        body: 'Consider adding error handling here',
      };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(true);
    });

    it('should reject empty path', () => {
      const comment = { path: '', line: 10, body: 'Test' };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });

    it('should reject negative line number', () => {
      const comment = { path: 'test.ts', line: -1, body: 'Test' };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });

    it('should reject zero line number', () => {
      const comment = { path: 'test.ts', line: 0, body: 'Test' };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer line number', () => {
      const comment = { path: 'test.ts', line: 10.5, body: 'Test' };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });

    it('should reject empty body', () => {
      const comment = { path: 'test.ts', line: 10, body: '' };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });

    it('should reject body too long', () => {
      const comment = { path: 'test.ts', line: 10, body: 'x'.repeat(1001) };
      const result = InlineCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });
  });

  describe('LegacyReviewResponseSchema', () => {
    it('should validate valid legacy response', () => {
      const result = LegacyReviewResponseSchema.safeParse(legacyReviewResponse);
      expect(result.success).toBe(true);
    });

    it('should accept all valid risk levels', () => {
      for (const riskLevel of ['low', 'medium', 'high']) {
        const legacy = { ...legacyReviewResponse, riskLevel };
        const result = LegacyReviewResponseSchema.safeParse(legacy);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid risk level', () => {
      const invalid = { ...legacyReviewResponse, riskLevel: 'critical' };
      const result = LegacyReviewResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('parseReviewResponse', () => {
    it('should parse valid review response', () => {
      const result = parseReviewResponse(validReviewResponse);
      expect(result.summary).toBe(validReviewResponse.summary);
      expect(result.severity).toBe('warning');
    });

    it('should throw on invalid response', () => {
      const invalid = { summary: 'short', severity: 'invalid' };
      expect(() => parseReviewResponse(invalid)).toThrow('Invalid review response');
    });

    it('should include field path in error message', () => {
      const invalid = { ...validReviewResponse, severity: 'invalid' };
      expect(() => parseReviewResponse(invalid)).toThrow('severity');
    });
  });

  describe('parseLegacyResponse', () => {
    it('should convert legacy response to new format', () => {
      const result = parseLegacyResponse(legacyReviewResponse);
      expect(result.summary).toBe(legacyReviewResponse.summary);
      expect(result.severity).toBe('warning'); // medium maps to warning
    });

    it('should map high risk level to critical severity', () => {
      const highRisk = { ...legacyReviewResponse, riskLevel: 'high' };
      const result = parseLegacyResponse(highRisk);
      expect(result.severity).toBe('critical');
    });

    it('should map low risk level to info severity', () => {
      const lowRisk = { ...legacyReviewResponse, riskLevel: 'low' };
      const result = parseLegacyResponse(lowRisk);
      expect(result.severity).toBe('info');
    });

    it('should convert inline comments format', () => {
      const result = parseLegacyResponse(legacyReviewResponse);
      expect(result.inlineComments).toHaveLength(1);
      expect(result.inlineComments[0].path).toBe('src/auth/jwt.ts');
      expect(result.inlineComments[0].line).toBe(3);
      expect(result.inlineComments[0].body).toBe(
        'Avoid using hardcoded secrets - use environment variables only.'
      );
    });

    it('should convert general comments to suggestions', () => {
      const result = parseLegacyResponse(legacyReviewResponse);
      expect(result.suggestions).toEqual(legacyReviewResponse.generalComments);
    });

    it('should throw on invalid legacy response', () => {
      const invalid = { summary: 'test' };
      expect(() => parseLegacyResponse(invalid)).toThrow('Invalid legacy review response');
    });
  });

  describe('parseAnyReviewResponse', () => {
    it('should parse new format first', () => {
      const result = parseAnyReviewResponse(validReviewResponse);
      expect(result.severity).toBe('warning');
      expect(result.strengths).toHaveLength(4);
    });

    it('should fall back to legacy format', () => {
      const result = parseAnyReviewResponse(legacyReviewResponse);
      expect(result.severity).toBe('warning');
      expect(result.suggestions).toEqual(legacyReviewResponse.generalComments);
    });

    it('should throw when both formats fail', () => {
      const invalid = { foo: 'bar' };
      expect(() => parseAnyReviewResponse(invalid)).toThrow('Invalid review response');
    });
  });

  describe('ChangePlanSchema', () => {
    it('should validate valid change plan', () => {
      const plan = {
        title: 'Fix lint errors in auth module',
        description: 'This PR fixes lint errors found in the authentication module',
        changes: [
          {
            file: 'src/auth/login.ts',
            action: 'modify',
            hunks: [
              {
                startLine: 5,
                endLine: 10,
                oldCode: 'const x = 1',
                newCode: 'const x: number = 1',
                reasoning: 'Added explicit type annotation',
              },
            ],
          },
        ],
        impactAnalysis: {
          directEffects: 'Adds type annotations to login function',
          dependencies: ['src/auth/index.ts'],
          systemWideImplications: 'Improves type safety, no runtime changes',
          uncertainties: ['May need to update tests'],
          recommendedFollowUps: ['Run full test suite'],
        },
        risks: ['Minimal risk - type annotations only'],
      };
      const result = ChangePlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('should reject title longer than 72 chars', () => {
      const plan = {
        title: 'x'.repeat(73),
        description: 'Test',
        changes: [],
        impactAnalysis: {
          directEffects: '',
          dependencies: [],
          systemWideImplications: '',
          uncertainties: [],
          recommendedFollowUps: [],
        },
        risks: [],
      };
      const result = ChangePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });
  });

  describe('FileChangeSchema', () => {
    it('should accept all valid actions', () => {
      for (const action of ['modify', 'create', 'delete']) {
        const change = {
          file: 'test.ts',
          action,
          hunks: [],
        };
        const result = FileChangeSchema.safeParse(change);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid action', () => {
      const change = {
        file: 'test.ts',
        action: 'rename',
        hunks: [],
      };
      const result = FileChangeSchema.safeParse(change);
      expect(result.success).toBe(false);
    });
  });

  describe('ImpactAnalysisSchema', () => {
    it('should validate valid impact analysis', () => {
      const impact = {
        directEffects: 'Modifies the login function',
        dependencies: ['auth.ts', 'user.ts'],
        systemWideImplications: 'No runtime changes',
        uncertainties: ['Untested with legacy auth'],
        recommendedFollowUps: ['Update docs', 'Add tests'],
      };
      const result = ImpactAnalysisSchema.safeParse(impact);
      expect(result.success).toBe(true);
    });

    it('should require all fields', () => {
      const partial = {
        directEffects: 'Test',
        dependencies: [],
      };
      const result = ImpactAnalysisSchema.safeParse(partial);
      expect(result.success).toBe(false);
    });
  });
});

