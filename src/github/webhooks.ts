import { Webhooks } from '@octokit/webhooks';
import { config } from '../config/env';
import { reviewService } from '../services/reviewService';
import { devAgentService } from '../services/devAgentService';
import { logger, logPRReview, logError } from '../utils/logging';

export const webhooks = new Webhooks({
  secret: config.github.webhookSecret,
});

// Handle pull request events for code review
webhooks.on('pull_request.opened', async ({ payload }) => {
  const prLogger = logPRReview(
    logger,
    payload.repository.owner.login,
    payload.repository.name,
    payload.pull_request.number,
    { event: 'pull_request.opened', commitSha: payload.pull_request.head.sha }
  );
  
  prLogger.info('PR opened event received');
  
  if (!payload.installation?.id) {
    prLogger.error('No installation ID found in payload');
    return;
  }

  await reviewService.reviewPullRequest(
    payload.repository.owner.login,
    payload.repository.name,
    payload.pull_request.number,
    payload.installation.id
  );
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  const prLogger = logPRReview(
    logger,
    payload.repository.owner.login,
    payload.repository.name,
    payload.pull_request.number,
    { event: 'pull_request.synchronize', commitSha: payload.pull_request.head.sha }
  );
  
  prLogger.info('PR synchronized event received');
  
  if (!payload.installation?.id) {
    prLogger.error('No installation ID found in payload');
    return;
  }

  await reviewService.reviewPullRequest(
    payload.repository.owner.login,
    payload.repository.name,
    payload.pull_request.number,
    payload.installation.id
  );
});

// Handle issue comments for slash commands
webhooks.on('issue_comment.created', async ({ payload }) => {
  // Only process comments on pull requests
  if (!payload.issue.pull_request) {
    return;
  }

  const comment = payload.comment.body.trim();
  const prLogger = logPRReview(
    logger,
    payload.repository.owner.login,
    payload.repository.name,
    payload.issue.number,
    { event: 'issue_comment.created', comment: comment.substring(0, 100) }
  );

  prLogger.info('Issue comment created on PR');

  if (!payload.installation?.id) {
    prLogger.error('No installation ID found in payload');
    return;
  }

  // Handle /ai-fix-lints command
  if (comment.startsWith('/ai-fix-lints')) {
    prLogger.info('Processing /ai-fix-lints command');
    await devAgentService.handleFixLints(
      payload.repository.owner.login,
      payload.repository.name,
      payload.issue.number,
      payload.installation.id
    );
  }
  
  // Handle /ai-review command
  if (comment.startsWith('/ai-review')) {
    prLogger.info('Processing /ai-review command');
    await reviewService.reviewPullRequest(
      payload.repository.owner.login,
      payload.repository.name,
      payload.issue.number,
      payload.installation.id
    );
  }
});

webhooks.onError((error) => {
  logError(logger, error, { context: 'webhook_handler' });
});
