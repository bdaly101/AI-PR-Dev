import { z } from 'zod';

/**
 * Supported slash commands
 */
export const COMMANDS = {
  REVIEW: '/ai-review',
  EXPLAIN: '/ai-explain',
  FIX_LINTS: '/ai-fix-lints',
  ADD_TYPES: '/ai-add-types',
  IMPROVE_DOCS: '/ai-improve-docs',
  APPROVE: '/ai-approve',
  REJECT: '/ai-reject',
  HELP: '/ai-help',
  CONFIG: '/ai-config',
} as const;

export type CommandName = typeof COMMANDS[keyof typeof COMMANDS];

/**
 * Command argument schema
 */
export const CommandArgsSchema = z.object({
  scope: z.string().optional(), // e.g., file path or directory
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  planId: z.string().optional(), // for approve/reject commands
});

export type CommandArgs = z.infer<typeof CommandArgsSchema>;

/**
 * Parsed command result
 */
export interface ParsedCommand {
  command: CommandName;
  args: CommandArgs;
  rawArgs: string;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Check if a string starts with any AI command
 */
export function isSlashCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return Object.values(COMMANDS).some(cmd => trimmed.startsWith(cmd));
}

/**
 * Parse a slash command from a comment body
 */
export function parseCommand(commentBody: string): ParsedCommand | null {
  const trimmed = commentBody.trim();
  
  // Check if it starts with /ai-
  if (!trimmed.toLowerCase().startsWith('/ai-')) {
    return null;
  }

  // Extract the command (first word)
  const parts = trimmed.split(/\s+/);
  const commandStr = parts[0].toLowerCase();
  const rawArgs = parts.slice(1).join(' ');

  // Find matching command
  const matchedCommand = Object.values(COMMANDS).find(
    cmd => commandStr === cmd
  );

  if (!matchedCommand) {
    return {
      command: COMMANDS.HELP,
      args: {},
      rawArgs: '',
      isValid: false,
      errorMessage: `Unknown command: \`${commandStr}\`. Use \`/ai-help\` to see available commands.`,
    };
  }

  // Parse arguments (pass command for context-aware parsing)
  const args = parseArgs(rawArgs, matchedCommand);

  // Validate required args for specific commands
  if ((matchedCommand === COMMANDS.APPROVE || matchedCommand === COMMANDS.REJECT) && !args.planId) {
    return {
      command: matchedCommand,
      args,
      rawArgs,
      isValid: false,
      errorMessage: `Missing plan ID. Usage: \`${matchedCommand} <plan-id>\``,
    };
  }

  return {
    command: matchedCommand,
    args,
    rawArgs,
    isValid: true,
  };
}

/**
 * Parse command arguments
 * Supports: --flag, --key=value, positional args
 */
function parseArgs(rawArgs: string, command?: CommandName): CommandArgs {
  const args: CommandArgs = {};
  
  if (!rawArgs.trim()) {
    return args;
  }

  const parts = rawArgs.split(/\s+/);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Handle --dry-run or --dryRun
    if (part === '--dry-run' || part === '--dryRun') {
      args.dryRun = true;
      continue;
    }
    
    // Handle --force
    if (part === '--force') {
      args.force = true;
      continue;
    }
    
    // Handle --scope=path
    if (part.startsWith('--scope=')) {
      args.scope = part.substring(8);
      continue;
    }
    
    // Handle --plan=id
    if (part.startsWith('--plan=')) {
      args.planId = part.substring(7);
      continue;
    }
    
    // For approve/reject commands, first positional arg is planId
    if (!part.startsWith('--') && !args.planId && 
        (command === COMMANDS.APPROVE || command === COMMANDS.REJECT)) {
      args.planId = part;
      continue;
    }
    
    // For other commands, treat non-flag arguments as scope
    if (!part.startsWith('--') && !args.scope) {
      args.scope = part;
    }
  }

  return args;
}

/**
 * Get command description for help text
 */
