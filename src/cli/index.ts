#!/usr/bin/env node

import { Command } from 'commander';
import { statusCommand } from './commands/status';
import { suggestionsCommand } from './commands/suggestions';
import { recommendCommand } from './commands/recommend';
import { createIssueCommand } from './commands/create-issue';
import { waitCommand } from './commands/wait';

const program = new Command();

program
  .name('ai-pr')
  .description('CLI tool for AI PR Reviewer')
  .version('1.0.0');

/**
 * Parse owner/repo#pr format
 */
export function parsePRIdentifier(identifier: string): { owner: string; repo: string; pr: number } | null {
  // Format: owner/repo#pr or owner/repo/pr
  const match = identifier.match(/^([^/]+)\/([^/#]+)[#/](\d+)$/);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
    pr: parseInt(match[3], 10),
  };
}

// Status command
program
  .command('status <owner/repo#pr>')
  .description('Get review status for a PR')
  .option('-i, --installation-id <id>', 'GitHub App installation ID', (val) => parseInt(val, 10))
  .option('--api-url <url>', 'API base URL', 'http://localhost:3000')
  .action(async (identifier, options) => {
    const parsed = parsePRIdentifier(identifier);
    if (!parsed) {
      console.error('Invalid PR identifier. Use format: owner/repo#pr');
      process.exit(1);
    }
    await statusCommand(parsed, options);
  });

// Suggestions command
program
  .command('suggestions <owner/repo#pr>')
  .description('Get structured suggestions from review')
  .option('-i, --installation-id <id>', 'GitHub App installation ID', (val) => parseInt(val, 10))
  .option('--api-url <url>', 'API base URL', 'http://localhost:3000')
  .action(async (identifier, options) => {
    const parsed = parsePRIdentifier(identifier);
    if (!parsed) {
      console.error('Invalid PR identifier. Use format: owner/repo#pr');
      process.exit(1);
    }
    await suggestionsCommand(parsed, options);
  });

// Recommend command
program
  .command('recommend <owner/repo#pr>')
  .description('Get merge recommendation')
  .option('-i, --installation-id <id>', 'GitHub App installation ID', (val) => parseInt(val, 10))
  .option('--api-url <url>', 'API base URL', 'http://localhost:3000')
  .action(async (identifier, options) => {
    const parsed = parsePRIdentifier(identifier);
    if (!parsed) {
      console.error('Invalid PR identifier. Use format: owner/repo#pr');
      process.exit(1);
    }
    await recommendCommand(parsed, options);
  });

// Create issue command
program
  .command('create-issue <owner/repo#pr>')
  .description('Create GitHub issue from suggestion')
  .requiredOption('--title <title>', 'Issue title')
  .requiredOption('--body <body>', 'Issue body')
  .option('-i, --installation-id <id>', 'GitHub App installation ID', (val) => parseInt(val, 10))
  .option('--suggestion-id <id>', 'Suggestion ID')
  .option('--priority <priority>', 'Priority (low, medium, high)', 'medium')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--api-url <url>', 'API base URL', 'http://localhost:3000')
  .action(async (identifier, options) => {
    const parsed = parsePRIdentifier(identifier);
    if (!parsed) {
      console.error('Invalid PR identifier. Use format: owner/repo#pr');
      process.exit(1);
    }
    await createIssueCommand(parsed, options);
  });

// Wait command
program
  .command('wait <owner/repo#pr>')
  .description('Wait for review to complete')
  .option('-i, --installation-id <id>', 'GitHub App installation ID', (val) => parseInt(val, 10))
  .option('--api-url <url>', 'API base URL', 'http://localhost:3000')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .option('--interval <seconds>', 'Poll interval in seconds', '5')
  .action(async (identifier, options) => {
    const parsed = parsePRIdentifier(identifier);
    if (!parsed) {
      console.error('Invalid PR identifier. Use format: owner/repo#pr');
      process.exit(1);
    }
    await waitCommand(parsed, options);
  });

// Parse arguments
program.parse(process.argv);

