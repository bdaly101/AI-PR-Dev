import { GitHubClient } from '../github/client';
import { 
  parseCommand, 
  ParsedCommand, 
  COMMANDS, 
  generateHelpText,
  isDevAgentCommand,
  CommandName,
} from './parser';
import { checkPermission, formatPermissionDenied } from './permissions';
import { reviewService } from '../services/reviewService';
import { devAgentService } from '../services/devAgentService';
import { loadRepoConfig } from '../config/repoConfig';
import { logger, logPRReview } from '../utils/logging';
import { auditRepo } from '../database/repositories/auditRepo';

/**
 * Command context containing all info needed to handle a command
 */
export interface CommandContext {
  owner: string;
  repo: string;
  pullNumber: number;
  installationId: number;
  commentId: number;
  username: string;
  commentBody: string;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  prNumber?: number;
}

/**
 * Handle a slash command from a PR comment
 */
export async function handleCommand(ctx: CommandContext): Promise<CommandResult> {
  const cmdLogger = logPRReview(logger, ctx.owner, ctx.repo, ctx.pullNumber, {
    username: ctx.username,
    commentId: ctx.commentId,
  });

  // Parse the command
  const parsed = parseCommand(ctx.commentBody);
  
  if (!parsed) {
    // Not a command, ignore
    return { success: true };
  }

  cmdLogger.info({ command: parsed.command, args: parsed.args }, 'Processing slash command');

  const client = new GitHubClient(ctx.installationId);

  // React to acknowledge we received the command
  try {
    await client.addReaction(ctx.owner, ctx.repo, ctx.commentId, 'eyes');
  } catch (e) {
    // Non-critical, continue
    cmdLogger.debug('Could not add reaction to comment');
  }

  // Check if command is valid
  if (!parsed.isValid) {
    await client.createIssueComment(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      `⚠️ ${parsed.errorMessage}\n\n${generateHelpText()}`
    );
    return { success: false, message: parsed.errorMessage };
  }

  // Check user permissions
  const permCheck = await checkPermission(
    client,
    ctx.owner,
    ctx.repo,
    ctx.username,
    parsed.command
  );

  if (!permCheck.allowed) {
    const message = formatPermissionDenied(permCheck, parsed.command);
    await client.createIssueComment(ctx.owner, ctx.repo, ctx.pullNumber, message);
    
    // Log the denied attempt
    auditRepo.log({
      timestamp: new Date().toISOString(),
      action: 'command_denied',
      triggered_by: ctx.username,
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.pullNumber,
      success: 0,
      error_message: `Permission denied: ${parsed.command}`,
    });

    return { success: false, message: permCheck.reason };
  }

  // Load repo config
  const config = await loadRepoConfig(client, ctx.owner, ctx.repo);

  // Check if AI is enabled for this repo
  if (!config.enabled && parsed.command !== COMMANDS.HELP && parsed.command !== COMMANDS.CONFIG) {
    await client.createIssueComment(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      `⚠️ AI PR Reviewer is disabled for this repository.\n\nTo enable, add a \`.ai-pr-reviewer.yml\` file with \`enabled: true\`.`
    );
    return { success: false, message: 'AI disabled for repository' };
  }

  // Check if Dev Agent is enabled for agent commands
  if (isDevAgentCommand(parsed.command) && !config.devAgent.enabled) {
    await client.createIssueComment(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      `⚠️ Dev Agent features are disabled for this repository.\n\nTo enable, add to \`.ai-pr-reviewer.yml\`:\n\`\`\`yaml\ndevAgent:\n  enabled: true\n\`\`\``
    );
    return { success: false, message: 'Dev Agent disabled for repository' };
  }

  // Execute the command
  try {
    const result = await executeCommand(parsed, ctx, client, config);
    
    // Add success reaction
    try {
      await client.addReaction(ctx.owner, ctx.repo, ctx.commentId, 'rocket');
    } catch (e) {
      // Non-critical
    }

    // Log successful execution
    auditRepo.log({
      timestamp: new Date().toISOString(),
      action: `command_${parsed.command.replace('/ai-', '')}`,
      triggered_by: ctx.username,
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.pullNumber,
      pr_number: result.prNumber,
      success: 1,
    });

    return result;
  } catch (error) {
    cmdLogger.error({ error, command: parsed.command }, 'Command execution failed');
    
    // Post error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await client.createIssueComment(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      `❌ Failed to execute \`${parsed.command}\`\n\n**Error:** ${errorMessage}\n\n*Please try again or check the logs for more details.*`
    );

    // Log failure
    auditRepo.log({
      timestamp: new Date().toISOString(),
      action: `command_${parsed.command.replace('/ai-', '')}_failed`,
      triggered_by: ctx.username,
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.pullNumber,
      success: 0,
      error_message: errorMessage,
    });

    return { success: false, message: errorMessage };
  }
}

/**
 * Execute a specific command
 */
