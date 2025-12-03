import { GitHubClient } from '../github/client';
import { reviewRepo } from '../database/repositories/reviewRepo';
import { prContextRepo } from '../database/repositories/prContextRepo';
import { AI_REVIEW_CHECK_NAME } from './checksService';
import { loadRepoConfig } from '../config/repoConfig';
import { fetchPRContext } from '../github/prHelpers';
import { DEFAULT_IGNORE_PATTERNS } from '../config/constants';
import { logger } from '../utils/logging';
import { MergeRecommendation, RecommendationResponse } from '../api/types';

class RecommendationService {
  /**
   * Get merge recommendation based on review and CI status
   */
  async getRecommendation(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number
  ): Promise<RecommendationResponse> {
    const recLogger = logger.child({ owner, repo, pullNumber, component: 'recommendation' });

    try {
      const client = new GitHubClient(installationId);

      // Get review status
      const review = reviewRepo.getLatestReview(owner, repo, pullNumber);
      if (!review) {
        return {
          recommendation: 'ITERATE',
          confidence: 0.5,
          reasons: ['No review found. Review is required before merge.'],
          highRiskCount: 0,
          mediumRiskCount: 0,
          lowRiskCount: 0,
        };
      }

      // Get PR context and cached review data
      const context = await fetchPRContext(client, owner, repo, pullNumber, {
        useCache: true,
        ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      });

      // Extract review details from cache
      let reviewSeverity: 'info' | 'warning' | 'critical' | undefined;
      let highRiskCount = 0;
      let mediumRiskCount = 0;
      let lowRiskCount = 0;

      const cachedData = prContextRepo.getCachedContext(owner, repo, pullNumber, context.commitSha);
      if (cachedData?.context_data) {
        try {
          const data = JSON.parse(cachedData.context_data);
          if (data.review) {
            reviewSeverity = data.review.severity;
            const risks = data.review.risks || [];
            highRiskCount = risks.filter((r: { severity: string }) => r.severity === 'high').length;
            mediumRiskCount = risks.filter((r: { severity: string }) => r.severity === 'medium').length;
            lowRiskCount = risks.filter((r: { severity: string }) => r.severity === 'low').length;
          }
        } catch (error) {
          recLogger.warn({ error }, 'Failed to parse cached review data');
        }
      }

      // Get CI status
      let ciStatus: 'pending' | 'success' | 'failure' | 'neutral' = 'pending';
      try {
        const { check_runs } = await client.listCheckRuns(owner, repo, context.commitSha, {
          filter: 'latest',
        });

        // Find AI review check
        const aiCheck = check_runs.find(run => run.name === AI_REVIEW_CHECK_NAME);
        if (aiCheck) {
          if (aiCheck.status === 'completed') {
            ciStatus = aiCheck.conclusion === 'success' ? 'success' :
                      aiCheck.conclusion === 'failure' ? 'failure' :
                      aiCheck.conclusion === 'action_required' ? 'failure' :
                      'neutral';
          } else {
            ciStatus = 'pending';
          }
        }

        // Check all other checks
        const otherChecks = check_runs.filter(run => run.name !== AI_REVIEW_CHECK_NAME);
        const allOtherPassed = otherChecks.every(check => 
          check.status === 'completed' && check.conclusion === 'success'
        );
        const anyOtherFailed = otherChecks.some(check => 
          check.status === 'completed' && (check.conclusion === 'failure' || check.conclusion === 'action_required')
        );

        if (anyOtherFailed) {
          ciStatus = 'failure';
        } else if (allOtherPassed && otherChecks.length > 0) {
          ciStatus = ciStatus === 'pending' ? 'success' : ciStatus;
        }
      } catch (error) {
        recLogger.warn({ error }, 'Failed to fetch CI status');
      }

      // Get repo config for blocking rules
      const repoConfig = await loadRepoConfig(client, owner, repo);

      // Determine recommendation
      const result = this.calculateRecommendation(
        reviewSeverity,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        ciStatus,
        repoConfig.ci.blockOnCritical
      );

      recLogger.info({
        recommendation: result.recommendation,
        confidence: result.confidence,
        severity: reviewSeverity,
        ciStatus,
      }, 'Generated recommendation');

      return {
        ...result,
        reviewSeverity,
        ciStatus,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
      };
    } catch (error) {
      recLogger.error({ error }, 'Failed to get recommendation');
      throw error;
    }
  }

