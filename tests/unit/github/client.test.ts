import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

// Create all mock functions before vi.mock
const mockPullsGet = vi.fn();
const mockPullsListFiles = vi.fn();
const mockPullsCreateReviewComment = vi.fn();
const mockPullsCreateReview = vi.fn();
const mockPullsCreate = vi.fn();
const mockIssuesCreateComment = vi.fn();
const mockIssuesAddLabels = vi.fn();
const mockIssuesRemoveLabel = vi.fn();
const mockIssuesListLabelsOnIssue = vi.fn();
const mockReposGetContent = vi.fn();
const mockReposCreateOrUpdateFileContents = vi.fn();
const mockReposGet = vi.fn();
const mockGitCreateRef = vi.fn();
const mockGitGetRef = vi.fn();

// Create the mock octokit instance that all GitHubClient instances will share
const mockOctokitInstance = {
  pulls: {
    get: mockPullsGet,
    listFiles: mockPullsListFiles,
    createReviewComment: mockPullsCreateReviewComment,
    createReview: mockPullsCreateReview,
    create: mockPullsCreate,
  },
  issues: {
    createComment: mockIssuesCreateComment,
    addLabels: mockIssuesAddLabels,
    removeLabel: mockIssuesRemoveLabel,
    listLabelsOnIssue: mockIssuesListLabelsOnIssue,
  },
  repos: {
    getContent: mockReposGetContent,
    createOrUpdateFileContents: mockReposCreateOrUpdateFileContents,
    get: mockReposGet,
  },
  git: {
    createRef: mockGitCreateRef,
    getRef: mockGitGetRef,
  },
};

// Mock the env config first
vi.mock('../../../src/config/env', () => ({
  config: {
    github: {
      appId: 'test-app-id',
      privateKey: 'test-private-key',
      webhookSecret: 'test-webhook-secret',
    },
  },
}));

// Mock Octokit and its plugins - using a factory function that returns the same instance
vi.mock('@octokit/rest', () => {
  const MockOctokitConstructor = vi.fn(() => mockOctokitInstance);
  return {
    Octokit: {
      plugin: vi.fn(() => MockOctokitConstructor),
    },
  };
});

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

vi.mock('@octokit/plugin-retry', () => ({
  retry: vi.fn(),
}));

vi.mock('@octokit/plugin-throttling', () => ({
  throttling: vi.fn(),
}));

import { GitHubClient } from '../../../src/github/client';

