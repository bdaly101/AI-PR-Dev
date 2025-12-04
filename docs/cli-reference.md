# CLI Reference

The AI-PR-Dev CLI provides command-line access to review data and functionality.

## Installation

```bash
npm install -g ai-pr-dev
```

## Usage

```bash
ai-pr [command] [options]
```

## Commands

### `status`

Get review status for a PR.

**Syntax**:
```bash
ai-pr status <owner/repo#pr> [options]
```

**Arguments**:
- `owner/repo#pr`: PR identifier in format `owner/repo#123` or `owner/repo/123`

**Options**:
- `-i, --installation-id <id>`: GitHub App installation ID (required)
- `--api-url <url>`: API base URL (default: `http://localhost:3000`)

**Example**:
```bash
ai-pr status owner/repo#123 --installation-id 123456
```

**Output**:
```
Review Status for owner/repo#123
─────────────────────────────────
Reviewed: Yes
Reviewed At: 2025-01-15T10:30:00.000Z
Model: gpt-4-turbo-preview
Severity: medium
Risks: 3
Suggestions: 5
```

### `suggestions`

Get structured suggestions from a review.

**Syntax**:
```bash
ai-pr suggestions <owner/repo#pr> [options]
```

**Arguments**:
- `owner/repo#pr`: PR identifier

**Options**:
- `-i, --installation-id <id>`: GitHub App installation ID (required)
- `--api-url <url>`: API base URL (default: `http://localhost:3000`)

**Example**:
```bash
ai-pr suggestions owner/repo#123 --installation-id 123456
```

**Output**:
```
Suggestions for owner/repo#123
───────────────────────────────
1. [HIGH] Security: JWT secret should be stored in environment variables
   File: src/auth.ts:42

2. [MEDIUM] Code Quality: Consider using async/await instead of promises
   File: src/api/routes.ts:15

3. [LOW] Documentation: Add JSDoc comments
   File: src/utils/helpers.ts:8
```

### `recommend`

Get merge recommendation for a PR.

**Syntax**:
```bash
ai-pr recommend <owner/repo#pr> [options]
```

**Arguments**:
- `owner/repo#pr`: PR identifier

**Options**:
- `-i, --installation-id <id>`: GitHub App installation ID (required)
- `--api-url <url>`: API base URL (default: `http://localhost:3000`)

**Example**:
```bash
ai-pr recommend owner/repo#123 --installation-id 123456
```

**Output**:
```
Merge Recommendation for owner/repo#123
────────────────────────────────────────
Recommendation: APPROVE
Confidence: 85%

Reasons:
  ✓ No high-severity issues found
  ✓ Code follows best practices
  ✓ Tests are passing

Warnings:
  ⚠ Consider adding more error handling
```

### `wait`

Wait for review to complete.

**Syntax**:
```bash
ai-pr wait <owner/repo#pr> [options]
```

**Arguments**:
- `owner/repo#pr`: PR identifier

**Options**:
- `-i, --installation-id <id>`: GitHub App installation ID (required)
- `--api-url <url>`: API base URL (default: `http://localhost:3000`)
- `--timeout <seconds>`: Timeout in seconds (default: `300`)
- `--interval <seconds>`: Poll interval in seconds (default: `5`)

**Example**:
```bash
ai-pr wait owner/repo#123 --installation-id 123456 --timeout 600
```

**Output**:
```
Waiting for review to complete...
Polling every 5 seconds (timeout: 600s)
.
Review completed!
```

### `create-issue`

Create a GitHub issue from a suggestion.

**Syntax**:
```bash
ai-pr create-issue <owner/repo#pr> [options]
```

**Arguments**:
- `owner/repo#pr`: PR identifier

**Required Options**:
- `--title <title>`: Issue title
- `--body <body>`: Issue body

**Options**:
- `-i, --installation-id <id>`: GitHub App installation ID (required)
- `--suggestion-id <id>`: Suggestion ID to reference
- `--priority <priority>`: Priority (low, medium, high) (default: `medium`)
- `--labels <labels>`: Comma-separated labels
- `--api-url <url>`: API base URL (default: `http://localhost:3000`)

**Example**:
```bash
ai-pr create-issue owner/repo#123 \
  --title "Fix security issue" \
  --body "JWT secret should be stored in environment variables" \
  --installation-id 123456 \
  --suggestion-id risk-0 \
  --priority high \
  --labels "bug,security"
```

**Output**:
```
Issue created successfully!
Issue #456: Fix security issue
URL: https://github.com/owner/repo/issues/456
```

## Global Options

- `-h, --help`: Display help for command
- `-V, --version`: Display version number

## Environment Variables

You can set default values using environment variables:

```bash
export AI_PR_INSTALLATION_ID=123456
export AI_PR_API_URL=http://localhost:3000
```

## Examples

### Basic Usage

```bash
# Get review status
ai-pr status owner/repo#123 --installation-id 123456

# Get suggestions
ai-pr suggestions owner/repo#123 --installation-id 123456

# Get recommendation
ai-pr recommend owner/repo#123 --installation-id 123456
```

### With Custom API URL

```bash
ai-pr status owner/repo#123 \
  --installation-id 123456 \
  --api-url https://api.example.com
```

### Waiting for Review

```bash
# Wait up to 10 minutes for review
ai-pr wait owner/repo#123 \
  --installation-id 123456 \
  --timeout 600 \
  --interval 10
```

### Creating Issues

```bash
# Create issue from suggestion
ai-pr create-issue owner/repo#123 \
  --title "Fix security issue" \
  --body "Description" \
  --installation-id 123456 \
  --suggestion-id risk-0 \
  --priority high
```

## Exit Codes

- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: API error
- `4`: Timeout

## Troubleshooting

### Installation ID Not Found

If you get an error about missing installation ID:

1. Find your installation ID in GitHub App settings
2. Use `--installation-id` flag or set `AI_PR_INSTALLATION_ID` environment variable

### API Connection Errors

If you can't connect to the API:

1. Verify the server is running: `curl http://localhost:3000/health`
2. Check the API URL: `--api-url http://localhost:3000`
3. Verify API key if required: Set `API_KEY` environment variable

### Invalid PR Format

PR identifier must be in format:
- `owner/repo#123` ✓
- `owner/repo/123` ✓
- `owner/repo 123` ✗

## Support

For CLI-related questions:
- 📖 [Documentation](.)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)

