import { GitHubClient } from '../github/client';
import { logger } from '../utils/logging';
import { CommandName, COMMANDS, isDevAgentCommand } from './parser';

/**
 * Permission levels for command execution
 */
export type PermissionLevel = 'admin' | 'write' | 'read' | 'none';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  userPermission: PermissionLevel;
  requiredPermission: PermissionLevel;
  reason?: string;
}

/**
 * Get the required permission level for a command
 */
export function getRequiredPermission(command: CommandName): PermissionLevel {
  // Commands that modify the repository need write access
  if (isDevAgentCommand(command)) {
    return 'write';
  }
  
  // Review and help commands only need read access
  switch (command) {
    case COMMANDS.REVIEW:
    case COMMANDS.HELP:
    case COMMANDS.CONFIG:
      return 'read';
    default:
      return 'write';
  }
}

/**
 * Check if a user has permission to execute a command
 */
export async function checkPermission(
  client: GitHubClient,
  owner: string,
  repo: string,
  username: string,
  command: CommandName
): Promise<PermissionCheckResult> {
  const requiredPermission = getRequiredPermission(command);
  
  try {
    const userPermission = await getUserPermissionLevel(client, owner, repo, username);
    
    const allowed = hasRequiredPermission(userPermission, requiredPermission);
    
    logger.debug({
      username,
      command,
      userPermission,
      requiredPermission,
      allowed,
    }, 'Permission check completed');
    
    return {
      allowed,
      userPermission,
      requiredPermission,
      reason: allowed 
        ? undefined 
        : `You need ${requiredPermission} permission to use \`${command}\`. Your permission level: ${userPermission}`,
    };
  } catch (error) {
    logger.warn({ error, username, owner, repo }, 'Failed to check user permission');
    
    // Default to denying if we can't check permissions
    return {
      allowed: false,
      userPermission: 'none',
      requiredPermission,
      reason: 'Unable to verify your permissions. Please ensure you are a collaborator on this repository.',
    };
  }
}

/**
 * Get a user's permission level on a repository
 */
async function getUserPermissionLevel(
  client: GitHubClient,
  owner: string,
  repo: string,
  username: string
): Promise<PermissionLevel> {
  const permission = await client.getCollaboratorPermission(owner, repo, username);
  
  switch (permission) {
    case 'admin':
      return 'admin';
    case 'write':
    case 'maintain':
      return 'write';
    case 'read':
    case 'triage':
      return 'read';
    default:
      return 'none';
  }
}

/**
 * Check if a permission level meets the required level
 */
function hasRequiredPermission(
  userPermission: PermissionLevel,
  requiredPermission: PermissionLevel
): boolean {
  const permissionHierarchy: Record<PermissionLevel, number> = {
    admin: 4,
    write: 3,
    read: 2,
    none: 1,
  };
  
  return permissionHierarchy[userPermission] >= permissionHierarchy[requiredPermission];
}

/**
 * Format permission denied message
 */
export function formatPermissionDenied(result: PermissionCheckResult, command: CommandName): string {
  return `⛔ **Permission Denied**

You don't have permission to use \`${command}\`.

- **Your permission:** ${result.userPermission}
- **Required permission:** ${result.requiredPermission}

${result.reason || ''}

*Contact a repository admin if you believe you should have access.*`;
}

/**
 * Check if the bot itself has required permissions
 */
export async function checkBotPermissions(
  client: GitHubClient,
  owner: string,
  repo: string
): Promise<{ canRead: boolean; canWrite: boolean; canCreatePR: boolean }> {
  try {
    // Try to read repo info to verify read access
    await client.getDefaultBranch(owner, repo);
    const canRead = true;
    
    // For write access, we'd need to check installation permissions
    // For now, assume if we can read, we probably have the configured permissions
    const canWrite = true;
    const canCreatePR = true;
    
    return { canRead, canWrite, canCreatePR };
  } catch (error) {
    logger.warn({ error, owner, repo }, 'Bot permission check failed');
    return { canRead: false, canWrite: false, canCreatePR: false };
  }
}