describe('github/client', () => {
  let client: GitHubClient;

  beforeAll(() => {
    // Just make sure the mocks are available
  });

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient(12345);
  });

  describe('constructor', () => {
    it('should create client with installation ID', () => {
      expect(client).toBeInstanceOf(GitHubClient);
    });
  });

  describe('getPullRequest', () => {
    it('should fetch a pull request', async () => {
      const mockPR = {
        number: 1,
        title: 'Test PR',
        body: 'Test body',
        head: { sha: 'abc123', ref: 'feature-branch' },
        base: { ref: 'main' },
      };
      mockPullsGet.mockResolvedValue({ data: mockPR });

      const result = await client.getPullRequest('owner', 'repo', 1);

      expect(mockPullsGet).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
      });
      expect(result).toEqual(mockPR);
    });
  });

  describe('getPullRequestFiles', () => {
    it('should fetch PR files', async () => {
      const mockFiles = [
        { filename: 'file1.ts', status: 'modified', patch: '@@ -1,1 +1,2 @@' },
        { filename: 'file2.ts', status: 'added', patch: '@@ -0,0 +1,10 @@' },
      ];
      mockPullsListFiles.mockResolvedValue({ data: mockFiles });

      const result = await client.getPullRequestFiles('owner', 'repo', 1);

      expect(mockPullsListFiles).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
      });
      expect(result).toEqual(mockFiles);
    });
  });

  describe('getPullRequestFilesPaginated', () => {
    it('should fetch PR files with pagination', async () => {
      const mockFiles = [{ filename: 'file.ts' }];
      mockPullsListFiles.mockResolvedValue({ data: mockFiles });

      const result = await client.getPullRequestFilesPaginated('owner', 'repo', 1, 2, 50);

      expect(mockPullsListFiles).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        page: 2,
        per_page: 50,
      });
      expect(result).toEqual(mockFiles);
    });

    it('should use default pagination values', async () => {
      mockPullsListFiles.mockResolvedValue({ data: [] });

      await client.getPullRequestFilesPaginated('owner', 'repo', 1);

      expect(mockPullsListFiles).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        page: 1,
        per_page: 100,
      });
    });
  });

  describe('getFileContent', () => {
    it('should fetch and decode file content', async () => {
      const content = 'console.log("Hello World");';
      const base64Content = Buffer.from(content).toString('base64');
      mockReposGetContent.mockResolvedValue({
        data: { content: base64Content },
      });

      const result = await client.getFileContent('owner', 'repo', 'file.ts', 'abc123');

      expect(mockReposGetContent).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'file.ts',
        ref: 'abc123',
      });
      expect(result).toBe(content);
    });

    it('should return null when content is not available', async () => {
      mockReposGetContent.mockResolvedValue({
        data: { type: 'dir' }, // Directory has no content
      });

      const result = await client.getFileContent('owner', 'repo', 'src/', 'abc123');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockReposGetContent.mockRejectedValue(new Error('Not found'));

      const result = await client.getFileContent('owner', 'repo', 'missing.ts', 'abc123');

      expect(result).toBeNull();
    });
  });

  describe('createReviewComment', () => {
    it('should create a review comment', async () => {
      mockPullsCreateReviewComment.mockResolvedValue({});

      await client.createReviewComment(
        'owner',
        'repo',
        1,
        'Review comment body',
        'abc123',
        'file.ts',
        10
      );

      expect(mockPullsCreateReviewComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        body: 'Review comment body',
        commit_id: 'abc123',
        path: 'file.ts',
        line: 10,
      });
    });
  });

  describe('createReview', () => {
    it('should create a review with comment event', async () => {
      mockPullsCreateReview.mockResolvedValue({});

      await client.createReview('owner', 'repo', 1, 'Review body');

      expect(mockPullsCreateReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        body: 'Review body',
        event: 'COMMENT',
        comments: undefined,
      });
    });

    it('should create an approval review', async () => {
      mockPullsCreateReview.mockResolvedValue({});

      await client.createReview('owner', 'repo', 1, 'LGTM!', 'APPROVE');

      expect(mockPullsCreateReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        body: 'LGTM!',
        event: 'APPROVE',
        comments: undefined,
      });
    });

    it('should create a request changes review', async () => {
      mockPullsCreateReview.mockResolvedValue({});

      await client.createReview(
        'owner',
        'repo',
        1,
        'Please fix these issues',
        'REQUEST_CHANGES',
        [{ path: 'file.ts', line: 10, body: 'Fix this' }]
      );

      expect(mockPullsCreateReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        body: 'Please fix these issues',
        event: 'REQUEST_CHANGES',
        comments: [{ path: 'file.ts', line: 10, body: 'Fix this' }],
      });
    });
  });

  describe('createIssueComment', () => {
    it('should create an issue comment', async () => {
      mockIssuesCreateComment.mockResolvedValue({});

      await client.createIssueComment('owner', 'repo', 1, 'Comment body');

      expect(mockIssuesCreateComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        body: 'Comment body',
      });
    });
  });

  describe('createBranch', () => {
    it('should create a new branch', async () => {
      mockGitCreateRef.mockResolvedValue({});

      await client.createBranch('owner', 'repo', 'feature-branch', 'abc123');

      expect(mockGitCreateRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'refs/heads/feature-branch',
        sha: 'abc123',
      });
    });
  });

  describe('createOrUpdateFile', () => {
    it('should create or update a file', async () => {
      mockReposCreateOrUpdateFileContents.mockResolvedValue({});

      await client.createOrUpdateFile(
        'owner',
        'repo',
        'file.ts',
        'console.log("test");',
        'Add file',
        'main'
      );

      expect(mockReposCreateOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'file.ts',
        message: 'Add file',
        content: Buffer.from('console.log("test");').toString('base64'),
        branch: 'main',
        sha: undefined,
      });
    });

    it('should update existing file with sha', async () => {
      mockReposCreateOrUpdateFileContents.mockResolvedValue({});

      await client.createOrUpdateFile(
        'owner',
        'repo',
        'file.ts',
        'updated content',
        'Update file',
        'main',
        'existing-sha'
      );

      expect(mockReposCreateOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'file.ts',
        message: 'Update file',
        content: Buffer.from('updated content').toString('base64'),
        branch: 'main',
        sha: 'existing-sha',
      });
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request', async () => {
      const mockNewPR = {
        number: 2,
        title: 'New PR',
        html_url: 'https://github.com/owner/repo/pull/2',
      };
      mockPullsCreate.mockResolvedValue({ data: mockNewPR });

      const result = await client.createPullRequest(
        'owner',
        'repo',
        'New PR',
        'feature-branch',
        'main',
        'PR description'
      );

      expect(mockPullsCreate).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'New PR',
        head: 'feature-branch',
        base: 'main',
        body: 'PR description',
      });
      expect(result).toEqual(mockNewPR);
    });
  });

  describe('getDefaultBranch', () => {
    it('should get the default branch', async () => {
      mockReposGet.mockResolvedValue({
        data: { default_branch: 'main' },
      });

      const result = await client.getDefaultBranch('owner', 'repo');

      expect(mockReposGet).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      });
      expect(result).toBe('main');
    });
  });

  describe('getBranchSha', () => {
    it('should get the branch SHA', async () => {
      mockGitGetRef.mockResolvedValue({
        data: { object: { sha: 'abc123def456' } },
      });

      const result = await client.getBranchSha('owner', 'repo', 'main');

      expect(mockGitGetRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/main',
      });
      expect(result).toBe('abc123def456');
    });
  });

  describe('addLabels', () => {
    it('should add labels to an issue', async () => {
      mockIssuesAddLabels.mockResolvedValue({});

      await client.addLabels('owner', 'repo', 1, ['bug', 'needs-review']);

      expect(mockIssuesAddLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: ['bug', 'needs-review'],
      });
    });
  });

  describe('removeLabel', () => {
    it('should remove a label from an issue', async () => {
      mockIssuesRemoveLabel.mockResolvedValue({});

      await client.removeLabel('owner', 'repo', 1, 'bug');

      expect(mockIssuesRemoveLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        name: 'bug',
      });
    });

    it('should ignore error if label does not exist', async () => {
      const error = new Error('Label does not exist');
      mockIssuesRemoveLabel.mockRejectedValue(error);

      // Should not throw
      await client.removeLabel('owner', 'repo', 1, 'nonexistent');
    });

    it('should throw error for other label removal failures', async () => {
      const error = new Error('Network error');
      mockIssuesRemoveLabel.mockRejectedValue(error);

      await expect(client.removeLabel('owner', 'repo', 1, 'bug')).rejects.toThrow('Network error');
    });
  });

  describe('getLabels', () => {
    it('should get labels on an issue', async () => {
      const mockLabels = [
        { name: 'bug', color: 'red' },
        { name: 'enhancement', color: 'blue' },
      ];
      mockIssuesListLabelsOnIssue.mockResolvedValue({ data: mockLabels });

      const result = await client.getLabels('owner', 'repo', 1);

      expect(mockIssuesListLabelsOnIssue).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
      });
      expect(result).toEqual(mockLabels);
    });
  });

  describe('hasLabel', () => {
    it('should return true if label exists', async () => {
      const mockLabels = [
        { name: 'bug', color: 'red' },
        { name: 'enhancement', color: 'blue' },
      ];
      mockIssuesListLabelsOnIssue.mockResolvedValue({ data: mockLabels });

      const result = await client.hasLabel('owner', 'repo', 1, 'bug');

      expect(result).toBe(true);
    });

    it('should return false if label does not exist', async () => {
      const mockLabels = [{ name: 'bug', color: 'red' }];
      mockIssuesListLabelsOnIssue.mockResolvedValue({ data: mockLabels });

      const result = await client.hasLabel('owner', 'repo', 1, 'nonexistent');

      expect(result).toBe(false);
    });
  });
});
