/**
 * Application constants for PR review limits and safety guardrails
 */

// PR Context Limits
export const PR_LIMITS = {
  /** Maximum number of files to review in a single PR */
  MAX_FILES_PER_REVIEW: 50,
  
  /** Maximum lines of diff per individual file before truncation */
  MAX_DIFF_LINES_PER_FILE: 500,
  
  /** Maximum total lines of diff across all files */
  MAX_TOTAL_DIFF_LINES: 5000,
  
  /** Maximum characters per file diff (for token management) */
  MAX_DIFF_CHARS_PER_FILE: 15000,
  
  /** Files larger than this are skipped entirely */
  MAX_FILE_SIZE_BYTES: 100000,
  
  /** PR context cache TTL in seconds (24 hours) */
  PR_CONTEXT_CACHE_TTL: 86400,
};

// Dev Agent Safety Limits (for future M6+)
export const SAFETY_LIMITS = {
  /** Maximum files that can be modified in a single AI PR */
  MAX_FILES_PER_PR: 10,
  
  /** Maximum lines changed in a single AI PR */
  MAX_LINES_CHANGED: 200,
  
  /** Maximum commits per AI PR */
  MAX_COMMITS_PER_PR: 1,
  
  /** Branches the AI is allowed to target */
  ALLOWED_BASE_BRANCHES: ['dev', 'develop', 'staging'],
  
  /** Paths the AI is never allowed to modify */
  FORBIDDEN_PATHS: [
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    '.github/workflows/*',
    'terraform/*',
    '**/migrations/*',
    'package.json',
    'package-lock.json',
    'requirements.txt',
    'poetry.lock',
    '.env',
    '.env.*',
  ],
};

// AI Model Defaults
export const AI_DEFAULTS = {
  /** Default AI provider */
  PROVIDER: 'openai' as const,
  
  /** Default model for reviews */
  REVIEW_MODEL: 'gpt-4-turbo-preview',
  
  /** Default temperature for reviews (lower = more consistent) */
  REVIEW_TEMPERATURE: 0.3,
  
  /** Default temperature for code generation (very low for determinism) */
  CODE_GEN_TEMPERATURE: 0.1,
  
  /** Maximum tokens for review response */
  MAX_REVIEW_TOKENS: 2000,
};

// File patterns to always ignore in reviews
export const DEFAULT_IGNORE_PATTERNS = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '*.min.js',
  '*.min.css',
  '*.map',
  'dist/*',
  'build/*',
  'node_modules/*',
  '.next/*',
  'coverage/*',
  '*.generated.*',
];

