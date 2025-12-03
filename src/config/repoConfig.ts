import { z } from 'zod';
import YAML from 'yaml';
import { GitHubClient } from '../github/client';
import { logger } from '../utils/logging';
import { PR_LIMITS, AI_DEFAULTS, DEFAULT_IGNORE_PATTERNS } from './constants';

/**
 * Strictness levels for code review
 */
export const StrictnessSchema = z.enum(['relaxed', 'normal', 'strict']);
export type Strictness = z.infer<typeof StrictnessSchema>;

/**
 * Minimum severity to report
 */
export const MinSeveritySchema = z.enum(['low', 'medium', 'high']);
export type MinSeverity = z.infer<typeof MinSeveritySchema>;

/**
 * AI provider options
 */
export const AIProviderSchema = z.enum(['openai', 'anthropic']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

/**
 * Mode of operation
 */
export const ModeSchema = z.enum(['reviewer', 'dev_agent', 'both']);
export type Mode = z.infer<typeof ModeSchema>;

/**
 * Reviewer-specific configuration
 */
export const ReviewerConfigSchema = z.object({
  strictness: StrictnessSchema.default('normal'),
  languages: z.array(z.string()).default([]),
  ignorePaths: z.array(z.string()).default([]),
  minSeverity: MinSeveritySchema.default('low'),
  maxFilesReviewed: z.number().int().min(1).max(100).default(PR_LIMITS.MAX_FILES_PER_REVIEW),
});
export type ReviewerConfig = z.infer<typeof ReviewerConfigSchema>;

/**
 * AI-specific configuration
 */
export const AIConfigSchema = z.object({
  provider: AIProviderSchema.default('openai'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(AI_DEFAULTS.REVIEW_TEMPERATURE),
});
export type AIConfig = z.infer<typeof AIConfigSchema>;

/**
 * Dev Agent-specific configuration (for future use)
 */
export const DevAgentConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowedCommands: z.array(z.string()).default(['fix-lints', 'add-types', 'improve-docs']),
  maxFilesPerPR: z.number().int().min(1).max(20).default(10),
  maxLinesChanged: z.number().int().min(1).max(500).default(200),
  requireApproval: z.boolean().default(true),
});
export type DevAgentConfig = z.infer<typeof DevAgentConfigSchema>;

/**
 * CI Integration configuration
 */
export const CIConfigSchema = z.object({
  enabled: z.boolean().default(true),
  postCheckRun: z.boolean().default(true),
  blockOnCritical: z.boolean().default(false),
  requiredForMerge: z.boolean().default(false),
});
export type CIConfig = z.infer<typeof CIConfigSchema>;

/**
 * Complete repository configuration schema
 */
export const RepoConfigSchema = z.object({
  version: z.number().int().min(1).max(1).default(1),
  enabled: z.boolean().default(true),
  mode: ModeSchema.default('reviewer'),
  reviewer: ReviewerConfigSchema.default({}),
  ai: AIConfigSchema.default({}),
  devAgent: DevAgentConfigSchema.default({}),
  ci: CIConfigSchema.default({}),
});
export type RepoConfig = z.infer<typeof RepoConfigSchema>;

/**
 * Default configuration when no .ai-pr-reviewer.yml exists
 */
export const DEFAULT_CONFIG: RepoConfig = {
  version: 1,
  enabled: true,
  mode: 'reviewer',
  reviewer: {
    strictness: 'normal',
    languages: [],
    ignorePaths: [...DEFAULT_IGNORE_PATTERNS],
    minSeverity: 'low',
    maxFilesReviewed: PR_LIMITS.MAX_FILES_PER_REVIEW,
  },
  ai: {
    provider: 'openai',
    model: undefined,
    temperature: AI_DEFAULTS.REVIEW_TEMPERATURE,
  },
  devAgent: {
    enabled: false,
    allowedCommands: ['fix-lints', 'add-types', 'improve-docs'],
    maxFilesPerPR: 10,
    maxLinesChanged: 200,
    requireApproval: true,
  },
  ci: {
    enabled: true,
    postCheckRun: true,
    blockOnCritical: false,
    requiredForMerge: false,
  },
};

/**
 * Configuration file name
 */
export const CONFIG_FILE_NAME = '.ai-pr-reviewer.yml';

/**
 * Parse and validate a repository configuration from YAML content
 */
