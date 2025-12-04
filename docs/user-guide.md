# User Guide

This guide covers how to use all features of AI-PR-Dev.

## Table of Contents

- [Automatic Code Reviews](#automatic-code-reviews)
- [Slash Commands](#slash-commands)
- [Repository Configuration](#repository-configuration)
- [CLI Usage](#cli-usage)
- [Dashboard](#dashboard)
- [Cursor Integration](#cursor-integration)

## Automatic Code Reviews

The app automatically reviews pull requests when they are:
- Opened
- Updated (synchronized)

### Review Components

Each review includes:

1. **Summary**: Overview of changes
2. **Risk Assessment**: Overall risk level (low/medium/high)
3. **Inline Comments**: Line-specific suggestions
4. **General Observations**: High-level recommendations
5. **Suggestions**: Actionable improvements

### Example Review

```
## AI Code Review Summary

**Risk Level**: Medium

### Summary
This PR adds user authentication functionality with JWT tokens...

### High Priority Issues
1. Security: JWT secret should be stored in environment variables
2. Error Handling: Missing error handling in login route

### Suggestions
- Consider using bcrypt for password hashing
- Add rate limiting to prevent brute force attacks
```

## Slash Commands

Comment on any pull request with these commands:

### `/ai-review`

Trigger a new AI code review on the PR.

**Usage**: `/ai-review`

**Example**:
```
/ai-review
```

### `/ai-explain`

Get AI explanation for code. Supports follow-up questions.

**Usage**: `/ai-explain [question]`

**Examples**:
```
/ai-explain
/ai-explain What does this function do?
/ai-explain Why is this approach used?
```

### `/ai-fix-lints`

Create a new PR with AI-generated lint fixes.

**Usage**: `/ai-fix-lints [--dry-run] [--scope=path]`

**Options**:
- `--dry-run`: Preview changes without creating PR
- `--scope=path`: Limit to specific file or directory

**Examples**:
```
/ai-fix-lints
/ai-fix-lints --dry-run
/ai-fix-lints --scope=src/utils
```

### `/ai-add-types`

Create a PR adding TypeScript type annotations.

**Usage**: `/ai-add-types [--dry-run] [--scope=path]`

**Examples**:
```
/ai-add-types
/ai-add-types --scope=src/api
```

### `/ai-improve-docs`

Create a PR improving inline documentation.

**Usage**: `/ai-improve-docs [--dry-run] [--scope=path]`

**Examples**:
```
/ai-improve-docs
/ai-improve-docs --scope=src/services
```

### `/ai-help`

Show available commands and usage.

**Usage**: `/ai-help`

## Repository Configuration

Configure the app per repository using `.ai-pr-reviewer.yml`:

```yaml
version: 1
enabled: true
mode: both  # 'reviewer', 'dev-agent', or 'both'

reviewer:
  strictness: normal  # 'lenient', 'normal', 'strict'
  minSeverity: low
  maxFilesReviewed: 50
  ignorePaths:
    - "*.test.ts"
    - "*.spec.ts"

ai:
  provider: openai
  model: gpt-4-turbo-preview
  temperature: 0.3

devAgent:
  enabled: true
  maxFilesPerPR: 10
  maxLinesChanged: 200
```

See [Configuration Guide](configuration.md) for details.

## CLI Usage

The CLI provides command-line access to review data.

### Installation

```bash
npm install -g ai-pr-dev
```

### Commands

#### `status`

Get review status for a PR.

```bash
ai-pr status owner/repo#123 --installation-id 123456
```

#### `suggestions`

Get structured suggestions from a review.

```bash
ai-pr suggestions owner/repo#123 --installation-id 123456
```

#### `recommend`

Get merge recommendation.

```bash
ai-pr recommend owner/repo#123 --installation-id 123456
```

#### `wait`

Wait for review to complete.

```bash
ai-pr wait owner/repo#123 --installation-id 123456 --timeout 300
```

#### `create-issue`

Create GitHub issue from suggestion.

```bash
ai-pr create-issue owner/repo#123 \
  --title "Fix security issue" \
  --body "Description" \
  --installation-id 123456
```

See [CLI Reference](cli-reference.md) for full documentation.

## Dashboard

Access the web dashboard at `http://localhost:3001` (or your configured URL).

### Features

- View review history
- Monitor review statistics
- Configure repository settings
- View metrics and analytics

### Setup

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (see `dashboard/env.example`)

4. Start the dashboard:
   ```bash
   npm run dev
   ```

## Cursor Integration

Use AI-PR-Dev directly in Cursor IDE via MCP.

### Setup

1. Build the project:
   ```bash
   npm run build
   ```

2. Generate Cursor configuration:
   ```bash
   npm run setup-cursor
   ```

3. Restart Cursor IDE

### Usage

In Cursor chat, you can ask:

- "Get the review status for PR #1 in owner/repo"
- "Get suggestions from the AI review for owner/repo#1"
- "Should I merge PR #1? Get the recommendation"

See [Cursor Integration Guide](cursor-integration.md) for details.

## Best Practices

### For Code Reviews

1. **Keep PRs Focused**: Smaller PRs get better reviews
2. **Provide Context**: Good PR descriptions help the AI
3. **Review AI Suggestions**: Not all suggestions are perfect
4. **Use Configuration**: Customize review strictness per repo

### For Dev Agent

1. **Start with Dry Run**: Use `--dry-run` to preview changes
2. **Review Generated PRs**: Always review AI-generated code
3. **Set Limits**: Use configuration to limit scope
4. **Test Changes**: Run tests on AI-generated PRs

### For Configuration

1. **Start Simple**: Use defaults first, then customize
2. **Repository-Specific**: Different repos may need different settings
3. **Team Alignment**: Coordinate with your team on settings
4. **Iterate**: Adjust based on results

## Examples

### Example 1: Basic Review

1. Open a PR
2. Wait for automatic review
3. Address suggestions
4. Merge when ready

### Example 2: Fix Lint Issues

1. Comment `/ai-fix-lints --dry-run` on a PR
2. Review the proposed changes
3. Comment `/ai-fix-lints` to create the PR
4. Review and merge the fix PR

### Example 3: Add TypeScript Types

1. Comment `/ai-add-types --scope=src/utils` on a PR
2. Review the generated types
3. Merge the types PR
4. Continue with original PR

## Getting Help

- 📖 [Documentation](.)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)
- ❓ [FAQ](faq.md)
- 🔧 [Troubleshooting](troubleshooting.md)