  /**
   * Calculate merge recommendation based on factors
   */
  private calculateRecommendation(
    reviewSeverity: 'info' | 'warning' | 'critical' | undefined,
    highRiskCount: number,
    mediumRiskCount: number,
    lowRiskCount: number,
    ciStatus: 'pending' | 'success' | 'failure' | 'neutral',
    blockOnCritical: boolean
  ): Omit<RecommendationResponse, 'reviewSeverity' | 'ciStatus' | 'highRiskCount' | 'mediumRiskCount' | 'lowRiskCount'> {
    const reasons: string[] = [];
    let recommendation: MergeRecommendation;
    let confidence = 0.8;

    // Block if CI is failing
    if (ciStatus === 'failure') {
      recommendation = 'BLOCK';
      confidence = 0.95;
      reasons.push('CI checks are failing. Must fix before merge.');
      return { recommendation, confidence, reasons };
    }

    // Block if critical review with high risks and blocking enabled
    if (blockOnCritical && reviewSeverity === 'critical' && highRiskCount > 0) {
      recommendation = 'BLOCK';
      confidence = 0.9;
      reasons.push(`${highRiskCount} high-severity risk(s) found.`);
      reasons.push('Repository is configured to block merges on critical findings.');
      return { recommendation, confidence, reasons };
    }

    // Block if pending CI and no review yet
    if (ciStatus === 'pending' && !reviewSeverity) {
      recommendation = 'ITERATE';
      confidence = 0.6;
      reasons.push('Review is still in progress.');
      return { recommendation, confidence, reasons };
    }

    // Iterate if high risks even if not blocking
    if (highRiskCount > 0) {
      recommendation = 'ITERATE';
      confidence = 0.85;
      reasons.push(`${highRiskCount} high-severity risk(s) should be addressed.`);
      if (mediumRiskCount > 0) {
        reasons.push(`${mediumRiskCount} medium-severity issue(s) found.`);
      }
      return { recommendation, confidence, reasons };
    }

    // Iterate if medium risks
    if (mediumRiskCount > 0) {
      recommendation = 'ITERATE';
      confidence = 0.7;
      reasons.push(`${mediumRiskCount} medium-severity issue(s) found.`);
      if (lowRiskCount > 0) {
        reasons.push(`${lowRiskCount} minor suggestion(s) to consider.`);
      }
      return { recommendation, confidence, reasons };
    }

    // Iterate if warning severity
    if (reviewSeverity === 'warning') {
      recommendation = 'ITERATE';
      confidence = 0.65;
      reasons.push('Review flagged some concerns.');
      return { recommendation, confidence, reasons };
    }

    // Iterate if pending CI but review is good
    if (ciStatus === 'pending') {
      recommendation = 'ITERATE';
      confidence = 0.6;
      reasons.push('Waiting for CI checks to complete.');
      return { recommendation, confidence, reasons };
    }

    // Merge if all good
    if (reviewSeverity === 'info' && ciStatus === 'success' && highRiskCount === 0 && mediumRiskCount === 0) {
      recommendation = 'MERGE';
      confidence = 0.95;
      reasons.push('No issues found.');
      reasons.push('All CI checks passing.');
      if (lowRiskCount > 0) {
        reasons.push(`${lowRiskCount} minor suggestion(s) - optional to address.`);
        confidence = 0.9;
      }
      return { recommendation, confidence, reasons };
    }

    // Default to iterate if unclear
    recommendation = 'ITERATE';
    confidence = 0.5;
    reasons.push('Review status unclear. Please verify manually.');
    return { recommendation, confidence, reasons };
  }
}

export const recommendationService = new RecommendationService();

