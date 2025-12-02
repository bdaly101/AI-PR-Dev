export const prompts = {
  reviewPR: (prTitle: string, prDescription: string, diff: string) => `
You are an expert code reviewer. Review the following pull request and provide:

1. A summary of the changes
2. Risk analysis (low/medium/high) with justification
3. Inline suggestions for improvements

PR Title: ${prTitle}
PR Description: ${prDescription}

Diff:
${diff}

Provide your review in the following JSON format:
{
  "summary": "Brief overview of the changes",
  "riskLevel": "low|medium|high",
  "riskJustification": "Why this risk level",
  "inlineComments": [
    {
      "file": "path/to/file.ts",
      "line": 10,
      "comment": "Suggestion for this line"
    }
  ],
  "generalComments": ["General observation 1", "General observation 2"]
}
`,

  reviewFile: (fileName: string, fileContent: string, fileDiff: string) => `
Review this specific file change:

File: ${fileName}

File Content:
${fileContent}

Diff:
${fileDiff}

Provide specific suggestions for improvements, potential bugs, or security issues.
Return a JSON array of comments:
[
  {
    "line": 10,
    "comment": "Your suggestion here"
  }
]
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
