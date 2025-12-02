import { Webhooks } from '@octokit/webhooks';
import { config } from '../config/env';
import { reviewService } from '../services/reviewService';
import { devAgentService } from '../services/devAgentService';

export const webhooks = new Webhooks({
  secret: config.github.webhookSecret,
});

// Handle pull request events for code review
webhooks.on('pull_request.opened', async ({ payload }) => {
  console.log(`PR opened: ${payload.repository.full_name}#${payload.pull_request.number}`);
  
  if (!payload.installation?.id) {
    console.error('No installation ID found in payload');
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
  console.log(`PR synchronized: ${payload.repository.full_name}#${payload.pull_request.number}`);
  
  if (!payload.installation?.id) {
    console.error('No installation ID found in payload');
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
  console.log(`Comment on PR ${payload.repository.full_name}#${payload.issue.number}: ${comment}`);

  if (!payload.installation?.id) {
    console.error('No installation ID found in payload');
    return;
  }

  // Handle /ai-fix-lints command
  if (comment.startsWith('/ai-fix-lints')) {
    await devAgentService.handleFixLints(
      payload.repository.owner.login,
      payload.repository.name,
      payload.issue.number,
      payload.installation.id
    );
  }
  
  // Handle /ai-review command
  if (comment.startsWith('/ai-review')) {
    await reviewService.reviewPullRequest(
      payload.repository.owner.login,
      payload.repository.name,
      payload.issue.number,
      payload.installation.id
    );
  }
});

webhooks.onError((error) => {
  console.error('Webhook error:', error);
});
