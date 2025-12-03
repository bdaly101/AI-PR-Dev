/**
 * Lint issue severity levels
 */
export type LintSeverity = 'error' | 'warning' | 'info';

/**
 * A single lint issue found in a file
 */
export interface LintIssue {
  ruleId: string;
  severity: LintSeverity;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

/**
 * Lint results for a single file
 */
export interface FileLintResult {
  filePath: string;
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  source?: string; // Original file content
}

/**
 * Aggregate lint results for multiple files
 */
export interface LintResults {
  files: FileLintResult[];
  totalErrors: number;
  totalWarnings: number;
  totalFixable: number;
}

/**
 * Configuration for running linter
 */
export interface LintConfig {
  /** File extensions to lint */
  extensions: string[];
  /** Paths to ignore */
  ignorePaths: string[];
  /** Maximum files to lint */
  maxFiles: number;
  /** Whether to include fixable issues only */
  fixableOnly: boolean;
}

/**
 * Default lint configuration
 */
export const DEFAULT_LINT_CONFIG: LintConfig = {
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  ignorePaths: ['node_modules', 'dist', 'build', '.git'],
  maxFiles: 50,
  fixableOnly: false,
};

