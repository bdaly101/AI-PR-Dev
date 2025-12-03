import { ESLint } from 'eslint';
import { logger } from '../utils/logging';
import {
  LintResults,
  FileLintResult,
  LintIssue,
  LintSeverity,
  LintConfig,
  DEFAULT_LINT_CONFIG,
} from './types';

/**
 * ESLint runner for analyzing code
 */
export class ESLintRunner {
  private config: LintConfig;

  constructor(config: Partial<LintConfig> = {}) {
    this.config = { ...DEFAULT_LINT_CONFIG, ...config };
  }

  /**
   * Lint multiple files given their paths and contents
   */
  async lintFiles(
    files: Array<{ path: string; content: string }>
  ): Promise<LintResults> {
    const results: FileLintResult[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalFixable = 0;

    // Filter files by extension
    const filteredFiles = files.filter((file) => {
      const ext = file.path.substring(file.path.lastIndexOf('.'));
      return this.config.extensions.includes(ext);
    });

    // Limit number of files
    const filesToLint = filteredFiles.slice(0, this.config.maxFiles);

    if (filesToLint.length === 0) {
      logger.debug('No lintable files found');
      return { files: [], totalErrors: 0, totalWarnings: 0, totalFixable: 0 };
    }

    try {
      // Create ESLint instance - use project's existing config or basic defaults
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eslintOptions: any = {
        useEslintrc: true, // Use the project's eslint config if available
        overrideConfig: {
          rules: {
            // Common fixable rules to check
            'semi': 'error',
            'quotes': ['error', 'single'],
            'no-unused-vars': 'warn',
            'prefer-const': 'error',
            'no-var': 'error',
          },
        },
      };

      const eslint = new ESLint(eslintOptions);

      for (const file of filesToLint) {
        try {
          const lintResults = await eslint.lintText(file.content, {
            filePath: file.path,
          });

          const result = lintResults[0];
          if (result) {
            const fileResult = this.convertToFileLintResult(file.path, result, file.content);
            results.push(fileResult);
            totalErrors += fileResult.errorCount;
            totalWarnings += fileResult.warningCount;
            totalFixable += fileResult.fixableErrorCount + fileResult.fixableWarningCount;
          }
        } catch (fileError) {
          logger.warn({ file: file.path, error: fileError }, 'Failed to lint file');
          // Add empty result for this file
          results.push({
            filePath: file.path,
            issues: [],
            errorCount: 0,
            warningCount: 0,
            fixableErrorCount: 0,
            fixableWarningCount: 0,
            source: file.content,
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'ESLint initialization failed');
      // Return empty results on error
      return { files: [], totalErrors: 0, totalWarnings: 0, totalFixable: 0 };
    }

    logger.info({
      filesLinted: results.length,
      totalErrors,
      totalWarnings,
      totalFixable,
    }, 'Lint analysis complete');

    return { files: results, totalErrors, totalWarnings, totalFixable };
  }

  /**
   * Lint a single file
   */
  async lintFile(filePath: string, content: string): Promise<FileLintResult> {
    const results = await this.lintFiles([{ path: filePath, content }]);
    return results.files[0] || {
      filePath,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      source: content,
    };
  }

  /**
   * Convert ESLint result to our FileLintResult format
   */
  private convertToFileLintResult(
    filePath: string,
    eslintResult: ESLint.LintResult,
    source: string
  ): FileLintResult {
    const issues: LintIssue[] = eslintResult.messages.map((msg) => ({
      ruleId: msg.ruleId || 'unknown',
      severity: this.convertSeverity(msg.severity),
      message: msg.message,
      line: msg.line,
      column: msg.column,
      endLine: msg.endLine,
      endColumn: msg.endColumn,
      fix: msg.fix ? {
        range: msg.fix.range,
        text: msg.fix.text,
      } : undefined,
    }));

    return {
      filePath,
      issues,
      errorCount: eslintResult.errorCount,
      warningCount: eslintResult.warningCount,
      fixableErrorCount: eslintResult.fixableErrorCount,
      fixableWarningCount: eslintResult.fixableWarningCount,
      source,
    };
  }

  /**
   * Convert ESLint severity number to our severity type
   */
  private convertSeverity(severity: number): LintSeverity {
    switch (severity) {
      case 2:
        return 'error';
      case 1:
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Format lint results as a human-readable string
   */
  formatResults(results: LintResults): string {
    if (results.files.length === 0 || (results.totalErrors === 0 && results.totalWarnings === 0)) {
      return '✅ No lint issues found!';
    }

    let output = `## 🔍 Lint Analysis Results\n\n`;
    output += `**Summary:** ${results.totalErrors} errors, ${results.totalWarnings} warnings`;
    if (results.totalFixable > 0) {
      output += ` (${results.totalFixable} auto-fixable)`;
    }
    output += '\n\n';

    for (const file of results.files) {
      if (file.issues.length === 0) {
        continue;
      }

      output += `### \`${file.filePath}\`\n\n`;

      for (const issue of file.issues) {
        const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        const fixable = issue.fix ? ' (fixable)' : '';
        output += `- ${icon} **Line ${issue.line}:** ${issue.message} [\`${issue.ruleId}\`]${fixable}\n`;
      }

      output += '\n';
    }

    return output;
  }
}

/**
 * Singleton instance
 */
export const eslintRunner = new ESLintRunner();

