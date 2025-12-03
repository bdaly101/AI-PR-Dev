import { FastifyInstance } from 'fastify';
import { GitHubClient } from '../github/client';
import { reviewRepo } from '../database/repositories/reviewRepo';
import { logger } from '../utils/logging';
import {
  ReviewStatusResponse,
  SuggestionsResponse,
  CIStatusResponse,
  CreateIssueRequest,
  CreateIssueResponse,
  ErrorResponse,
} from './types';
import { fetchPRContext } from '../github/prHelpers';
import { DEFAULT_IGNORE_PATTERNS } from '../config/constants';
import { prContextRepo } from '../database/repositories/prContextRepo';

interface ReviewParams {
  owner: string;
  repo: string;
  pr: string;
}

interface CheckParams {
  owner: string;
  repo: string;
  sha: string;
}

/**
 * Register API routes
 */
export async function registerAPIRoutes(fastify: FastifyInstance): Promise<void> {
  const apiLogger = logger.child({ component: 'api' });

  /**
   * GET /api/v1/reviews/:owner/:repo/:pr
   * Get review status and results for a PR
   */
  fastify.get<{
    Params: ReviewParams;
    Querystring: { installationId?: string };
  }>('/api/v1/reviews/:owner/:repo/:pr', async (request, reply) => {
    const { owner, repo, pr } = request.params;
    const pullNumber = parseInt(pr, 10);
    const installationId = request.query.installationId ? parseInt(request.query.installationId, 10) : undefined;

    if (isNaN(pullNumber)) {
      reply.code(400).send({ error: 'Invalid PR number', code: 'INVALID_PR_NUMBER' } as ErrorResponse);
      return;
    }

    if (!installationId) {
      reply.code(400).send({ 
        error: 'Missing installationId', 
        message: 'Provide installationId as query parameter',
        code: 'MISSING_INSTALLATION_ID',
      } as ErrorResponse);
      return;
    }

    try {
      apiLogger.debug({ owner, repo, pullNumber }, 'Fetching review status');

      // Get latest review from database
      const review = reviewRepo.getLatestReview(owner, repo, pullNumber);

      if (!review) {
        reply.code(404).send({
          error: 'Review not found',
          message: `No review found for ${owner}/${repo}#${pullNumber}`,
          code: 'REVIEW_NOT_FOUND',
        } as ErrorResponse);
        return;
      }

      // Get PR context to extract review details
      let riskCount = 0;
      let suggestionCount = 0;
      let severity: 'info' | 'warning' | 'critical' | undefined;
      let hasHighRisks = false;

      try {
        const client = new GitHubClient(installationId);
        const context = await fetchPRContext(client, owner, repo, pullNumber, {
          useCache: true,
          ignorePatterns: DEFAULT_IGNORE_PATTERNS,
        });

        // Try to get cached review data
        const cachedData = prContextRepo.getCachedContext(owner, repo, pullNumber, context.commitSha);
        if (cachedData?.context_data) {
          try {
            const data = JSON.parse(cachedData.context_data);
            if (data.review) {
              riskCount = data.review.risks?.length || 0;
              suggestionCount = data.review.suggestions?.length || 0;
              severity = data.review.severity;
              hasHighRisks = data.review.risks?.some((r: { severity: string }) => r.severity === 'high') || false;
            }
          } catch {
            // Ignore parse errors
          }
        }
      } catch (error) {
        apiLogger.warn({ error, owner, repo, pullNumber }, 'Failed to fetch PR context for details');
      }

      const response: ReviewStatusResponse = {
        owner,
        repo,
        pullNumber,
        commitSha: review.commit_sha,
        reviewed: true,
        reviewedAt: review.reviewed_at,
        modelUsed: review.model_used || undefined,
        reviewSummary: review.review_summary || undefined,
        severity,
        hasHighRisks,
        riskCount,
        suggestionCount,
      };

      reply.code(200).send(response);
    } catch (error) {
      apiLogger.error({ error, owner, repo, pullNumber }, 'Failed to get review status');
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorResponse);
    }
  });

  /**
   * GET /api/v1/reviews/:owner/:repo/:pr/suggestions
   * Get structured suggestions from review
   */
  fastify.get<{
    Params: ReviewParams;
    Querystring: { installationId?: string };
  }>('/api/v1/reviews/:owner/:repo/:pr/suggestions', async (request, reply) => {
    const { owner, repo, pr } = request.params;
    const pullNumber = parseInt(pr, 10);
    const installationId = request.query.installationId ? parseInt(request.query.installationId, 10) : undefined;

    if (isNaN(pullNumber)) {
      reply.code(400).send({ error: 'Invalid PR number', code: 'INVALID_PR_NUMBER' } as ErrorResponse);
      return;
    }

    if (!installationId) {
      reply.code(400).send({ 
        error: 'Missing installationId',
        code: 'MISSING_INSTALLATION_ID',
      } as ErrorResponse);
      return;
    }

    try {
      apiLogger.debug({ owner, repo, pullNumber }, 'Fetching suggestions');

      const review = reviewRepo.getLatestReview(owner, repo, pullNumber);
      if (!review) {
        reply.code(404).send({
          error: 'Review not found',
          code: 'REVIEW_NOT_FOUND',
        } as ErrorResponse);
        return;
      }

      // Get cached review data
      let suggestions: SuggestionsResponse['suggestions'] = [];

      try {
        const client = new GitHubClient(installationId);
        const context = await fetchPRContext(client, owner, repo, pullNumber, {
          useCache: true,
          ignorePatterns: DEFAULT_IGNORE_PATTERNS,
        });

        const cachedData = prContextRepo.getCachedContext(owner, repo, pullNumber, context.commitSha);
        if (cachedData?.context_data) {
          try {
            const data = JSON.parse(cachedData.context_data);
            if (data.review) {
              // Extract suggestions from risks and inline comments
              const risks = data.review.risks || [];
              const inlineComments = data.review.inlineComments || [];

              suggestions = [
                ...risks.map((risk: { category: string; severity: string; description: string }, idx: number) => ({
                  id: `risk-${idx}`,
                  category: risk.category,
                  severity: risk.severity as 'low' | 'medium' | 'high',
                  description: risk.description,
                  actionable: true,
                })),
                ...inlineComments.map((comment: { path: string; line: number; body: string }, idx: number) => ({
                  id: `comment-${idx}`,
                  category: 'code-quality',
                  severity: 'medium' as const,
                  description: comment.body.substring(0, 200),
                  file: comment.path,
                  line: comment.line,
                  actionable: true,
                })),
              ];
            }
          } catch {
            // Ignore parse errors
          }
        }
      } catch (error) {
        apiLogger.warn({ error }, 'Failed to fetch suggestions from cache');
      }

      const response: SuggestionsResponse = {
        owner,
        repo,
        pullNumber,
        suggestions,
      };

      reply.code(200).send(response);
    } catch (error) {
      apiLogger.error({ error }, 'Failed to get suggestions');
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorResponse);
    }
  });

  /**
   * GET /api/v1/reviews/:owner/:repo/:pr/recommendation
   * Get merge recommendation
   */
  fastify.get<{
    Params: ReviewParams;
    Querystring: { installationId?: string };
  }>('/api/v1/reviews/:owner/:repo/:pr/recommendation', async (request, reply) => {
    const { owner, repo, pr } = request.params;
    const pullNumber = parseInt(pr, 10);
    const installationId = request.query.installationId ? parseInt(request.query.installationId, 10) : undefined;

    if (isNaN(pullNumber)) {
      reply.code(400).send({ error: 'Invalid PR number', code: 'INVALID_PR_NUMBER' } as ErrorResponse);
      return;
    }

    if (!installationId) {
      reply.code(400).send({ 
        error: 'Missing installationId',
        code: 'MISSING_INSTALLATION_ID',
      } as ErrorResponse);
      return;
    }

    try {
      // Import recommendation service (will create next)
      const { recommendationService } = await import('../services/recommendationService');
      
      const recommendation = await recommendationService.getRecommendation(
        owner,
        repo,
        pullNumber,
        installationId
      );

      reply.code(200).send(recommendation);
    } catch (error) {
      apiLogger.error({ error }, 'Failed to get recommendation');
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorResponse);
    }
  });

  /**
   * GET /api/v1/checks/:owner/:repo/:sha
   * Get CI/check status
   */
  fastify.get<{
    Params: CheckParams;
    Querystring: { installationId?: string };
  }>('/api/v1/checks/:owner/:repo/:sha', async (request, reply) => {
    const { owner, repo, sha } = request.params;
    const installationId = request.query.installationId ? parseInt(request.query.installationId, 10) : undefined;

    if (!installationId) {
      reply.code(400).send({ 
        error: 'Missing installationId',
        code: 'MISSING_INSTALLATION_ID',
      } as ErrorResponse);
      return;
    }

    try {
      apiLogger.debug({ owner, repo, sha }, 'Fetching CI status');

      const client = new GitHubClient(installationId);
      const { check_runs } = await client.listCheckRuns(owner, repo, sha, {
        filter: 'latest',
      });

      const checks = check_runs.map(run => {
        // Map GitHub status to our simplified status
        let status: 'queued' | 'in_progress' | 'completed' = 'queued';
        if (run.status === 'completed') {
          status = 'completed';
        } else if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'waiting' || run.status === 'requested' || run.status === 'pending') {
          status = run.status === 'in_progress' ? 'in_progress' : 'queued';
        }

        return {
          name: run.name || 'unknown',
          status,
          conclusion: run.conclusion || undefined,
          url: run.html_url || undefined,
        };
      });

      const allPassed = checks.every(check => 
        check.status === 'completed' && check.conclusion === 'success'
      );
      const hasFailures = checks.some(check => 
        check.status === 'completed' && (check.conclusion === 'failure' || check.conclusion === 'action_required')
      );

      const response: CIStatusResponse = {
        owner,
        repo,
        commitSha: sha,
        checks,
        allPassed,
        hasFailures,
      };

      reply.code(200).send(response);
    } catch (error) {
      apiLogger.error({ error }, 'Failed to get CI status');
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorResponse);
    }
  });

  /**
   * POST /api/v1/issues
   * Create GitHub issue from suggestion
   */
  fastify.post<{
    Body: CreateIssueRequest;
    Querystring: { installationId?: string };
  }>('/api/v1/issues', async (request, reply) => {
    const body = request.body;
    const installationId = request.query.installationId ? parseInt(request.query.installationId, 10) : undefined;

    if (!installationId) {
      reply.code(400).send({ 
        error: 'Missing installationId',
        code: 'MISSING_INSTALLATION_ID',
      } as ErrorResponse);
      return;
    }

    try {
      // Import issue service (will create later)
      const { issueService } = await import('../services/issueService');
      
      const issue = await issueService.createIssueFromSuggestion(
        body,
        installationId
      );

      const response: CreateIssueResponse = {
        issueNumber: issue.issueNumber,
        url: issue.url,
      };

      reply.code(201).send(response);
    } catch (error) {
      apiLogger.error({ error }, 'Failed to create issue');
      reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorResponse);
    }
  });
}

