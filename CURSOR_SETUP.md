# Cursor Integration - Quick Setup Guide

## ✅ What's Already Done

1. ✅ Project built (`dist/mcp/server.js` exists)
2. ✅ Configuration file generated automatically
3. ✅ Environment variables loaded from `.env`
4. ✅ Paths configured correctly

## 🚀 Next Steps

### Step 1: Verify Configuration (Optional)

Your Cursor config is located at:

**macOS**: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Linux**: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

To view it (macOS/Linux):
```bash
cat ~/Library/Application\ Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json | python3 -m json.tool
```

### Step 2: Restart Cursor IDE

**IMPORTANT**: You must completely restart Cursor for the MCP server to load.

1. **Quit Cursor completely** (not just close the window):
   - Press `Cmd + Q` on macOS
   - Or: Cursor → Quit Cursor

2. **Reopen Cursor**

3. Wait a few seconds for the MCP server to initialize

### Step 3: Test the Integration

Open Cursor chat (Cmd+L) and try:

1. **Check if tools are available**:
   ```
   What MCP tools are available?
   ```

2. **Test getting a PR review**:
   ```
   Get the review status for PR #1 in owner/repo
   ```
   
   You'll need to provide the installation ID. You can find it in your database or GitHub App settings.

3. **Try other commands**:
   - "Get suggestions from the AI review for owner/repo#123"
   - "Should I merge PR #123? Get the recommendation"

## 🔧 Available Tools

Once connected, Cursor can use:

- **`get_pr_review`** - Get AI review status and results
  - Requires: owner, repo, pullNumber, installationId
  
- **`get_suggestions`** - Get structured suggestions
  - Requires: owner, repo, pullNumber, installationId
  
- **`get_merge_recommendation`** - Get merge recommendation
  - Requires: owner, repo, pullNumber, installationId
  
- **`create_issue_from_suggestion`** - Create GitHub issue
  - Requires: owner, repo, suggestionId, installationId
  
- **`get_ci_status`** - Check CI/check status
  - Requires: owner, repo, commitSha, installationId

## 🐛 Troubleshooting

### Tools Not Showing Up

1. **Did you restart Cursor completely?** (Cmd+Q, not just close window)
2. **Check Cursor Developer Console**:
   - Help → Toggle Developer Tools
   - Look for MCP-related errors

### MCP Server Not Starting

1. **Check if Node.js is in PATH**:
   ```bash
   which node
   ```

2. **Verify the server file exists**:
   ```bash
   ls -la /path/to/AI-PR-Dev/dist/mcp/server.js
   ```

3. **Test the server manually**:
   ```bash
   cd /path/to/AI-PR-Dev
   node dist/mcp/server.js
   ```
   (Press Ctrl+C to stop - it will wait for stdio input)

### Configuration Issues

If you need to regenerate the config:
```bash
cd /path/to/AI-PR-Dev
npm run setup-cursor
```

## 📝 Example Usage

Once everything is working, you can ask Cursor:

- "Check the review status for PR #1 in owner/repo with installation ID 123456"
- "Get suggestions from the AI review for owner/repo#1"
- "Should I merge PR #1? Get the recommendation for owner/repo"

## 🔗 Useful Links

- Full documentation: `docs/cursor-integration.md`

