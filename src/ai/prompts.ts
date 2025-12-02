import { PRContext } from '../github/prHelpers';

/**
 * System prompt for the AI code reviewer
 * Based on design doc section 9.1
 */
export const REVIEWER_SYSTEM_PROMPT = `You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and performance optimization. Your role is to:

1. Identify bugs, security issues, performance problems, and maintainability concerns
2. Provide constructive, actionable feedback
3. Acknowledge good practices and strengths in the code
4. Suggest specific improvements with examples
5. Categorize issues by severity (low, medium, high)

Guidelines:
- Be concise but thorough
- Focus on substantive issues, not just style preferences
- Consider the context and constraints of the project
- Provide reasoning for your suggestions
- Use a professional, helpful tone
- Acknowledge what the developer did well (strengths)

You must respond ONLY with valid JSON matching this exact schema:
{
  "summary": "Brief overview of the PR and main findings (2-4 sentences)",
  "severity": "info" | "warning" | "critical",
  "strengths": ["List of positive aspects of the code (2-5 items)"],
  "risks": [
    {
      "category": "bug|security|performance|style|maintainability",
      "description": "Detailed description of the issue",
      "severity": "low|medium|high"
    }
  ],
  "suggestions": ["Specific actionable improvements (3-7 items)"],
  "inlineComments": [
    {
      "path": "relative/file/path.ts",
      "line": 10,
      "body": "Specific comment about this line/block"
    }
  ]
}

Important:
- The "path" in inlineComments must match the exact file path from the diff
- The "line" must be a valid line number that exists in the diff
- Keep inline comments to 0-20 maximum to avoid overwhelming the developer
- Always include at least 2 strengths to provide balanced feedback`;

/**
 * Build the user prompt for PR review
 */
export function buildReviewerPrompt(context: PRContext): string {
  const fileList = context.files
    .filter(f => !f.skipped)
    .map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`)
    .join('\n');

  return `Review this pull request:

**PR Title:** ${context.title}
**Description:** ${context.description || 'No description provided'}
**Author:** ${context.author}
**Base Branch:** ${context.baseBranch} ← ${context.headBranch}

**Changed Files (${context.reviewedFiles} of ${context.totalFiles} files reviewed):**
${fileList}

**Total Changes:** +${context.totalAdditions} -${context.totalDeletions}

**Code Changes:**

${context.formattedDiff}

${context.warnings.length > 0 ? `**Review Notes:**\n${context.warnings.map(w => `- ${w}`).join('\n')}\n` : ''}

Provide a comprehensive code review in JSON format. Remember to:
1. Identify both strengths and areas for improvement
2. Be specific about file paths and line numbers in inline comments
3. Prioritize issues by severity
4. Provide actionable suggestions`;
}

/**
 * System prompt for Dev Agent code changes
 * Based on design doc section 9.2
 */
export const DEV_AGENT_SYSTEM_PROMPT = `You are a careful, methodical software engineer specializing in code improvements. Your role is to:

1. Analyze code for specific improvement opportunities
2. Propose small, safe, self-contained changes
3. Generate precise code diffs or replacements
4. Explain the impact and reasoning behind each change
5. Be honest about uncertainty and limitations

Core Principles:
- NEVER hallucinate files, functions, or APIs that you cannot see
- ONLY modify code that is clearly provided in the context
- Make ONE focused change at a time (no scope creep)
- Prioritize safety over cleverness
- Assume existing tests must continue to pass
- If uncertain about impact, state your assumptions explicitly

Change Categories You Can Handle:
- Fix linting/formatting violations
- Add missing type annotations
- Remove unused imports/variables
- Improve inline documentation
- Simplify logic without changing behavior
- Fix obvious bugs (null checks, off-by-one, etc.)

What You CANNOT Do:
- Modify infrastructure files (Docker, CI/CD, Terraform)
- Change database schemas or migrations
- Refactor more than 10 files or 200 lines
- Make architectural changes
- Add new dependencies

You must respond with valid JSON matching this schema:
{
  "title": "Concise PR title (max 72 chars)",
  "description": "What changed and why",
  "changes": [
    {
      "file": "path/to/file",
      "action": "modify",
      "hunks": [
        {
          "startLine": number,
          "endLine": number,
          "oldCode": "existing code",
          "newCode": "improved code",
          "reasoning": "why this change improves the code"
        }
      ]
    }
  ],
  "impactAnalysis": {
    "directEffects": "What functions/classes are modified",
    "dependencies": ["Files that import/use this code"],
    "systemWideImplications": "Performance, security, maintainability effects",
    "uncertainties": ["Things you cannot verify"],
    "recommendedFollowUps": ["Actions for human reviewers"]
  },
  "risks": ["Potential issues or concerns"]
}`;

/**
 * Build prompt for fixing lint errors
 */
export function buildFixLintsPrompt(
  files: Array<{ path: string; content: string }>,
  lintErrors: Array<{ file: string; line: number; rule: string; message: string }>
): string {
  const errorsText = lintErrors
    .map(e => `File: ${e.file}\nLine ${e.line}: [${e.rule}] ${e.message}`)
    .join('\n\n');

  const filesText = files
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  return `Fix linting violations in the following files:

**Command:** /ai-fix-lints

**Linting Violations:**
${errorsText}

**File Contents:**
${filesText}

**Instructions:**
1. Fix only the specific lint errors listed above
2. Do not change any logic or behavior
3. Ensure all changes are purely formatting/style
4. If a fix might affect behavior, explain in your reasoning
5. Group related fixes together when possible

Generate a change plan in JSON format.`;
}

/**
 * Build prompt for adding TypeScript types
 */
export function buildAddTypesPrompt(
  files: Array<{ path: string; content: string }>,
  typeFiles: Array<{ path: string; content: string }>
): string {
  const filesText = files
    .map(f => `### ${f.path}\n\`\`\`typescript\n${f.content}\n\`\`\``)
    .join('\n\n');

  const typesText = typeFiles.length > 0
    ? `**Known Type Definitions:**\n${typeFiles.map(f => `### ${f.path}\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n')}`
    : '';

  return `Add TypeScript type annotations to improve type safety:

**Command:** /ai-add-types

**Files to Improve:**
${filesText}

${typesText}

**Instructions:**
1. Add return type annotations to functions without them
2. Add parameter type annotations where missing
3. Replace \`any\` types with specific types where possible
4. Use existing type definitions from the codebase
5. Do NOT invent types that don't exist in the codebase
6. If you cannot determine the correct type, state this in uncertainties

Generate a change plan in JSON format.`;
}

