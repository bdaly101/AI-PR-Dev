import { GitHubClient } from '../github/client';
import { ReviewResponse } from '../validation/schemas';
import { PRContext } from '../github/prHelpers';
import { logger } from '../utils/logging';
import { CIConfig } from '../config/repoConfig';

/**
 * Check run name for AI reviews
 */
export const AI_REVIEW_CHECK_NAME = 'AI PR Reviewer';

/**
 * Severity to check conclusion mapping
 */
type CheckConclusion = 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'success' | 'skipped' | 'stale' | 'timed_out';

/**
 * Annotation level based on risk severity
 */
type AnnotationLevel = 'notice' | 'warning' | 'failure';

/**
 * Result of check run operations
 */
export interface CheckRunResult {
  checkRunId: number;
  conclusion: CheckConclusion;
  url: string;
}

/**
 * Service for managing GitHub Check Runs for AI reviews
 */
class ChecksService {
  /**
   * Create an in-progress check run when review starts
   */
  async createInProgressCheck(
    client: GitHubClient,
    owner: string,
    repo: string,
    headSha: string,
    pullNumber: number
  ): Promise<number> {
    const checksLogger = logger.child({ owner, repo, pullNumber, headSha });
    
    try {
      checksLogger.debug('Creating in-progress check run');
      
      const checkRun = await client.createCheckRun(
        owner,
        repo,
        AI_REVIEW_CHECK_NAME,
        headSha,
        {
          status: 'in_progress',
          output: {
            title: 'AI Review In Progress',
            summary: '🔍 Analyzing your code changes...',
          },
        }
      );

      checksLogger.info({ checkRunId: checkRun.id }, 'Created in-progress check run');
      return checkRun.id;
    } catch (error) {
      checksLogger.error({ error }, 'Failed to create in-progress check run');
      throw error;
    }
  }

  /**
   * Complete a check run with review results
   */
  async completeCheckWithReview(
    client: GitHubClient,
    owner: string,
    repo: string,
    checkRunId: number,
    review: ReviewResponse,
    context: PRContext,
    ciConfig: CIConfig
  ): Promise<CheckRunResult> {
    const checksLogger = logger.child({ owner, repo, checkRunId });
    
    try {
      // Determine conclusion based on review severity and config
      const conclusion = this.determineConclusion(review, ciConfig);
      
      // Build annotations from inline comments and risks
      const annotations = this.buildAnnotations(review, context);
      
      // Build the check output
      const output = this.buildCheckOutput(review, context, conclusion, ciConfig);

      checksLogger.debug({ conclusion, annotationCount: annotations.length }, 'Completing check run');

      const checkRun = await client.updateCheckRun(
        owner,
        repo,
        checkRunId,
        {
          status: 'completed',
          conclusion,
          output: {
            ...output,
            annotations: annotations.slice(0, 50), // GitHub limits to 50 annotations per update
          },
        }
      );

      checksLogger.info({ conclusion, checkRunId }, 'Completed check run');

      return {
        checkRunId: checkRun.id,
        conclusion,
        url: checkRun.html_url || '',
      };
    } catch (error) {
      checksLogger.error({ error }, 'Failed to complete check run');
      throw error;
    }
  }

  /**
   * Complete a check run with an error
   */
  async completeCheckWithError(
    client: GitHubClient,
    owner: string,
    repo: string,
    checkRunId: number,
    errorMessage: string
  ): Promise<void> {
    const checksLogger = logger.child({ owner, repo, checkRunId });
    
    try {
      await client.updateCheckRun(
        owner,
        repo,
        checkRunId,
        {
          status: 'completed',
          conclusion: 'failure',
          output: {
            title: 'AI Review Failed',
            summary: `❌ The AI review could not be completed.\n\n**Error:** ${errorMessage}`,
            text: 'Please check the configuration and try again by commenting `/ai-review`.',
          },
        }
      );

      checksLogger.warn({ errorMessage }, 'Completed check run with error');
    } catch (error) {
      checksLogger.error({ error }, 'Failed to complete check run with error');
    }
  }

  /**
   * Complete a check run when PR is skipped (too large, no reviewable files, etc.)
   */
  async completeCheckSkipped(
    client: GitHubClient,
    owner: string,
    repo: string,
    checkRunId: number,
    reason: string
  ): Promise<void> {
    const checksLogger = logger.child({ owner, repo, checkRunId });
    
    try {
      await client.updateCheckRun(
        owner,
        repo,
        checkRunId,
        {
          status: 'completed',
          conclusion: 'skipped',
          output: {
            title: 'AI Review Skipped',
            summary: `⏭️ ${reason}`,
          },
        }
      );

      checksLogger.info({ reason }, 'Completed check run as skipped');
    } catch (error) {
      checksLogger.error({ error }, 'Failed to complete check run as skipped');
    }
  }

