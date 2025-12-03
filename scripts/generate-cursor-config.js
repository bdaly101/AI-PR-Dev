#!/usr/bin/env node

/**
 * Helper script to generate Cursor MCP configuration
 * Usage: node scripts/generate-cursor-config.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Get project root directory
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_TEMPLATE = {
  mcpServers: {
    'ai-pr-reviewer': {
      command: 'node',
      args: [path.join(PROJECT_ROOT, 'dist', 'mcp', 'server.js')],
      env: {},
    },
  },
};

// Load .env file if it exists
const envPath = path.join(PROJECT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key === 'GITHUB_APP_ID' || 
            key === 'GITHUB_PRIVATE_KEY' || 
            key === 'OPENAI_API_KEY' || 
            key === 'ANTHROPIC_API_KEY') {
          CONFIG_TEMPLATE.mcpServers['ai-pr-reviewer'].env[key] = value;
        }
      }
    }
  });
}

// Set DATABASE_PATH
CONFIG_TEMPLATE.mcpServers['ai-pr-reviewer'].env.DATABASE_PATH = 
  path.join(PROJECT_ROOT, 'data', 'app.db');
CONFIG_TEMPLATE.mcpServers['ai-pr-reviewer'].env.NODE_ENV = 'production';

// Determine Cursor config path
let cursorConfigPath;
const platform = os.platform();

if (platform === 'darwin') {
  cursorConfigPath = path.join(
    os.homedir(),
    'Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'
  );
} else if (platform === 'linux') {
  cursorConfigPath = path.join(
    os.homedir(),
    '.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'
  );
} else if (platform === 'win32') {
  cursorConfigPath = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'),
    'Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'
  );
} else {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

// Create directory if it doesn't exist
const configDir = path.dirname(cursorConfigPath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Merge with existing config if it exists
let existingConfig = { mcpServers: {} };
if (fs.existsSync(cursorConfigPath)) {
  try {
    existingConfig = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf-8'));
    console.log('📝 Found existing Cursor MCP config, merging...');
  } catch (error) {
    console.warn('⚠️  Could not parse existing config, will overwrite');
  }
}

// Merge configurations
if (!existingConfig.mcpServers) {
  existingConfig.mcpServers = {};
}
existingConfig.mcpServers['ai-pr-reviewer'] = CONFIG_TEMPLATE.mcpServers['ai-pr-reviewer'];

// Write configuration
fs.writeFileSync(cursorConfigPath, JSON.stringify(existingConfig, null, 2));

console.log('✅ Cursor MCP configuration generated!');
console.log('');
console.log('Configuration saved to:');
console.log(`   ${cursorConfigPath}`);
console.log('');
console.log('⚠️  Please review the configuration and update any placeholder values.');
console.log('');
console.log('Next steps:');
console.log('1. Edit the config file if needed');
console.log('2. Restart Cursor IDE');
console.log('3. Start using the tools in Cursor chat!');

