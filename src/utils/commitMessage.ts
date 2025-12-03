/**
 * Commit message types following Conventional Commits
 */
export type CommitType = 
  | 'fix'      // Bug fixes
  | 'feat'     // New features
  | 'refactor' // Code refactoring
  | 'style'    // Code style changes (formatting, etc.)
  | 'docs'     // Documentation changes
  | 'test'     // Adding or updating tests
  | 'chore'    // Maintenance tasks
  | 'perf';    // Performance improvements

/**
 * Options for generating a commit message
 */
export interface CommitMessageOptions {
  type: CommitType;
  scope?: string;
  description: string;
  body?: string;
  breaking?: boolean;
  issues?: number[];
  coAuthors?: string[];
}

/**
 * Generate a structured commit message following Conventional Commits
 * 
 * Format: <type>(<scope>): <description>
 * 
 * [optional body]
 * 
 * [optional footer]
 */
export function generateCommitMessage(options: CommitMessageOptions): string {
  const { type, scope, description, body, breaking, issues, coAuthors } = options;

  // Build the header
  let header = type;
  if (scope) {
    header += `(${scope})`;
  }
  if (breaking) {
    header += '!';
  }
  header += `: ${description}`;

  // Ensure header is not too long (50 chars recommended, 72 max)
  if (header.length > 72) {
    const truncatedDesc = description.substring(0, 72 - type.length - (scope ? scope.length + 3 : 0) - (breaking ? 1 : 0) - 2);
    header = type;
    if (scope) {
      header += `(${scope})`;
    }
    if (breaking) {
      header += '!';
    }
    header += `: ${truncatedDesc}...`;
  }

  const parts: string[] = [header];

  // Add body if provided
  if (body) {
    parts.push(''); // Empty line before body
    // Wrap body at 72 characters
    const wrappedBody = wrapText(body, 72);
    parts.push(wrappedBody);
  }

  // Add footer with issues and co-authors
  const footerParts: string[] = [];

  if (breaking) {
    footerParts.push('BREAKING CHANGE: This commit introduces breaking changes.');
  }

  if (issues && issues.length > 0) {
    footerParts.push(`Fixes: ${issues.map(i => `#${i}`).join(', ')}`);
  }

  if (coAuthors && coAuthors.length > 0) {
    for (const author of coAuthors) {
      footerParts.push(`Co-authored-by: ${author}`);
    }
  }

  if (footerParts.length > 0) {
    parts.push(''); // Empty line before footer
    parts.push(footerParts.join('\n'));
  }

  return parts.join('\n');
}

/**
 * Wrap text at a specified line length
 */
function wrapText(text: string, maxLength: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Generate a commit message for AI-generated lint fixes
 */
export function generateLintFixCommitMessage(
  filesFixed: string[],
  issuesFixed: number,
  originalPR?: number
): string {
  const scope = filesFixed.length === 1 
    ? getFileScope(filesFixed[0])
    : filesFixed.length <= 3 
      ? 'multiple'
      : undefined;

  const description = issuesFixed === 1
    ? 'fix 1 lint issue'
    : `fix ${issuesFixed} lint issues`;

  let body = `Auto-generated lint fixes for ${filesFixed.length} file(s):\n`;
  for (const file of filesFixed.slice(0, 10)) {
    body += `- ${file}\n`;
  }
  if (filesFixed.length > 10) {
    body += `... and ${filesFixed.length - 10} more files`;
  }

  return generateCommitMessage({
    type: 'fix',
    scope,
    description,
    body,
    issues: originalPR ? [originalPR] : undefined,
    coAuthors: ['AI Dev Agent <ai-dev-agent[bot]@users.noreply.github.com>'],
  });
}

/**
 * Generate a commit message for AI-generated type additions
 */
export function generateTypeAdditionCommitMessage(
  filesModified: string[],
  typesAdded: number
): string {
  const scope = filesModified.length === 1 
    ? getFileScope(filesModified[0])
    : undefined;

  const description = typesAdded === 1
    ? 'add 1 type annotation'
    : `add ${typesAdded} type annotations`;

  return generateCommitMessage({
    type: 'feat',
    scope,
    description,
    body: `Added TypeScript type annotations to ${filesModified.length} file(s).`,
    coAuthors: ['AI Dev Agent <ai-dev-agent[bot]@users.noreply.github.com>'],
  });
}

/**
 * Generate a commit message for AI-generated documentation improvements
 */
export function generateDocsCommitMessage(
  filesModified: string[],
  docsAdded: number
): string {
  const scope = filesModified.length === 1 
    ? getFileScope(filesModified[0])
    : undefined;

  const description = `improve documentation in ${filesModified.length} file(s)`;

  return generateCommitMessage({
    type: 'docs',
    scope,
    description,
    body: `Added or improved ${docsAdded} documentation comment(s).`,
    coAuthors: ['AI Dev Agent <ai-dev-agent[bot]@users.noreply.github.com>'],
  });
}

/**
 * Extract a scope from a file path
 * e.g., "src/utils/helpers.ts" -> "utils"
 */
function getFileScope(filePath: string): string | undefined {
  const parts = filePath.split('/');
  
  // Skip common prefixes
  const skipPrefixes = ['src', 'lib', 'app', 'packages'];
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!skipPrefixes.includes(parts[i])) {
      return parts[i];
    }
  }

  // If all parts are skip prefixes, use the second to last
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return undefined;
}

/**
 * Parse a commit message into its components
 */
export function parseCommitMessage(message: string): {
  type?: CommitType;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  issues: number[];
} {
  const lines = message.split('\n');
  const header = lines[0];
  
  // Parse header: type(scope)!: description
  const headerMatch = header.match(/^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/);
  
  if (!headerMatch) {
    return {
      description: header,
      breaking: false,
      issues: [],
    };
  }

  const [, type, scope, bang, description] = headerMatch;
  
  // Find body (lines after first blank line, before footer)
  const bodyLines: string[] = [];
  let footerStart = lines.length;
  
  let inBody = false;
  for (let i = 1; i < lines.length; i++) {
    if (!inBody && lines[i] === '') {
      inBody = true;
      continue;
    }
    if (inBody) {
      // Check if this is a footer line
      if (lines[i].match(/^(BREAKING CHANGE|Fixes|Co-authored-by):/)) {
        footerStart = i;
        break;
      }
      bodyLines.push(lines[i]);
    }
  }

  // Extract issues from footer
  const issues: number[] = [];
  for (let i = footerStart; i < lines.length; i++) {
    const issueMatch = lines[i].match(/Fixes:\s*(.+)/);
    if (issueMatch) {
      const issueRefs = issueMatch[1].match(/#(\d+)/g) || [];
      issues.push(...issueRefs.map(ref => parseInt(ref.substring(1), 10)));
    }
  }

  return {
    type: type as CommitType | undefined,
    scope,
    description,
    body: bodyLines.length > 0 ? bodyLines.join('\n').trim() : undefined,
    breaking: !!bang || lines.some(l => l.startsWith('BREAKING CHANGE:')),
    issues,
  };
}

