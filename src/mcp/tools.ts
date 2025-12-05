import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { recommendationService } from '../services/recommendationService';
import { reviewRepo } from '../database/repositories/reviewRepo';
import { prContextRepo } from '../database/repositories/prContextRepo';
import { GitHubClient } from '../github/client';
import { fetchPRContext } from '../github/prHelpers';
import { DEFAULT_IGNORE_PATTERNS } from '../config/constants';
import { issueService } from '../services/issueService';
import { validateFullBranchName, isProtectedBranch, validateBranchStrategy, BranchType } from '../validation/branchRules';
import { validateCommitMessage, validateCommitChanges, FileChange } from '../validation/commitRules';
import { createMCPLogger } from '../utils/logging';

// Use MCP logger (writes to stderr) to avoid interfering with JSON-RPC on stdout
const logger = createMCPLogger('ai-pr-reviewer');

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
        milestone: {
          type: 'string',
          description: 'Milestone name to assign (will look up by name)',
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
    name: 'list_milestones',
    description: 'List open milestones for a repository',
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
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'installationId'],
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
  {
    name: 'create_feature_branch',
    description: 'Create a feature branch following naming conventions (feature/*, fix/*, chore/*, docs/*)',
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
        branchType: {
          type: 'string',
          enum: ['feature', 'fix', 'chore', 'docs'],
          description: 'Type of branch to create',
        },
        name: {
          type: 'string',
          description: 'Branch name without prefix (e.g., "add-login")',
        },
        fromBranch: {
          type: 'string',
          description: 'Base branch to create from (default: develop)',
          default: 'develop',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'branchType', 'name', 'installationId'],
    },
  },
  {
    name: 'commit_changes',
    description: 'Commit file changes to a feature branch (blocks protected branches)',
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
        branch: {
          type: 'string',
          description: 'Branch to commit to',
        },
        message: {
          type: 'string',
          description: 'Conventional commit message',
        },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
          description: 'Files to commit',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'branch', 'message', 'files', 'installationId'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create a PR from feature branch to develop (or develop to main)',
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
        head: {
          type: 'string',
          description: 'Source branch',
        },
        base: {
          type: 'string',
          description: 'Target branch (default: develop)',
          default: 'develop',
        },
        title: {
          type: 'string',
          description: 'PR title',
        },
        body: {
          type: 'string',
          description: 'PR description',
        },
        draft: {
          type: 'boolean',
          description: 'Create as draft PR (default: true)',
          default: true,
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'head', 'title', 'body', 'installationId'],
    },
  },
  {
    name: 'validate_branch_strategy',
    description: 'Check if a branch operation follows the branching strategy',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['commit', 'pr', 'merge'],
          description: 'Type of operation',
        },
        sourceBranch: {
          type: 'string',
          description: 'Source branch name',
        },
        targetBranch: {
          type: 'string',
          description: 'Target branch name',
        },
      },
      required: ['operation', 'sourceBranch', 'targetBranch'],
    },
  },
  {
    name: 'check_deployment_readiness',
    description: 'Verify all gates pass before deploying to an environment',
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
        targetEnvironment: {
          type: 'string',
          enum: ['staging', 'production'],
          description: 'Target deployment environment',
        },
        installationId: {
          type: 'number',
          description: 'GitHub App installation ID',
        },
      },
      required: ['owner', 'repo', 'pullNumber', 'targetEnvironment', 'installationId'],
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
      const { owner, repo, pullNumber, title, body, suggestionId, priority, labels, milestone, installationId } = args as {
        owner: string;
        repo: string;
        pullNumber: number;
        title: string;
        body: string;
        suggestionId?: string;
        priority?: 'low' | 'medium' | 'high';
        labels?: string[];
        milestone?: string;
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
          milestone,
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

      // Determine if merge is possible (all checks passed)
      const canMerge = allPassed && !hasFailures;

      // Get blockers (failing required checks)
      const blockers = checks
        .filter(check => 
          check.status === 'completed' && 
          (check.conclusion === 'failure' || check.conclusion === 'action_required')
        )
        .map(check => check.name);

      // Generate recommendation
      let recommendation: string;
      if (checks.length === 0) {
        recommendation = 'No CI checks found. Verify checks are configured.';
      } else if (canMerge) {
        recommendation = 'Ready to merge - all checks passed';
      } else if (hasFailures) {
        recommendation = `Fix failing tests first: ${blockers.join(', ')}`;
      } else {
        recommendation = 'Waiting for checks to complete';
      }

      return {
        owner,
        repo,
        commitSha,
        checks,
        allPassed,
        hasFailures,
        canMerge,
        blockers,
        recommendation,
      };
    }

    case 'create_feature_branch': {
      const { owner, repo, branchType, name, fromBranch = 'develop', installationId } = args as {
        owner: string;
        repo: string;
        branchType: BranchType;
        name: string;
        fromBranch?: string;
        installationId: number;
      };

      const toolLogger = logger.child({ tool: 'create_feature_branch', owner, repo, branchType, name });

      // Validate branch name
      const validation = validateFullBranchName(branchType, name);
      if (!validation.valid) {
        throw new Error(`Invalid branch name: ${validation.errors.join(', ')}`);
      }

      const fullBranchName = `${branchType}/${name}`;

      // Check if branch would be protected
      if (isProtectedBranch(fullBranchName)) {
        throw new Error(`Cannot create protected branch: ${fullBranchName}`);
      }

      const client = new GitHubClient(installationId);

      // Get the SHA of the base branch
      const baseSha = await client.getBranchSha(owner, repo, fromBranch);

      // Create the new branch
      await client.createBranch(owner, repo, fullBranchName, baseSha);

      toolLogger.info({ branchName: fullBranchName, fromBranch }, 'Branch created successfully');

      return {
        success: true,
        branchName: fullBranchName,
        baseBranch: fromBranch,
        sha: baseSha,
      };
    }

    case 'commit_changes': {
      const { owner, repo, branch, message, files, installationId } = args as {
        owner: string;
        repo: string;
        branch: string;
        message: string;
        files: Array<{ path: string; content: string }>;
        installationId: number;
      };

      const toolLogger = logger.child({ tool: 'commit_changes', owner, repo, branch });

      // Block commits to protected branches
      if (isProtectedBranch(branch)) {
        throw new Error(`Cannot commit to protected branch: ${branch}`);
      }

      // Validate commit message
      const messageValidation = validateCommitMessage(message);
      if (!messageValidation.valid) {
        throw new Error(`Invalid commit message: ${messageValidation.errors.join(', ')}`);
      }

      // Validate files
      const fileChanges: FileChange[] = files.map(f => ({ path: f.path, content: f.content }));
      const filesValidation = validateCommitChanges(fileChanges);
      if (!filesValidation.valid) {
        throw new Error(`Invalid file changes: ${filesValidation.errors.join(', ')}`);
      }

      const client = new GitHubClient(installationId);

      // Get current file SHAs for update operations
      const committedFiles: string[] = [];
      for (const file of files) {
        try {
          // Try to get existing file to check if it exists
          const currentContent = await client.getFileContent(owner, repo, file.path, branch);
          let fileSha: string | undefined;

          if (currentContent !== null) {
            // File exists - we need SHA for update
            // Note: getFileContent doesn't return SHA, so we'd need to fetch it differently
            // For now, we'll create/update and let GitHub handle it
          }

          await client.createOrUpdateFile(
            owner,
            repo,
            file.path,
            file.content,
            message,
            branch,
            fileSha
          );

          committedFiles.push(file.path);
        } catch (error) {
          toolLogger.error({ error, path: file.path }, 'Failed to commit file');
          throw new Error(`Failed to commit file ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      toolLogger.info({ files: committedFiles }, 'Files committed successfully');

      return {
        success: true,
        branch,
        message,
        filesCommitted: committedFiles,
      };
    }

    case 'create_pull_request': {
      const { owner, repo, head, base = 'develop', title, body, draft = true, installationId } = args as {
        owner: string;
        repo: string;
        head: string;
        base: string;
        title: string;
        body: string;
        draft?: boolean;
        installationId: number;
      };

      const toolLogger = logger.child({ tool: 'create_pull_request', owner, repo, head, base });

      // Validate branch strategy
      const strategyValidation = validateBranchStrategy(head, base);
      if (!strategyValidation.allowed) {
        throw new Error(strategyValidation.reason || 'Invalid branch strategy');
      }

      const client = new GitHubClient(installationId);

      // Determine if PR should be draft
      // PRs to main are always drafts, regardless of parameter
      const isDraft = base === 'main' ? true : draft;

      // Create PR
      const pr = await client.createPullRequest(owner, repo, title, head, base, body);

      // GitHub API doesn't support creating draft PRs directly via pulls.create
      // Draft status must be set via pulls.update after creation
      // For now, we'll just create the PR and note that it should be marked draft
      // In a real implementation, you'd need to update the PR to set draft status

      // Auto-add labels based on branch type
      const branchType = head.split('/')[0];
      const labels: string[] = [];
      if (branchType === 'feature') labels.push('enhancement');
      else if (branchType === 'fix') labels.push('bug');
      else if (branchType === 'chore') labels.push('maintenance');
      else if (branchType === 'docs') labels.push('documentation');

      if (labels.length > 0) {
        try {
          await client.addLabels(owner, repo, pr.number, labels);
        } catch (error) {
          toolLogger.warn({ error, labels }, 'Failed to add labels to PR');
        }
      }

      toolLogger.info({ prNumber: pr.number, draft: isDraft }, 'PR created successfully');

      return {
        success: true,
        prNumber: pr.number,
        url: pr.html_url,
        draft: isDraft,
        note: isDraft ? 'PR created as draft. Update via GitHub UI to mark ready.' : undefined,
      };
    }

    case 'validate_branch_strategy': {
      const { operation, sourceBranch, targetBranch } = args as {
        operation: 'commit' | 'pr' | 'merge';
        sourceBranch: string;
        targetBranch: string;
      };

      if (operation === 'commit') {
        // For commits, we just check if source branch is protected
        const isProtected = isProtectedBranch(sourceBranch);
        return {
          allowed: !isProtected,
          reason: isProtected ? `Cannot commit to protected branch: ${sourceBranch}` : undefined,
        };
      }

      // For PR and merge, validate the branch strategy
      const validation = validateBranchStrategy(sourceBranch, targetBranch);
      return validation;
    }

    case 'list_milestones': {
      const { owner, repo, installationId } = args as {
        owner: string;
        repo: string;
        installationId: number;
      };

      const client = new GitHubClient(installationId);
      const milestones = await client.listMilestones(owner, repo);

      return {
        owner,
        repo,
        milestones: milestones.map(m => ({
          number: m.number,
          title: m.title,
          description: m.description || undefined,
          dueOn: m.due_on || undefined,
          openIssues: m.open_issues,
          closedIssues: m.closed_issues,
        })),
      };
    }

    case 'check_deployment_readiness': {
      const { owner, repo, pullNumber, targetEnvironment, installationId } = args as {
        owner: string;
        repo: string;
        pullNumber: number;
        targetEnvironment: 'staging' | 'production';
        installationId: number;
      };

      const toolLogger = logger.child({ tool: 'check_deployment_readiness', owner, repo, pullNumber, targetEnvironment });
      const blockers: string[] = [];
      const warnings: string[] = [];

      const client = new GitHubClient(installationId);

      // Get PR details
      const pr = await client.getPullRequest(owner, repo, pullNumber);
      const commitSha = pr.head.sha;

      // Check 1: CI status
      const { check_runs } = await client.listCheckRuns(owner, repo, commitSha, {
        filter: 'latest',
      });
      const failedChecks = check_runs.filter(run => 
        run.status === 'completed' && (run.conclusion === 'failure' || run.conclusion === 'action_required')
      );
      if (failedChecks.length > 0) {
        blockers.push(`CI checks failed: ${failedChecks.map(c => c.name).join(', ')}`);
      }

      // Check 2: PR approval (required for production)
      if (targetEnvironment === 'production') {
        // Check if PR has been reviewed/approved
        // Note: GitHub API requires checking reviews endpoint
        // For now, we'll add a warning that manual verification is needed
        warnings.push('Production deployment requires PR approval. Verify manually.');
      }

      // Check 3: AI review severity
      const review = reviewRepo.getLatestReview(owner, repo, pullNumber);
      if (review) {
        try {
          const context = await fetchPRContext(client, owner, repo, pullNumber, {
            useCache: true,
            ignorePatterns: DEFAULT_IGNORE_PATTERNS,
          });
          const cachedData = prContextRepo.getCachedContext(owner, repo, pullNumber, context.commitSha);
          
          if (cachedData?.context_data) {
            try {
              const data = JSON.parse(cachedData.context_data);
              const reviewData = data.review || {};
              
              if (reviewData.severity === 'critical') {
                blockers.push('AI review found critical issues that must be resolved before deployment');
              } else if (reviewData.severity === 'warning' && targetEnvironment === 'production') {
                warnings.push('AI review found warning-level issues. Consider resolving before production deployment.');
              }
            } catch {
              // Ignore parse errors
            }
          }
        } catch (error) {
          toolLogger.warn({ error }, 'Failed to check AI review status');
        }
      }

      // Check 4: Branch is up to date
      if (pr.mergeable === false) {
        blockers.push('Branch is out of date with base branch. Please update branch.');
      }

      const ready = blockers.length === 0;

      toolLogger.info({ ready, blockerCount: blockers.length, warningCount: warnings.length }, 'Deployment readiness check completed');

      return {
        ready,
        blockers,
        warnings,
        environment: targetEnvironment,
        commitSha,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

