import { PR_LIMITS, DEFAULT_IGNORE_PATTERNS } from '../config/constants';
import * as path from 'path';

/**
 * Truncate a single file's diff if it exceeds the limit
 */
export function truncateDiff(
  diff: string,
  maxLines: number = PR_LIMITS.MAX_DIFF_LINES_PER_FILE,
  maxChars: number = PR_LIMITS.MAX_DIFF_CHARS_PER_FILE
): { content: string; truncated: boolean; originalLines: number } {
  const lines = diff.split('\n');
  const originalLines = lines.length;
  
  let truncated = false;
  let result = diff;
  
  // Truncate by line count
  if (lines.length > maxLines) {
    const halfLimit = Math.floor(maxLines / 2);
    const firstHalf = lines.slice(0, halfLimit);
    const lastHalf = lines.slice(-halfLimit);
    const omittedCount = lines.length - maxLines;
    
    result = [
      ...firstHalf,
      '',
      `... [${omittedCount} lines omitted for brevity] ...`,
      '',
      ...lastHalf,
    ].join('\n');
    truncated = true;
  }
  
  // Truncate by character count
  if (result.length > maxChars) {
    result = result.substring(0, maxChars) + '\n\n... [diff truncated due to size] ...';
    truncated = true;
  }
  
  return { content: result, truncated, originalLines };
}

/**
 * Truncate total diff content across all files
 */
export function truncateTotalDiff(
  diffs: Array<{ filename: string; diff: string }>,
  maxTotalLines: number = PR_LIMITS.MAX_TOTAL_DIFF_LINES
): Array<{ filename: string; diff: string; truncated: boolean; skipped: boolean }> {
  let totalLines = 0;
  const results: Array<{ filename: string; diff: string; truncated: boolean; skipped: boolean }> = [];
  
  for (const { filename, diff } of diffs) {
    const lines = diff.split('\n').length;
    
    if (totalLines >= maxTotalLines) {
      // Skip remaining files entirely
      results.push({
        filename,
        diff: `... [file skipped - total diff limit reached] ...`,
        truncated: true,
        skipped: true,
      });
      continue;
    }
    
    const remainingLines = maxTotalLines - totalLines;
    
    if (lines > remainingLines) {
      // Truncate this file to fit remaining budget
      const truncated = truncateDiff(diff, remainingLines);
      results.push({
        filename,
        diff: truncated.content,
        truncated: true,
        skipped: false,
      });
      totalLines = maxTotalLines;
    } else {
      // Include full diff
      results.push({
        filename,
        diff,
        truncated: false,
        skipped: false,
      });
      totalLines += lines;
    }
  }
  
  return results;
}

/**
 * Check if a file path matches any of the ignore patterns
 */
export function shouldIgnoreFile(
  filePath: string,
  ignorePatterns: string[] = DEFAULT_IGNORE_PATTERNS
): boolean {
  const filename = path.basename(filePath);
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const pattern of ignorePatterns) {
    // Handle glob patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      
      const regex = new RegExp(`^${regexPattern}$|/${regexPattern}$|^${regexPattern}/|/${regexPattern}/`);
      
      if (regex.test(normalizedPath) || regex.test(filename)) {
        return true;
      }
    } else {
      // Exact match
      if (normalizedPath === pattern || filename === pattern || normalizedPath.endsWith(`/${pattern}`)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Format PR title to ensure it meets conventions
 */
export function formatPRTitle(title: string, maxLength: number = 72): string {
  let formatted = title.trim();
  
  if (formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength - 3) + '...';
  }
  
  return formatted;
}

/**
 * Format commit message with proper structure
 */
export function formatCommitMessage(
  title: string,
  body?: string,
  footer?: string
): string {
  const parts = [formatPRTitle(title, 72)];
  
  if (body) {
    parts.push('');
    parts.push(body);
  }
  
  if (footer) {
    parts.push('');
    parts.push(footer);
  }
  
  return parts.join('\n');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format diff for AI consumption with context
 */
export function formatDiffForAI(
  filename: string,
  diff: string,
  additions: number,
  deletions: number
): string {
  return `### File: ${filename}
**Changes:** +${additions} -${deletions}

\`\`\`diff
${diff}
\`\`\``;
}

