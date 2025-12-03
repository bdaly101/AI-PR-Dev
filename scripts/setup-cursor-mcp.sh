#!/bin/bash

# Setup script for Cursor IDE MCP Integration
# This script helps configure the AI PR Reviewer MCP server for Cursor

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CURSOR_CONFIG_DIR=""

# Detect OS and set Cursor config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    CURSOR_CONFIG_DIR="$HOME/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CURSOR_CONFIG_DIR="$HOME/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    CURSOR_CONFIG_DIR="$APPDATA/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

CONFIG_FILE="$CURSOR_CONFIG_DIR/cline_mcp_settings.json"

echo "🚀 Setting up Cursor MCP Integration for AI PR Reviewer"
echo ""
echo "Project directory: $PROJECT_DIR"
echo "Cursor config directory: $CURSOR_CONFIG_DIR"
echo ""

# Build the project first
echo "📦 Building project..."
cd "$PROJECT_DIR"
npm run build

# Check if build succeeded
if [ ! -f "$PROJECT_DIR/dist/mcp/server.js" ]; then
    echo "❌ Build failed: dist/mcp/server.js not found"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Check if .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  Warning: .env file not found. You'll need to set environment variables manually."
    echo ""
fi

# Create config directory if it doesn't exist
mkdir -p "$CURSOR_CONFIG_DIR"

# Load environment variables from .env if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "📝 Loading environment variables from .env..."
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Create or update config file
echo "📝 Creating/updating Cursor MCP configuration..."

# Read existing config if it exists
if [ -f "$CONFIG_FILE" ]; then
    echo "⚠️  Config file already exists. Backing up to ${CONFIG_FILE}.backup"
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"
    EXISTING_CONFIG=$(cat "$CONFIG_FILE")
else
    EXISTING_CONFIG='{"mcpServers":{}}'
fi

# Create new config JSON
NEW_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "command": "node",
      "args": [
        "$PROJECT_DIR/dist/mcp/server.js"
      ],
      "env": {
        "GITHUB_APP_ID": "${GITHUB_APP_ID:-your-app-id}",
        "GITHUB_PRIVATE_KEY": "${GITHUB_PRIVATE_KEY:-}",
        "OPENAI_API_KEY": "${OPENAI_API_KEY:-}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY:-}",
        "DATABASE_PATH": "$PROJECT_DIR/data/app.db",
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
)

# Merge with existing config if it exists
if [ -f "$CONFIG_FILE" ]; then
    # Use jq if available, otherwise just overwrite
    if command -v jq &> /dev/null; then
        echo "$EXISTING_CONFIG" | jq --argjson new "$NEW_CONFIG" '.mcpServers += $new.mcpServers' > "$CONFIG_FILE"
    else
        echo "$NEW_CONFIG" > "$CONFIG_FILE"
        echo "⚠️  Note: jq not found. Existing config was overwritten. Check backup at ${CONFIG_FILE}.backup"
    fi
else
    echo "$NEW_CONFIG" > "$CONFIG_FILE"
fi

echo "✅ Configuration file created at:"
echo "   $CONFIG_FILE"
echo ""
echo "⚠️  IMPORTANT: Please review the configuration file and update any placeholder values!"
echo ""
echo "Next steps:"
echo "1. Edit the config file and fill in your actual environment variables"
echo "2. Restart Cursor IDE"
echo "3. Start using the tools in Cursor chat!"
echo ""

