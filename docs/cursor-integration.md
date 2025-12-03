# Cursor IDE Integration Guide

This guide shows you how to integrate the AI PR Reviewer with Cursor IDE using the Model Context Protocol (MCP) server.

## Prerequisites

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Set up environment variables** - Ensure your `.env` file has all required variables:
   - `GITHUB_APP_ID`
   - `GITHUB_PRIVATE_KEY`
   - `GITHUB_WEBHOOK_SECRET`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY` (optional)
   - `DATABASE_PATH`

## Quick Setup (Automated)

The easiest way to set up Cursor integration:

```bash
# 1. Build the project
npm run build

# 2. Generate Cursor configuration automatically
node scripts/generate-cursor-config.js

# 3. Restart Cursor IDE
```

The script will:
- Read your `.env` file
- Generate the Cursor MCP configuration
- Save it to the correct location for your OS
- Merge with existing configurations

## Manual Configuration Steps

If you prefer to configure manually:

### Step 1: Build the Project

```bash
npm run build
```

Ensure `dist/mcp/server.js` exists after building.

### Step 2: Locate Cursor Settings

Cursor stores MCP server configurations in its settings file:

**macOS**: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Linux**: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

### Step 3: Add MCP Server Configuration

Open or create the MCP settings file and add:

```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "command": "node",
      "args": [
        "/absolute/path/to/AI-PR-Dev/dist/mcp/server.js"
      ],
      "env": {
        "GITHUB_APP_ID": "your-app-id",
        "GITHUB_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\\nYour key\\n-----END RSA PRIVATE KEY-----",
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "DATABASE_PATH": "/absolute/path/to/AI-PR-Dev/data/app.db",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Important**: 
- Replace `/absolute/path/to/AI-PR-Dev` with your actual project path (use `pwd` to find it)
- In JSON, use `\\n` for newlines in `GITHUB_PRIVATE_KEY`

### Step 4: Restart Cursor

After adding the configuration, **restart Cursor IDE** completely for changes to take effect.

## Available Tools

Once integrated, you can use these tools in Cursor:

1. **`get_pr_review`** - Get AI review status and results for a GitHub PR
2. **`get_suggestions`** - Get structured, actionable suggestions from a review
3. **`get_merge_recommendation`** - Get merge recommendation (MERGE/ITERATE/BLOCK)
4. **`create_issue_from_suggestion`** - Create GitHub issue from a suggestion
5. **`get_ci_status`** - Get CI/check run status for a commit

## Example Usage in Cursor

Once configured, you can ask Cursor AI:

- "Check the review status for PR #123 in my repo"
- "Get suggestions from the AI review for owner/repo#456"
- "Should I merge PR #789? Get the recommendation"
- "Create a GitHub issue from suggestion ID risk-0 in my PR"

## Troubleshooting

### MCP Server Not Starting

1. **Check the path**: Ensure the absolute path to `dist/mcp/server.js` is correct
2. **Check Node.js**: Verify Node.js is in your PATH (`which node`)
3. **Check build**: Make sure you've run `npm run build` first
4. **Check permissions**: Ensure the script is executable

### Tools Not Available

1. **Restart Cursor**: MCP servers load on startup
2. **Check logs**: Look for errors in Cursor's developer console (Help → Toggle Developer Tools)
3. **Verify config**: Check the JSON syntax in the settings file

### Environment Variables

- Use absolute paths for `DATABASE_PATH`
- Make sure `GITHUB_PRIVATE_KEY` includes the full key with `\n` for newlines
- All required env vars must be set in the MCP config

## Alternative: Using the CLI

You can also use the CLI tool directly from your terminal:

```bash
# Get review status
npm run cli status owner/repo#123 --installation-id <id>

# Get suggestions
npm run cli suggestions owner/repo#123 --installation-id <id>

# Get merge recommendation
npm run cli recommend owner/repo#123 --installation-id <id>
```

See the main README for more CLI usage examples.

