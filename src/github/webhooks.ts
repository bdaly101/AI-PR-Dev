import { Webhooks } from '@octokit/webhooks';
import { config } from '../config/env';
import { reviewService } from '../services/reviewService';
import { handleCommand } from '../commands/handler';
import { isSlashCommand } from '../commands/parser';
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
    { 
      event: 'issue_comment.created', 
      comment: comment.substring(0, 100),
      username: payload.comment.user.login,
    }
  );

  // Check if this is a slash command
  if (!isSlashCommand(comment)) {
    return;
  }

  prLogger.info('Slash command detected');

  if (!payload.installation?.id) {
    prLogger.error('No installation ID found in payload');
    return;
  }

  // Ignore comments from bots to prevent loops
  if (payload.comment.user.type === 'Bot') {
    prLogger.debug('Ignoring bot comment');
    return;
  }

  // Handle the command through the new command system
  await handleCommand({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    pullNumber: payload.issue.number,
    installationId: payload.installation.id,
    commentId: payload.comment.id,
    username: payload.comment.user.login,
    commentBody: comment,
  });
});

// Handle PR review comments (inline comments) for slash commands
webhooks.on('pull_request_review_comment.created', async ({ payload }) => {
  const comment = payload.comment.body.trim();
  
  // Check if this is a slash command
  if (!isSlashCommand(comment)) {
    return;
  }

  const prLogger = logPRReview(
    logger,
    payload.repository.owner.login,
    payload.repository.name,
    payload.pull_request.number,
    { 
      event: 'pull_request_review_comment.created',
      comment: comment.substring(0, 100),
      username: payload.comment.user.login,
    }
  );

  prLogger.info('Slash command detected in review comment');

  if (!payload.installation?.id) {
    prLogger.error('No installation ID found in payload');
    return;
  }

  // Ignore comments from bots
  if (payload.comment.user.type === 'Bot') {
    prLogger.debug('Ignoring bot comment');
    return;
  }

  // Handle the command
  await handleCommand({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    pullNumber: payload.pull_request.number,
    installationId: payload.installation.id,
    commentId: payload.comment.id,
    username: payload.comment.user.login,
    commentBody: comment,
  });
});

webhooks.onError((error) => {
  logError(logger, error, { context: 'webhook_handler' });
});