export function getCommandDescription(command: CommandName): string {
  switch (command) {
    case COMMANDS.REVIEW:
      return 'Trigger a new AI code review on this PR';
    case COMMANDS.EXPLAIN:
      return 'Get AI explanation for code (supports follow-up questions)';
    case COMMANDS.FIX_LINTS:
      return 'Generate a change plan for lint fixes';
    case COMMANDS.ADD_TYPES:
      return 'Create a PR adding TypeScript type annotations';
    case COMMANDS.IMPROVE_DOCS:
      return 'Create a PR improving inline documentation';
    case COMMANDS.APPROVE:
      return 'Approve a pending change plan and create PR';
    case COMMANDS.REJECT:
      return 'Reject a pending change plan';
    case COMMANDS.HELP:
      return 'Show this help message';
    case COMMANDS.CONFIG:
      return 'Show current repository configuration';
    default:
      return 'Unknown command';
  }
}

/**
 * Get command usage example
 */
export function getCommandUsage(command: CommandName): string {
  switch (command) {
    case COMMANDS.REVIEW:
      return '/ai-review';
    case COMMANDS.EXPLAIN:
      return '/ai-explain [question]';
    case COMMANDS.FIX_LINTS:
      return '/ai-fix-lints [--dry-run] [--scope=path]';
    case COMMANDS.ADD_TYPES:
      return '/ai-add-types [--dry-run] [--scope=path]';
    case COMMANDS.IMPROVE_DOCS:
      return '/ai-improve-docs [--dry-run] [--scope=path]';
    case COMMANDS.APPROVE:
      return '/ai-approve <plan-id>';
    case COMMANDS.REJECT:
      return '/ai-reject <plan-id>';
    case COMMANDS.HELP:
      return '/ai-help';
    case COMMANDS.CONFIG:
      return '/ai-config';
    default:
      return command;
  }
}

/**
 * Generate help text for all commands
 */
export function generateHelpText(): string {
  const commands = Object.values(COMMANDS);
  
  let help = `## 🤖 AI PR Reviewer Commands\n\n`;
  help += `| Command | Description |\n`;
  help += `|---------|-------------|\n`;
  
  for (const cmd of commands) {
    help += `| \`${getCommandUsage(cmd)}\` | ${getCommandDescription(cmd)} |\n`;
  }
  
  help += `\n### Options\n\n`;
  help += `- \`--dry-run\`: Show proposed changes without creating a PR\n`;
  help += `- \`--scope=path\`: Limit changes to a specific file or directory\n`;
  help += `- \`--force\`: Skip confirmation for large changes\n`;
  help += `\n### Examples\n\n`;
  help += `\`\`\`\n`;
  help += `/ai-review                    # Run AI code review\n`;
  help += `/ai-explain                   # Explain code (use in review comment)\n`;
  help += `/ai-explain What does this do? # Ask specific question\n`;
  help += `/ai-fix-lints --dry-run       # Preview lint fixes\n`;
  help += `\`\`\`\n`;
  help += `\n---\n`;
  help += `*AI PR Reviewer • [Documentation](https://github.com/bdaly101/AI-PR-Dev)*`;
  
  return help;
}

/**
 * Check if a command requires Dev Agent features
 */
export function isDevAgentCommand(command: CommandName): boolean {
  const devAgentCommands: CommandName[] = [
    COMMANDS.FIX_LINTS,
    COMMANDS.ADD_TYPES,
    COMMANDS.IMPROVE_DOCS,
  ];
  return devAgentCommands.includes(command);
}

/**
 * Check if a command is read-only (doesn't create PRs)
 */
export function isReadOnlyCommand(command: CommandName): boolean {
  const readOnlyCommands: CommandName[] = [
    COMMANDS.REVIEW,
    COMMANDS.EXPLAIN,
    COMMANDS.HELP,
    COMMANDS.CONFIG,
  ];
  return readOnlyCommands.includes(command);
}

