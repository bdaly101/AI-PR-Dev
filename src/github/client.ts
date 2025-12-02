import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { config } from '../config/env';

export class GitHubClient {
  private octokit: Octokit;

  constructor(installationId: number) {
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.github.appId,
        privateKey: config.github.privateKey,
        installationId,
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
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  async createBranch(owner: string, repo: string, branchName: string, sha: string) {
    await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
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
}
