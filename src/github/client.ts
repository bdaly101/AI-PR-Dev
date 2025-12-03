import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { config } from '../config/env';

// Type assertion needed due to plugin type incompatibility between @octokit packages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OctokitWithPlugins = Octokit.plugin(retry as any, throttling as any) as any;

export class GitHubClient {
  private octokit: Octokit;

  constructor(installationId: number) {
    this.octokit = new OctokitWithPlugins({
      authStrategy: createAppAuth,
      auth: {
        appId: config.github.appId,
        privateKey: config.github.privateKey,
        installationId,
      },
      throttle: {
        onRateLimit: (retryAfter: number, options: { method: string; url: string }, octokit: Octokit, retryCount: number) => {
          console.warn(
            `Rate limit hit for ${options.method} ${options.url}. Retry ${retryCount + 1} after ${retryAfter} seconds.`
          );
          return retryCount < 3; // retry up to 3 times
        },
        onSecondaryRateLimit: (retryAfter: number, options: { method: string; url: string }, octokit: Octokit, retryCount: number) => {
          console.warn(
            `Secondary rate limit hit for ${options.method} ${options.url}. Retry ${retryCount + 1} after ${retryAfter} seconds.`
          );
          return retryCount < 3; // retry up to 3 times
        },
      },
    });
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number) {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return data;
  }

  async getPullRequestFiles(owner: string, repo: string, pullNumber: number) {
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return data;
  }

  async getPullRequestFilesPaginated(
    owner: string,
    repo: string,
    pullNumber: number,
    page: number = 1,
    perPage: number = 100
  ) {
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      page,
      per_page: perPage,
    });
    return data;
  }

  async getFileContent(owner: string, repo: string, path: string, ref: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      
      if ('content' in data && typeof data.content === 'string') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error);
      return null;
    }
  }

  async createReviewComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number
  ) {
    await this.octokit.pulls.createReviewComment({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      commit_id: commitId,
      path,
      line,
    });
  }

  async createReview(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT',
    comments?: Array<{
      path: string;
      line: number;
      body: string;
    }>
  ) {
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event,
      comments,
    });
  }

  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ) {
    const { data } = await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return data;
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ) {
    const { data } = await this.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels: labels && labels.length > 0 ? labels : undefined,
    });
    return data;
  }

  async createBranch(owner: string, repo: string, branchName: string, sha: string) {
    await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
    });
  }

  async deleteBranch(owner: string, repo: string, branchName: string) {
    await this.octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ) {
    await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha,
    });
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
  ) {
    const { data } = await this.octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body,
    });
    return data;
  }

  async getDefaultBranch(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({
      owner,
      repo,
    });
    return data.default_branch;
  }

  async getBranchSha(owner: string, repo: string, branch: string) {
    const { data } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    return data.object.sha;
  }

  /**
   * Add labels to an issue or pull request
   */
  async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]) {
    await this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  }

  /**
   * Remove a label from an issue or pull request
   */
  async removeLabel(owner: string, repo: string, issueNumber: number, label: string) {
    try {
      await this.octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error) {
      // Ignore error if label doesn't exist
      if (error instanceof Error && !error.message.includes('Label does not exist')) {
        throw error;
      }
    }
  }

  /**
   * Get labels on an issue or pull request
   */
  async getLabels(owner: string, repo: string, issueNumber: number) {
    const { data } = await this.octokit.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return data;
  }

  /**
   * Check if a label exists on an issue or pull request
   */
  async hasLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<boolean> {
    const labels = await this.getLabels(owner, repo, issueNumber);
    return labels.some(l => l.name === label);
  }

  /**
   * Get a user's permission level on a repository
   */
  async getCollaboratorPermission(
    owner: string,
    repo: string,
    username: string
  ): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      });
      return data.permission;
    } catch (error) {
      // User might not be a collaborator
      return 'none';
    }
  }

  /**
   * Add a reaction to a comment
   */
  async addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'
  ) {
    await this.octokit.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      content: reaction,
    });
  }

  // ============================================
  // GitHub Checks API Methods
  // ============================================

  /**
   * Create a new check run
   */
  async createCheckRun(
    owner: string,
    repo: string,
    name: string,
    headSha: string,
    options?: {
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'success' | 'skipped' | 'stale' | 'timed_out';
      detailsUrl?: string;
      externalId?: string;
      output?: {
        title: string;
        summary: string;
        text?: string;
        annotations?: Array<{
          path: string;
          start_line: number;
          end_line: number;
          annotation_level: 'notice' | 'warning' | 'failure';
          message: string;
          title?: string;
          raw_details?: string;
        }>;
      };
    }
  ) {
    const { data } = await this.octokit.checks.create({
      owner,
      repo,
      name,
      head_sha: headSha,
      status: options?.status,
      conclusion: options?.conclusion,
      details_url: options?.detailsUrl,
      external_id: options?.externalId,
      output: options?.output,
      started_at: new Date().toISOString(),
    });
    return data;
  }

  /**
   * Update an existing check run
   */
  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    options: {
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'success' | 'skipped' | 'stale' | 'timed_out';
      detailsUrl?: string;
      output?: {
        title: string;
        summary: string;
        text?: string;
        annotations?: Array<{
          path: string;
          start_line: number;
          end_line: number;
          annotation_level: 'notice' | 'warning' | 'failure';
          message: string;
          title?: string;
          raw_details?: string;
        }>;
      };
    }
  ) {
    const { data } = await this.octokit.checks.update({
      owner,
      repo,
      check_run_id: checkRunId,
      status: options.status,
      conclusion: options.conclusion,
      details_url: options.detailsUrl,
      output: options.output,
      completed_at: options.status === 'completed' ? new Date().toISOString() : undefined,
    });
    return data;
  }

  /**
   * List check runs for a specific ref
   */
  async listCheckRuns(
    owner: string,
    repo: string,
    ref: string,
    options?: {
      checkName?: string;
      status?: 'queued' | 'in_progress' | 'completed';
      filter?: 'latest' | 'all';
    }
  ) {
    const { data } = await this.octokit.checks.listForRef({
      owner,
      repo,
      ref,
      check_name: options?.checkName,
      status: options?.status,
      filter: options?.filter,
    });
    return data;
  }
}