  /**
   * Determine the check conclusion based on review severity and CI config
   */
  private determineConclusion(review: ReviewResponse, ciConfig: CIConfig): CheckConclusion {
    // If blocking is disabled, always return success or neutral
    if (!ciConfig.blockOnCritical) {
      return review.severity === 'critical' ? 'neutral' : 'success';
    }

    // Map review severity to conclusion
    switch (review.severity) {
      case 'critical': {
        // Check if there are any high-severity risks
        const hasHighRisks = review.risks.some(r => r.severity === 'high');
        if (hasHighRisks) {
          return ciConfig.blockOnCritical ? 'failure' : 'neutral';
        }
        return 'neutral';
      }

      case 'warning':
        // Warnings don't block but show as neutral
        return 'neutral';

      case 'info':
      default:
        return 'success';
    }
  }

  /**
   * Build annotations from review inline comments and risks
   */
  private buildAnnotations(
    review: ReviewResponse,
    context: PRContext
  ): Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: AnnotationLevel;
    message: string;
    title?: string;
  }> {
    const annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: AnnotationLevel;
      message: string;
      title?: string;
    }> = [];

    // Get set of reviewed files
    const reviewedFiles = new Set(
      context.files.filter(f => !f.skipped).map(f => f.filename)
    );

    // Add inline comments as annotations
    for (const comment of review.inlineComments) {
      if (!reviewedFiles.has(comment.path)) continue;
      
      annotations.push({
        path: comment.path,
        start_line: comment.line,
        end_line: comment.line,
        annotation_level: 'warning',
        message: comment.body,
        title: 'AI Suggestion',
      });
    }

    return annotations;
  }

  /**
   * Build the check output with review details
   */
  private buildCheckOutput(
    review: ReviewResponse,
    context: PRContext,
    conclusion: CheckConclusion,
    ciConfig: CIConfig
  ): { title: string; summary: string; text: string } {
    const severityEmoji = {
      info: '✅',
      warning: '⚠️',
      critical: '🔴',
    };

    const conclusionText = {
      success: 'Passed',
      neutral: 'Passed with notes',
      failure: 'Action required',
      skipped: 'Skipped',
      action_required: 'Action required',
      cancelled: 'Cancelled',
      stale: 'Stale',
      timed_out: 'Timed out',
    };

    // Build title
    const title = `${severityEmoji[review.severity]} AI Review: ${conclusionText[conclusion]}`;

    // Build summary
    let summary = `### Summary\n${review.summary}\n\n`;
    summary += `**Overall:** ${review.severity.toUpperCase()} | `;
    summary += `**Files:** ${context.reviewedFiles}/${context.totalFiles} | `;
    summary += `**Changes:** +${context.totalAdditions}/-${context.totalDeletions}\n\n`;

    // Add risks summary if any
    if (review.risks.length > 0) {
      const highRisks = review.risks.filter(r => r.severity === 'high').length;
      const mediumRisks = review.risks.filter(r => r.severity === 'medium').length;
      const lowRisks = review.risks.filter(r => r.severity === 'low').length;
      
      summary += `**Risks:** 🔴 ${highRisks} high | 🟡 ${mediumRisks} medium | 🟢 ${lowRisks} low\n\n`;
    }

    // Add blocking notice if applicable
    if (conclusion === 'failure' && ciConfig.blockOnCritical) {
      summary += `> ⛔ **Merge blocked:** Critical issues found. Please address high-severity risks before merging.\n\n`;
    }

    // Build detailed text
    let text = '';

    // Strengths
    if (review.strengths.length > 0) {
      text += `## ✅ Strengths\n\n`;
      review.strengths.forEach(s => text += `- ${s}\n`);
      text += '\n';
    }

    // Risks
    if (review.risks.length > 0) {
      text += `## ⚠️ Risks & Issues\n\n`;
      const riskEmoji: Record<string, string> = {
        bug: '🐛',
        security: '🔒',
        performance: '⚡',
        style: '🎨',
        maintainability: '🔧',
      };
      
      review.risks.forEach(risk => {
        const emoji = riskEmoji[risk.category] || '📌';
        const severityBadge = risk.severity === 'high' ? '🔴' :
                             risk.severity === 'medium' ? '🟡' : '🟢';
        text += `- ${emoji} **[${risk.category.toUpperCase()}]** ${severityBadge} ${risk.description}\n`;
      });
      text += '\n';
    }

    // Suggestions
    if (review.suggestions.length > 0) {
      text += `## 💡 Suggestions\n\n`;
      review.suggestions.forEach(s => text += `- ${s}\n`);
      text += '\n';
    }

    // Inline comments count
    if (review.inlineComments.length > 0) {
      text += `---\n📝 ${review.inlineComments.length} inline comment(s) added to the PR.\n`;
    }

    return { title, summary, text };
  }

  /**
   * Check if a check run already exists for a commit
   */
  async findExistingCheckRun(
    client: GitHubClient,
    owner: string,
    repo: string,
    headSha: string
  ): Promise<number | null> {
    try {
      const { check_runs } = await client.listCheckRuns(
        owner,
        repo,
        headSha,
        { checkName: AI_REVIEW_CHECK_NAME, filter: 'latest' }
      );

      if (check_runs.length > 0) {
        return check_runs[0].id;
      }
      return null;
    } catch (error) {
      logger.error({ error, owner, repo, headSha }, 'Failed to find existing check run');
      return null;
    }
  }
}

export const checksService = new ChecksService();

