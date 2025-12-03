import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { recommendationService } from '../services/recommendationService';
import { reviewRepo } from '../database/repositories/reviewRepo';
import { prContextRepo } from '../database/repositories/prContextRepo';
import { GitHubClient } from '../github/client';
import { fetchPRContext } from '../github/prHelpers';
import { DEFAULT_IGNORE_PATTERNS } from '../config/constants';
import { checksService, AI_REVIEW_CHECK_NAME } from '../services/checksService';
import { issueService } from '../services/issueService';

/**
 * MCP Tool definitions for Cursor IDE integration
 */
export const MCP_TOOLS: Tool[] = [
  {
    name: 'get_pr_review',
    description: 'Get the AI review status and results for a GitHub pull request. Returns review summary, severity, risks, and suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner (e.g., "octocat")',
        },
        repo: {
          type: 'string',
          description: 'Repository name (e.g., "Hello-World")',
        },
        pullNumber: {
          type: 'number',
          description: 'Pull request number',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'pullNumber', 'installationId'],
    },
  },
  {
    name: 'get_suggestions',
    description: 'Get structured, actionable suggestions from a PR review. Returns list of suggestions with severity, category, and file locations.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        pullNumber: {
          type: 'number',
          description: 'Pull request number',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'pullNumber', 'installationId'],
    },
  },
  {
    name: 'get_merge_recommendation',
    description: 'Get merge recommendation (MERGE, ITERATE, or BLOCK) based on review severity and CI status. Includes confidence score and reasons.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        pullNumber: {
          type: 'number',
          description: 'Pull request number',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'pullNumber', 'installationId'],
    },
  },
  {
    name: 'create_issue_from_suggestion',
    description: 'Create a GitHub issue from a review suggestion. Links the issue to the PR and adds appropriate labels.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        pullNumber: {
          type: 'number',
          description: 'Pull request number',
        },
        title: {
          type: 'string',
          description: 'Issue title',
        },
        body: {
          type: 'string',
          description: 'Issue body/description',
        },
        suggestionId: {
          type: 'string',
          description: 'Optional suggestion ID from get_suggestions',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Issue priority',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional labels for the issue',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'pullNumber', 'title', 'body', 'installationId'],
    },
  },
  {
    name: 'get_ci_status',
    description: 'Get CI/check run status for a commit. Returns all check runs including their status and conclusions.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        commitSha: {
          type: 'string',
          description: 'Commit SHA',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'commitSha', 'installationId'],
    },
  },
];

/**
 * Execute MCP tool by name
 */
export async function executeMCPTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_pr_review': {
      const { owner, repo, pullNumber, installationId } = args as {
        owner: string;
        repo: string;
        pullNumber: number;
        installationId: number;
      };

      const review = reviewRepo.getLatestReview(owner, repo, pullNumber);
      if (!review) {
        return {
          reviewed: false,
          message: `No review found for ${owner}/${repo}#${pullNumber}`,
        };
      }

      // Get detailed review data from cache
      const client = new GitHubClient(installationId);
      const context = await fetchPRContext(client, owner, repo, pullNumber, {
        useCache: true,
        ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      });

      const cachedData = prContextRepo.getCachedContext(owner, repo, pullNumber, context.commitSha);
      let reviewData: Record<string, unknown> = {};

      if (cachedData?.context_data) {
        try {
          const parsed = JSON.parse(cachedData.context_data);
          reviewData = parsed.review || {};
        } catch {
          // Ignore parse errors
        }
      }

      return {
        reviewed: true,
        owner,
        repo,
        pullNumber,
        commitSha: review.commit_sha,
        reviewedAt: review.reviewed_at,
        modelUsed: review.model_used,
        reviewSummary: review.review_summary,
        severity: reviewData.severity,
        risks: reviewData.risks || [],
        suggestions: reviewData.suggestions || [],
        strengths: reviewData.strengths || [],
        inlineComments: reviewData.inlineComments || [],
      };
    }

    case 'get_suggestions': {
      const { owner, repo, pullNumber, installationId } = args as {
        owner: string;
        repo: string;
        pullNumber: number;
        installationId: number;
      };

      const review = reviewRepo.getLatestReview(owner, repo, pullNumber);
      if (!review) {
        return {
          suggestions: [],
          message: `No review found for ${owner}/${repo}#${pullNumber}`,
        };
      }

      const client = new GitHubClient(installationId);
      const context = await fetchPRContext(client, owner, repo, pullNumber, {
        useCache: true,
        ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      });

      const cachedData = prContextRepo.getCachedContext(owner, repo, pullNumber, context.commitSha);
      const suggestions: Array<Record<string, unknown>> = [];

      if (cachedData?.context_data) {
        try {
          const data = JSON.parse(cachedData.context_data);
          const review = data.review || {};
          const risks = review.risks || [];
          const inlineComments = review.inlineComments || [];

          suggestions.push(
            ...risks.map((risk: Record<string, unknown>, idx: number) => ({
              id: `risk-${idx}`,
              category: risk.category,
              severity: risk.severity,
              description: risk.description,
              actionable: true,
            })),
            ...inlineComments.map((comment: Record<string, unknown>, idx: number) => ({
              id: `comment-${idx}`,
              category: 'code-quality',
              severity: 'medium',
              description: String(comment.body || '').substring(0, 200),
              file: comment.path,
              line: comment.line,
              actionable: true,
            }))
          );
        } catch {
          // Ignore parse errors
        }
      }

      return {
        owner,
        repo,
        pullNumber,
        suggestions,
      };
    }

    case 'get_merge_recommendation': {
      const { owner, repo, pullNumber, installationId } = args as {
        owner: string;
        repo: string;
        pullNumber: number;
        installationId: number;
      };

      const recommendation = await recommendationService.getRecommendation(
        owner,
        repo,
        pullNumber,
        installationId
      );

      return recommendation;
    }

    case 'create_issue_from_suggestion': {
      const { owner, repo, pullNumber, title, body, suggestionId, priority, labels, installationId } = args as {
        owner: string;
        repo: string;
        pullNumber: number;
        title: string;
        body: string;
        suggestionId?: string;
        priority?: 'low' | 'medium' | 'high';
        labels?: string[];
        installationId: number;
      };

      const issue = await issueService.createIssueFromSuggestion(
        {
          owner,
          repo,
          pullNumber,
          title,
          body,
          suggestionId,
          priority,
          labels,
        },
        installationId
      );

      return {
        success: true,
        issueNumber: issue.issueNumber,
        url: issue.url,
      };
    }

    case 'get_ci_status': {
      const { owner, repo, commitSha, installationId } = args as {
        owner: string;
        repo: string;
        commitSha: string;
        installationId: number;
      };

      const client = new GitHubClient(installationId);
      const { check_runs } = await client.listCheckRuns(owner, repo, commitSha, {
        filter: 'latest',
      });

      const checks = check_runs.map(run => {
        let status: 'queued' | 'in_progress' | 'completed' = 'queued';
        if (run.status === 'completed') {
          status = 'completed';
        } else if (run.status === 'in_progress') {
          status = 'in_progress';
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

      return {
        owner,
        repo,
        commitSha,
        checks,
        allPassed,
        hasFailures,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