async function executeCommand(
  parsed: ParsedCommand,
  ctx: CommandContext,
  client: GitHubClient,
  config: import('../config/repoConfig').RepoConfig
): Promise<CommandResult> {
  switch (parsed.command) {
    case COMMANDS.HELP:
      return handleHelpCommand(ctx, client);

    case COMMANDS.CONFIG:
      return handleConfigCommand(ctx, client, config);

    case COMMANDS.REVIEW:
      return handleReviewCommand(ctx, parsed);

    case COMMANDS.FIX_LINTS:
      return handleFixLintsCommand(ctx, parsed, client);

    case COMMANDS.ADD_TYPES:
      return handleAddTypesCommand(ctx, parsed, client);

    case COMMANDS.IMPROVE_DOCS:
      return handleImproveDocsCommand(ctx, parsed, client);

    default:
      return { success: false, message: 'Unknown command' };
  }
}

/**
 * Handle /ai-help command
 */
async function handleHelpCommand(
  ctx: CommandContext,
  client: GitHubClient
): Promise<CommandResult> {
  await client.createIssueComment(ctx.owner, ctx.repo, ctx.pullNumber, generateHelpText());
  return { success: true };
}

/**
 * Handle /ai-config command
 */
async function handleConfigCommand(
  ctx: CommandContext,
  client: GitHubClient,
  config: import('../config/repoConfig').RepoConfig
): Promise<CommandResult> {
  const configYaml = formatConfigForDisplay(config);
  
  await client.createIssueComment(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    `## 🔧 Current Configuration\n\n\`\`\`yaml\n${configYaml}\n\`\`\`\n\n*Configuration is loaded from \`.ai-pr-reviewer.yml\` in the repository root.*`
  );
  
  return { success: true };
}

/**
 * Handle /ai-review command
 */
async function handleReviewCommand(
  ctx: CommandContext,
  parsed: ParsedCommand
): Promise<CommandResult> {
  // Post acknowledgment
  const client = new GitHubClient(ctx.installationId);
  await client.createIssueComment(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    '🔍 Starting AI code review...'
  );

  // Trigger review (this will post its own detailed response)
  await reviewService.reviewPullRequest(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    ctx.installationId
  );

  return { success: true };
}

/**
 * Handle /ai-fix-lints command
 */
async function handleFixLintsCommand(
  ctx: CommandContext,
  parsed: ParsedCommand,
  client: GitHubClient
): Promise<CommandResult> {
  const isDryRun = parsed.args.dryRun ?? false;
  const scope = parsed.args.scope;

  if (isDryRun) {
    await client.createIssueComment(
      ctx.owner,
      ctx.repo,
      ctx.pullNumber,
      `🔍 **Dry Run Mode**\n\nAnalyzing lint issues${scope ? ` in \`${scope}\`` : ''}...\n\n*This is a preview only. No changes will be made.*`
    );
    // TODO: Implement dry-run analysis in M7
    return { success: true, message: 'Dry run completed' };
  }

  // Full execution
  await client.createIssueComment(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    `🤖 AI Dev Agent is analyzing lint issues${scope ? ` in \`${scope}\`` : ''}...\n\n*A new PR will be created with the fixes.*`
  );

  await devAgentService.handleFixLints(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    ctx.installationId
  );

  return { success: true };
}

/**
 * Handle /ai-add-types command
 */
async function handleAddTypesCommand(
  ctx: CommandContext,
  parsed: ParsedCommand,
  client: GitHubClient
): Promise<CommandResult> {
  const isDryRun = parsed.args.dryRun ?? false;
  const scope = parsed.args.scope;

  await client.createIssueComment(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    `🤖 AI Dev Agent: \`/ai-add-types\` command received${scope ? ` for \`${scope}\`` : ''}.\n\n⚠️ *This feature is coming in a future update. Stay tuned!*`
  );

  // TODO: Implement in M7/M8
  return { success: true, message: 'Feature not yet implemented' };
}

/**
 * Handle /ai-improve-docs command
 */
async function handleImproveDocsCommand(
  ctx: CommandContext,
  parsed: ParsedCommand,
  client: GitHubClient
): Promise<CommandResult> {
  const isDryRun = parsed.args.dryRun ?? false;
  const scope = parsed.args.scope;

  await client.createIssueComment(
    ctx.owner,
    ctx.repo,
    ctx.pullNumber,
    `🤖 AI Dev Agent: \`/ai-improve-docs\` command received${scope ? ` for \`${scope}\`` : ''}.\n\n⚠️ *This feature is coming in a future update. Stay tuned!*`
  );

  // TODO: Implement in M7/M8
  return { success: true, message: 'Feature not yet implemented' };
}

/**
 * Format config for display
 */
function formatConfigForDisplay(config: import('../config/repoConfig').RepoConfig): string {
  return `version: ${config.version}
enabled: ${config.enabled}
mode: ${config.mode}

reviewer:
  strictness: ${config.reviewer.strictness}
  minSeverity: ${config.reviewer.minSeverity}
  maxFilesReviewed: ${config.reviewer.maxFilesReviewed}
  ignorePaths: ${config.reviewer.ignorePaths.length} patterns

ai:
  provider: ${config.ai.provider}
  model: ${config.ai.model || '(default)'}
  temperature: ${config.ai.temperature}

devAgent:
  enabled: ${config.devAgent.enabled}
  maxFilesPerPR: ${config.devAgent.maxFilesPerPR}
  maxLinesChanged: ${config.devAgent.maxLinesChanged}`;
}

