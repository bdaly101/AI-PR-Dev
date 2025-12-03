import { z } from 'zod';

/**
 * Risk categories for code review issues
 */
export const RiskCategorySchema = z.enum([
  'bug',
  'security',
  'performance',
  'style',
  'maintainability',
]);

/**
 * Severity levels for issues
 */
export const SeveritySchema = z.enum(['low', 'medium', 'high']);

/**
 * Overall PR severity level
 */
export const OverallSeveritySchema = z.enum(['info', 'warning', 'critical']);

/**
 * Individual risk/issue in a code review
 */
export const RiskSchema = z.object({
  category: RiskCategorySchema,
  description: z.string().min(1).max(500),
  severity: SeveritySchema,
});

/**
 * Inline comment for a specific file and line
 */
export const InlineCommentSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive(),
  body: z.string().min(1).max(1000),
});

/**
 * Complete AI review response schema
 * Matches the design doc specification
 * Made lenient to handle AI response variations
 */
export const ReviewResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  severity: OverallSeveritySchema,
  strengths: z.array(z.string().max(500)).max(20).default([]),
  risks: z.array(RiskSchema).max(30).default([]),
  suggestions: z.array(z.string().max(1000)).max(20).default([]),
  inlineComments: z.array(InlineCommentSchema).max(50).default([]),
});

/**
 * Legacy review response format (for backwards compatibility)
 * Used during transition period
 */
export const LegacyReviewResponseSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskJustification: z.string(),
  inlineComments: z.array(z.object({
    file: z.string(),
    line: z.number(),
    comment: z.string(),
  })),
  generalComments: z.array(z.string()),
});

/**
 * File review comment schema
 */
export const FileReviewCommentSchema = z.object({
  line: z.number().int().positive(),
  comment: z.string().min(1),
});

/**
 * Dev Agent change plan schema (for M6+)
 */
export const ChangeHunkSchema = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  oldCode: z.string(),
  newCode: z.string(),
  reasoning: z.string().optional(),
});

export const FileChangeSchema = z.object({
  file: z.string().min(1),
  action: z.enum(['modify', 'create', 'delete']),
  hunks: z.array(ChangeHunkSchema),
});

export const ImpactAnalysisSchema = z.object({
  directEffects: z.string(),
  dependencies: z.array(z.string()),
  systemWideImplications: z.string(),
  uncertainties: z.array(z.string()),
  recommendedFollowUps: z.array(z.string()),
});

export const ChangePlanSchema = z.object({
  title: z.string().min(1).max(72),
  description: z.string(),
  changes: z.array(FileChangeSchema),
  impactAnalysis: ImpactAnalysisSchema,
  risks: z.array(z.string()),
});

// Type exports
export type RiskCategory = z.infer<typeof RiskCategorySchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type OverallSeverity = z.infer<typeof OverallSeveritySchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type InlineComment = z.infer<typeof InlineCommentSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
export type LegacyReviewResponse = z.infer<typeof LegacyReviewResponseSchema>;
export type FileReviewComment = z.infer<typeof FileReviewCommentSchema>;
export type ChangeHunk = z.infer<typeof ChangeHunkSchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;
export type ImpactAnalysis = z.infer<typeof ImpactAnalysisSchema>;
export type ChangePlan = z.infer<typeof ChangePlanSchema>;

/**
 * Parse and validate a review response, with helpful error messages
 */
export function parseReviewResponse(data: unknown): ReviewResponse {
  const result = ReviewResponseSchema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Invalid review response: ${errors.join('; ')}`);
  }
  
  return result.data;
}

/**
 * Parse legacy response format and convert to new format
 */
export function parseLegacyResponse(data: unknown): ReviewResponse {
  const result = LegacyReviewResponseSchema.safeParse(data);
  
  if (!result.success) {
    throw new Error('Invalid legacy review response');
  }
  
  const legacy = result.data;
  
  // Convert legacy format to new format
  return {
    summary: legacy.summary,
    severity: legacy.riskLevel === 'high' ? 'critical' : 
              legacy.riskLevel === 'medium' ? 'warning' : 'info',
    strengths: [],
    risks: [{
      category: 'maintainability',
      description: legacy.riskJustification,
      severity: legacy.riskLevel,
    }],
    suggestions: legacy.generalComments,
    inlineComments: legacy.inlineComments.map(c => ({
      path: c.file,
      line: c.line,
      body: c.comment,
    })),
  };
}

/**
 * Attempt to parse response, trying new format first, then legacy
 */
export function parseAnyReviewResponse(data: unknown): ReviewResponse {
  // Try new format first
  const newResult = ReviewResponseSchema.safeParse(data);
  if (newResult.success) {
    return newResult.data;
  }
  
  // Try legacy format
  const legacyResult = LegacyReviewResponseSchema.safeParse(data);
  if (legacyResult.success) {
    return parseLegacyResponse(data);
  }
  
  // Neither worked - throw with new format errors (more likely what we want)
  const errors = newResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  throw new Error(`Invalid review response: ${errors.join('; ')}`);
}