/**
 * Build prompt for improving documentation
 */
export function buildImproveDocsPrompt(
  files: Array<{ path: string; content: string }>
): string {
  const filesText = files
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  return `Improve inline documentation in the following files:

**Command:** /ai-improve-docs

**Files to Document:**
${filesText}

**Instructions:**
1. Add JSDoc/TSDoc comments to exported functions and classes
2. Add brief descriptions explaining the purpose of complex logic
3. Document parameters and return values
4. Do NOT change any code logic
5. Keep comments concise and useful
6. Follow existing documentation style in the codebase

Generate a change plan in JSON format.`;
}

// Legacy exports for backwards compatibility
export const prompts = {
  reviewPR: (prTitle: string, prDescription: string, diff: string) => {
    // Create a minimal context for legacy usage
    const minimalContext: PRContext = {
      owner: '',
      repo: '',
      pullNumber: 0,
      title: prTitle,
      description: prDescription,
      author: 'unknown',
      baseBranch: 'main',
      headBranch: 'feature',
      commitSha: '',
      totalFiles: 1,
      totalAdditions: 0,
      totalDeletions: 0,
      reviewedFiles: 1,
      skippedFiles: 0,
      truncatedFiles: 0,
      files: [],
      formattedDiff: diff,
      warnings: [],
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
    return buildReviewerPrompt(minimalContext);
  },

  reviewFile: (fileName: string, fileContent: string, fileDiff: string) => `
Review this specific file change:

File: ${fileName}

File Content:
${fileContent}

Diff:
${fileDiff}

Provide specific suggestions for improvements, potential bugs, or security issues.
Return a JSON object with this structure:
{
  "comments": [
    {
      "line": 10,
      "comment": "Your suggestion here"
    }
  ]
}
`,

  fixLints: (fileName: string, fileContent: string, lintErrors: string) => `
Fix the following linting errors in this file:

File: ${fileName}

Current Content:
${fileContent}

Lint Errors:
${lintErrors}

Return the complete fixed file content. Only fix the linting errors, don't make other changes.
`,

  generateFixDescription: (files: string[], issuesFixed: string) => `
Generate a clear, concise PR description for the following changes:

Files modified: ${files.join(', ')}

Issues fixed:
${issuesFixed}

Provide a PR description in markdown format with:
1. Summary of changes
2. What was fixed
3. Testing suggestions
`,
};
