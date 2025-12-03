import { GitHubClient } from '../github/client';
import { logger } from '../utils/logging';
import { CreateIssueRequest } from '../api/types';

class IssueService {
  /**
   * Create a GitHub issue from a review suggestion
   */
  async createIssueFromSuggestion(
    request: CreateIssueRequest,
    installationId: number
  ): Promise<{ issueNumber: number; url: string }> {
    const issueLogger = logger.child({ 
      owner: request.owner,
      repo: request.repo,
      pullNumber: request.pullNumber,
      component: 'issue-service',
    });

    try {
      issueLogger.info('Creating issue from suggestion');

      const client = new GitHubClient(installationId);

      // Build issue body with context
      let body = request.body;
      
      // Add link to PR if provided
      if (request.pullNumber) {
        body += `\n\n---\n**Related PR:** #${request.pullNumber}`;
      }

      // Add suggestion ID if provided
      if (request.suggestionId) {
        body += `\n**Suggestion ID:** ${request.suggestionId}`;
      }

      // Prepare labels
      const labels: string[] = [...(request.labels || [])];

      // Add priority label
      if (request.priority) {
        labels.push(`priority:${request.priority}`);
      }

      // Add category labels based on common patterns
      const bodyLower = body.toLowerCase();
      if (bodyLower.includes('security') || bodyLower.includes('vulnerability')) {
        labels.push('security');
      }
      if (bodyLower.includes('performance') || bodyLower.includes('slow')) {
        labels.push('performance');
      }
      if (bodyLower.includes('bug') || bodyLower.includes('error')) {
        labels.push('bug');
      }

      // Create the issue
      const issue = await client.createIssue(
        request.owner,
        request.repo,
        request.title,
        body,
        labels.length > 0 ? labels : undefined
      );

      issueLogger.info({ issueNumber: issue.number }, 'Issue created successfully');

      // Link issue to PR if PR number is provided
      if (request.pullNumber) {
        try {
          const comment = `Related issue: #${issue.number}`;
          await client.createIssueComment(
            request.owner,
            request.repo,
            request.pullNumber,
            comment
          );
          issueLogger.debug('Linked issue to PR');
        } catch (linkError) {
          issueLogger.warn({ error: linkError }, 'Failed to link issue to PR');
          // Don't fail if linking fails
        }
      }

      return {
        issueNumber: issue.number,
        url: issue.html_url,
      };
    } catch (error) {
      issueLogger.error({ error }, 'Failed to create issue');
      throw error;
    }
  }
}

export const issueService = new IssueService();

