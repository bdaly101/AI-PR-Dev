import { GitHubClient } from '../github/client';
import { aiReviewer } from '../ai/reviewer';
import { fetchPRContext, isPRTooLarge, generateLargePRSummary } from '../github/prHelpers';
import { reviewRepo } from '../database/repositories/reviewRepo';
import { auditRepo } from '../database/repositories/auditRepo';
import { logger, logPRReview, logError } from '../utils/logging';
import { DEFAULT_IGNORE_PATTERNS } from '../config/constants';
import { ReviewResponse } from '../validation/schemas';

class ReviewService {
  async reviewPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number
  ) {
    const prLogger = logPRReview(logger, owner, repo, pullNumber);
    const startTime = Date.now();
    
    try {
      const client = new GitHubClient(installationId);

      // Fetch complete PR context with caching and truncation
      prLogger.info('Fetching PR context');
      const context = await fetchPRContext(client, owner, repo, pullNumber, {
        useCache: true,
        ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      });

      // Check if this commit has already been reviewed
      if (reviewRepo.hasBeenReviewed(owner, repo, context.commitSha)) {
        prLogger.info({ commitSha: context.commitSha }, 'Commit already reviewed, skipping');
        return;
      }

      // Handle PRs that are too large
      if (isPRTooLarge(context)) {
        prLogger.warn({ totalFiles: context.totalFiles }, 'PR too large for detailed review');
        
        const summary = generateLargePRSummary(context);
        await client.createIssueComment(owner, repo, pullNumber, summary);
        
        // Record that we handled this PR
        reviewRepo.recordReview({
          owner,
          repo,
          pull_number: pullNumber,
          commit_sha: context.commitSha,
          reviewed_at: new Date().toISOString(),
          model_used: 'skipped-too-large',
          review_summary: 'PR too large for detailed review',
        });
        
        return;
      }

      // Check if there's anything to review
      if (context.reviewedFiles === 0) {
        prLogger.info('No reviewable files in PR');
        await client.createIssueComment(
          owner,
          repo,
          pullNumber,
          '✅ No reviewable code changes detected in this PR (files may be binary, ignored, or empty).'
        );
        return;
      }

      prLogger.info({
        reviewedFiles: context.reviewedFiles,
        fromCache: context.fromCache,
      }, 'Starting AI review');

      // Get AI review using new context-aware method
      const reviewResult = await aiReviewer.reviewPullRequestContext(context, {
        useFallback: true,
      });

      const review = reviewResult.review;

      // Format the review body
      const reviewBody = this.formatReviewBody(review, context, reviewResult);

      // Prepare inline comments - only for files that were actually reviewed
      const reviewedFilenames = new Set(
        context.files.filter(f => !f.skipped).map(f => f.filename)
      );
      
      const inlineComments = review.inlineComments
        .filter((comment) => reviewedFilenames.has(comment.path))
        .map((comment) => ({
          path: comment.path,
          line: comment.line,
          body: `💡 **AI Suggestion:**\n\n${comment.body}`,
        }));

      // Post review with inline comments
      await client.createReview(
        owner,
        repo,
        pullNumber,
        reviewBody,
        'COMMENT',
        inlineComments
      );

      // Add ai-reviewed label
      try {
        await client.addLabels(owner, repo, pullNumber, ['ai-reviewed']);
        prLogger.debug('Added ai-reviewed label');
      } catch (labelError) {
        // Don't fail the review if labeling fails
        prLogger.warn({ error: labelError }, 'Failed to add ai-reviewed label');
      }

      const duration = Date.now() - startTime;
      prLogger.info({
        duration,
        inlineComments: inlineComments.length,
        provider: reviewResult.provider,
        model: reviewResult.model,
      }, 'Review posted successfully');

      // Record the review
      reviewRepo.recordReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_sha: context.commitSha,
        reviewed_at: new Date().toISOString(),
        model_used: reviewResult.model,
        review_summary: review.summary,
      });

      // Audit log
      auditRepo.log({
        timestamp: new Date().toISOString(),
        action: 'pr_reviewed',
        owner,
        repo,
        pull_number: pullNumber,
        files_changed: context.files.map(f => f.filename).join(','),
        lines_added: context.totalAdditions,
        lines_deleted: context.totalDeletions,
        ai_model: reviewResult.model,
        success: 1,
      });

    } catch (error) {
      logError(prLogger, error, { action: 'review_pull_request' });
      
      // Audit log the failure
      auditRepo.log({
        timestamp: new Date().toISOString(),
        action: 'pr_review_failed',
        owner,
        repo,
        pull_number: pullNumber,
        ai_model: 'unknown',
        success: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Try to post an error comment
      try {
        const client = new GitHubClient(installationId);
        await client.createIssueComment(
          owner,
          repo,
          pullNumber,
          '❌ Failed to generate AI review. Please check the logs for details.\n\n' +
          '*You can retry by commenting `/ai-review`*'
        );
      } catch (commentError) {
        logError(prLogger, commentError, { action: 'post_error_comment' });
      }
    }
  }

  /**
   * Format the review body with the new enhanced format
   */
  private formatReviewBody(
    review: ReviewResponse,
    context: import('../github/prHelpers').PRContext,
    result: { provider: string; model: string }
  ): string {
    const severityEmoji = {
      info: '🟢',
      warning: '🟡',
      critical: '🔴',
    };

    const riskCategoryEmoji: Record<string, string> = {
      bug: '🐛',
      security: '🔒',
      performance: '⚡',
      style: '🎨',
      maintainability: '🔧',
    };

    let body = `## 🤖 AI Code Review\n\n`;
    body += `**Summary:** ${review.summary}\n\n`;
    body += `**Overall Assessment:** ${severityEmoji[review.severity]} ${review.severity.toUpperCase()}\n\n`;

    // Strengths section
    if (review.strengths.length > 0) {
      body += `### ✅ Strengths\n\n`;
      review.strengths.forEach((strength) => {
        body += `- ${strength}\n`;
      });
      body += `\n`;
    }

    // Risks section
    if (review.risks.length > 0) {
      body += `### ⚠️ Risks & Issues\n\n`;
      
      // Sort by severity
      const sortedRisks = [...review.risks].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.severity] - order[b.severity];
      });

      sortedRisks.forEach((risk) => {
        const emoji = riskCategoryEmoji[risk.category] || '📌';
        const severityBadge = risk.severity === 'high' ? '🔴' :
                             risk.severity === 'medium' ? '🟡' : '🟢';
        body += `- ${emoji} **[${risk.category.toUpperCase()}]** ${severityBadge} ${risk.description}\n`;
      });
      body += `\n`;
    }

    // Suggestions section
    if (review.suggestions.length > 0) {
      body += `### 💡 Suggestions\n\n`;
      review.suggestions.forEach((suggestion) => {
        body += `- ${suggestion}\n`;
      });
      body += `\n`;
    }

    // Context warnings if any
    if (context.warnings.length > 0) {
      body += `### 📋 Review Notes\n\n`;
      context.warnings.forEach((warning) => {
        body += `- ${warning}\n`;
      });
      body += `\n`;
    }

    // Review stats
    body += `### 📊 Stats\n\n`;
    body += `| Metric | Value |\n`;
    body += `|--------|-------|\n`;
    body += `| Files Reviewed | ${context.reviewedFiles}/${context.totalFiles} |\n`;
    body += `| Lines Changed | +${context.totalAdditions}/-${context.totalDeletions} |\n`;
    if (context.skippedFiles > 0) {
      body += `| Files Skipped | ${context.skippedFiles} |\n`;
    }
    if (review.inlineComments.length > 0) {
      body += `| Inline Comments | ${review.inlineComments.length} |\n`;
    }
    body += `\n`;

    // Footer
    body += `---\n`;
    body += `*Generated by AI (${result.model}) • Review suggestions carefully before applying*\n`;
    body += `*Commands: \`/ai-review\` to regenerate • \`/ai-fix-lints\` to auto-fix lint issues*`;

    return body;
  }
}

export const reviewService = new ReviewService();
