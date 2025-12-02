import { GitHubClient } from './client';
import { PR_LIMITS } from '../config/constants';
import { truncateDiff, truncateTotalDiff, shouldIgnoreFile, formatDiffForAI } from '../utils/formatters';
import { prContextRepo } from '../database/repositories/prContextRepo';
import { logger } from '../utils/logging';

/**
 * Represents a changed file in a PR
 */
export interface PRFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
  truncated: boolean;
  skipped: boolean;
  skipReason?: string;
}

/**
 * Complete PR context for AI review
 */
export interface PRContext {
  // Metadata
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  description: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  commitSha: string;
  
  // Statistics
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  reviewedFiles: number;
  skippedFiles: number;
  truncatedFiles: number;
  
  // Files and diffs
  files: PRFile[];
  
  // Formatted diff for AI consumption
  formattedDiff: string;
  
  // Warnings/notes for the review
  warnings: string[];
  
  // Cache info
  fromCache: boolean;
  fetchedAt: string;
}

/**
 * Fetch complete PR context with pagination, truncation, and caching
 */
export async function fetchPRContext(
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  options: {
    useCache?: boolean;
    ignorePatterns?: string[];
    maxFiles?: number;
  } = {}
): Promise<PRContext> {
  const {
    useCache = true,
    ignorePatterns = [],
    maxFiles = PR_LIMITS.MAX_FILES_PER_REVIEW,
  } = options;

  const prLogger = logger.child({ owner, repo, pullNumber });
  
  // Get PR metadata first to get commit SHA
  prLogger.info('Fetching PR metadata');
  const pr = await client.getPullRequest(owner, repo, pullNumber);
  const commitSha = pr.head.sha;
  
  // Check cache
  if (useCache) {
    const cached = prContextRepo.getCachedContext(owner, repo, pullNumber, commitSha);
    if (cached) {
      prLogger.info({ commitSha }, 'Using cached PR context');
      const context = JSON.parse(cached.context_data) as PRContext;
      return { ...context, fromCache: true };
    }
  }
  
  prLogger.info({ commitSha }, 'Fetching fresh PR context');
  
  // Fetch all files with pagination
  const allFiles = await fetchAllPRFiles(client, owner, repo, pullNumber);
  
  const warnings: string[] = [];
  const processedFiles: PRFile[] = [];
  let reviewedFiles = 0;
  let skippedFiles = 0;
  let truncatedFiles = 0;
  
  // Process files
  for (const file of allFiles) {
    // Check if we've hit the file limit
    if (reviewedFiles >= maxFiles) {
      processedFiles.push({
        filename: file.filename,
        status: file.status as PRFile['status'],
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        truncated: false,
        skipped: true,
        skipReason: 'File limit reached',
      });
      skippedFiles++;
      continue;
    }
    
    // Check ignore patterns
    if (shouldIgnoreFile(file.filename, ignorePatterns)) {
      processedFiles.push({
        filename: file.filename,
        status: file.status as PRFile['status'],
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        truncated: false,
        skipped: true,
        skipReason: 'Matches ignore pattern',
      });
      skippedFiles++;
      continue;
    }
    
    // Check if patch exists (binary files don't have patches)
    if (!file.patch) {
      processedFiles.push({
        filename: file.filename,
        status: file.status as PRFile['status'],
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        truncated: false,
        skipped: true,
        skipReason: 'Binary or empty file',
      });
      skippedFiles++;
      continue;
    }
    
    // Truncate large diffs
    const { content, truncated } = truncateDiff(file.patch);
    
    if (truncated) {
      truncatedFiles++;
    }
    
    processedFiles.push({
      filename: file.filename,
      status: file.status as PRFile['status'],
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: content,
      previousFilename: file.previous_filename,
      truncated,
      skipped: false,
    });
    
    reviewedFiles++;
  }
  
  // Apply total diff truncation
  const diffsForTruncation = processedFiles
    .filter(f => !f.skipped && f.patch)
    .map(f => ({ filename: f.filename, diff: f.patch! }));
  
  const truncatedDiffs = truncateTotalDiff(diffsForTruncation);
  
  // Update files with truncation results and build formatted diff
  const formattedDiffParts: string[] = [];
  
  for (const truncatedDiff of truncatedDiffs) {
    const file = processedFiles.find(f => f.filename === truncatedDiff.filename);
    if (file) {
      if (truncatedDiff.skipped) {
        file.skipped = true;
        file.skipReason = 'Total diff limit reached';
        skippedFiles++;
        reviewedFiles--;
      } else if (truncatedDiff.truncated && !file.truncated) {
        file.truncated = true;
        truncatedFiles++;
      }
      
      if (!file.skipped) {
        formattedDiffParts.push(
          formatDiffForAI(file.filename, truncatedDiff.diff, file.additions, file.deletions)
        );
      }
    }
  }
  
  // Generate warnings
  if (allFiles.length > maxFiles) {
    warnings.push(`PR has ${allFiles.length} files, only reviewing first ${maxFiles}`);
  }
  if (truncatedFiles > 0) {
    warnings.push(`${truncatedFiles} file(s) had their diffs truncated due to size`);
  }
  if (skippedFiles > 0) {
    warnings.push(`${skippedFiles} file(s) were skipped (ignored patterns, binary files, or limits)`);
  }
  
  const context: PRContext = {
    owner,
    repo,
    pullNumber,
    title: pr.title,
    description: pr.body || '',
    author: pr.user?.login || 'unknown',
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    commitSha,
    totalFiles: allFiles.length,
    totalAdditions: allFiles.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: allFiles.reduce((sum, f) => sum + f.deletions, 0),
    reviewedFiles,
    skippedFiles,
    truncatedFiles,
    files: processedFiles,
    formattedDiff: formattedDiffParts.join('\n\n---\n\n'),
    warnings,
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
  
  // Cache the context
  if (useCache) {
    prLogger.info('Caching PR context');
    prContextRepo.cacheContext(owner, repo, pullNumber, commitSha, JSON.stringify(context));
  }
  
  prLogger.info({
    totalFiles: context.totalFiles,
    reviewedFiles: context.reviewedFiles,
    skippedFiles: context.skippedFiles,
    truncatedFiles: context.truncatedFiles,
  }, 'PR context fetched successfully');
  
  return context;
}

/**
 * Fetch all PR files with pagination
 */
async function fetchAllPRFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<Array<{
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}>> {
  // GitHub returns max 3000 files, paginated at 100 per page
  const allFiles: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    previous_filename?: string;
  }> = [];
  
  let page = 1;
  const perPage = 100;
  let hasMore = true;
  
  while (hasMore) {
    const files = await client.getPullRequestFilesPaginated(owner, repo, pullNumber, page, perPage);
    
    allFiles.push(...files);
    
    if (files.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
    
    // Safety limit to prevent infinite loops
    if (page > 30) {
      logger.warn({ owner, repo, pullNumber }, 'Hit pagination safety limit (3000 files)');
      break;
    }
  }
  
  return allFiles;
}

/**
 * Check if a PR is too large to review
 */
export function isPRTooLarge(context: PRContext): boolean {
  return context.totalFiles > PR_LIMITS.MAX_FILES_PER_REVIEW * 2;
}

/**
 * Generate a summary for PRs that are too large to review
 */
export function generateLargePRSummary(context: PRContext): string {
  return `## ⚠️ PR Too Large for Detailed Review

This pull request contains **${context.totalFiles} files** with **+${context.totalAdditions}/-${context.totalDeletions}** changes, which exceeds the recommended limit for AI review.

### Summary
- **Title:** ${context.title}
- **Author:** @${context.author}
- **Branch:** \`${context.headBranch}\` → \`${context.baseBranch}\`

### Recommendation
Consider breaking this PR into smaller, focused pull requests for more effective review.

---
*AI review skipped due to PR size. Use \`/ai-review\` on smaller PRs for detailed feedback.*`;
}