export function parseRepoConfig(yamlContent: string): RepoConfig {
  try {
    const parsed = YAML.parse(yamlContent);
    
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_CONFIG;
    }

    const result = RepoConfigSchema.safeParse(parsed);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      logger.warn({ errors }, 'Invalid repo config, using defaults');
      return DEFAULT_CONFIG;
    }

    // Merge with defaults to ensure all fields are present
    return mergeWithDefaults(result.data);
  } catch (error) {
    logger.warn({ error }, 'Failed to parse repo config YAML, using defaults');
    return DEFAULT_CONFIG;
  }
}

/**
 * Merge parsed config with defaults
 */
function mergeWithDefaults(config: Partial<RepoConfig>): RepoConfig {
  return {
    version: config.version ?? DEFAULT_CONFIG.version,
    enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
    mode: config.mode ?? DEFAULT_CONFIG.mode,
    reviewer: {
      ...DEFAULT_CONFIG.reviewer,
      ...config.reviewer,
      // Merge ignore paths with defaults
      ignorePaths: [
        ...DEFAULT_CONFIG.reviewer.ignorePaths,
        ...(config.reviewer?.ignorePaths ?? []),
      ],
    },
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...config.ai,
    },
    devAgent: {
      ...DEFAULT_CONFIG.devAgent,
      ...config.devAgent,
    },
    ci: {
      ...DEFAULT_CONFIG.ci,
      ...config.ci,
    },
  };
}

/**
 * Load repository configuration from GitHub
 */
export async function loadRepoConfig(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref?: string
): Promise<RepoConfig> {
  const configLogger = logger.child({ owner, repo, configFile: CONFIG_FILE_NAME });
  
  try {
    configLogger.debug('Loading repo config');
    
    const content = await client.getFileContent(
      owner,
      repo,
      CONFIG_FILE_NAME,
      ref || 'HEAD'
    );
    
    if (!content) {
      configLogger.debug('No config file found, using defaults');
      return DEFAULT_CONFIG;
    }
    
    const config = parseRepoConfig(content);
    configLogger.info({ 
      enabled: config.enabled,
      mode: config.mode,
      strictness: config.reviewer.strictness,
      provider: config.ai.provider,
    }, 'Loaded repo config');
    
    return config;
  } catch (error) {
    configLogger.warn({ error }, 'Failed to load repo config, using defaults');
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the effective ignore patterns combining defaults and config
 */
export function getEffectiveIgnorePatterns(config: RepoConfig): string[] {
  return [...new Set([...DEFAULT_IGNORE_PATTERNS, ...config.reviewer.ignorePaths])];
}

/**
 * Check if a file should be reviewed based on config
 */
export function shouldReviewFile(filename: string, config: RepoConfig): boolean {
  const ignorePatterns = getEffectiveIgnorePatterns(config);
  
  for (const pattern of ignorePatterns) {
    if (matchesGlobPattern(filename, pattern)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Simple glob pattern matching
 */
function matchesGlobPattern(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$|/${regexPattern}$|^${regexPattern}/|/${regexPattern}/`);
  return regex.test(filename);
}

/**
 * Get strictness-specific prompt adjustments
 */
export function getStrictnessGuidelines(strictness: Strictness): string {
  switch (strictness) {
    case 'relaxed':
      return `
Review Focus: Be lenient and focus only on significant issues.
- Only flag bugs that would cause runtime errors or security vulnerabilities
- Ignore minor style inconsistencies
- Focus on functionality over formatting
- Provide fewer suggestions, prioritize the most impactful ones
- Be encouraging and positive in feedback`;

    case 'strict':
      return `
Review Focus: Be thorough and comprehensive.
- Flag all potential issues including minor ones
- Enforce consistent code style and formatting
- Check for edge cases and error handling
- Suggest performance optimizations
- Review documentation and comments
- Apply best practices rigorously`;

    case 'normal':
    default:
      return `
Review Focus: Balanced review with emphasis on quality.
- Flag bugs, security issues, and significant problems
- Note important style inconsistencies
- Suggest improvements where they add clear value
- Balance thoroughness with practicality
- Acknowledge good practices`;
  }
}

/**
 * Filter risks based on minimum severity
 */
export function filterByMinSeverity<T extends { severity: 'low' | 'medium' | 'high' }>(
  items: T[],
  minSeverity: MinSeverity
): T[] {
  const severityOrder = { low: 0, medium: 1, high: 2 };
  const minOrder = severityOrder[minSeverity];
  
  return items.filter(item => severityOrder[item.severity] >= minOrder);
}

