# AI-PR-Dev

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

> AI PR Reviewer & Dev Agent is a GitHub App that automates code reviews using GPT-4, adding summaries, risk analysis, and inline comments. It also acts as an AI dev assistant that creates branches, proposes improvements, and opens clear, documented PRs—always requiring human approval.

## 🚀 One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/bdaly101/AI-PR-Dev)

**Note**: After deploying, you'll need to:
1. Set up your GitHub App (see [Setup Guide](docs/getting-started.md))
2. Configure environment variables with your API keys

## ✨ Features

- 🤖 **Automated Code Reviews**: AI-powered code reviews on pull requests with:
  - Summary of changes
  - Risk analysis (low/medium/high)
  - Inline suggestions and comments
  - General observations and recommendations

- 🛠️ **Slash Commands**: Respond to commands in PR comments:
  - `/ai-review` - Trigger a new AI code review
  - `/ai-fix-lints` - Create a new PR with AI-generated lint fixes
  - `/ai-explain` - Get AI explanation for code
  - `/ai-add-types` - Add TypeScript type annotations
  - `/ai-improve-docs` - Improve inline documentation

- 🔒 **Safety First**: Never auto-merges - all changes require human approval

- 🎯 **Cursor IDE Integration**: Use the AI PR Reviewer directly in Cursor with MCP tools:
  - Query review status and suggestions
  - Get merge recommendations
  - Create GitHub issues from suggestions
  - Check CI status
  - See [Cursor Integration Guide](docs/cursor-integration.md) for setup

- 📊 **Dashboard**: Web-based dashboard for monitoring reviews and managing settings

- 🔌 **CLI Tools**: Command-line interface for querying reviews and managing the app

## 🚀 Quick Start

### Option 1: npm (Recommended)

```bash
# Install globally
npm install -g ai-pr-dev

# Or install locally in your project
npm install ai-pr-dev
```

### Option 2: Docker

```bash
# Pull the image
docker pull ai-pr-dev:latest

# Run the container
docker run -d \
  --name ai-pr-reviewer \
  -p 3000:3000 \
  -v ai-pr-data:/app/data \
  -e GITHUB_APP_ID=your_app_id \
  -e GITHUB_PRIVATE_KEY="..." \
  -e GITHUB_WEBHOOK_SECRET=your_secret \
  -e OPENAI_API_KEY=sk-... \
  ai-pr-dev:latest
```

### Option 3: From Source

```bash
# Clone the repository
git clone https://github.com/bdaly101/AI-PR-Dev.git
cd AI-PR-Dev

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# See .env.example for all required variables

# Build the project
npm run build

# Start the server
npm start
```

## 📋 Prerequisites

- **Node.js** 18+ and npm 9+
- **GitHub App** with the following permissions:
  - Repository permissions:
    - Pull requests: Read & write
    - Contents: Read & write
    - Issues: Read & write
  - Subscribe to events:
    - Pull request
    - Issue comment
- **OpenAI API key** with access to GPT-4
- (Optional) **Anthropic API key** for Claude fallback

## 🔧 Setup

### 1. Create a GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click **"New GitHub App"**
3. Configure the app:
   - **GitHub App name**: `AI PR Reviewer` (or your preferred name)
   - **Homepage URL**: Your repository URL or documentation site
   - **Webhook URL**: `https://your-domain.com/webhooks/github` (update after deployment)
   - **Webhook secret**: Generate with `openssl rand -hex 32`
4. Set permissions (see Prerequisites above)
5. Subscribe to events: Pull request, Issue comment
6. Generate a private key and save it
7. Note your App ID

For detailed instructions, see [GitHub App Setup Guide](docs/github-app-setup.md).

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `GITHUB_APP_ID` - Your GitHub App ID
- `GITHUB_PRIVATE_KEY` - GitHub App private key (with `\n` for newlines)
- `GITHUB_WEBHOOK_SECRET` - Webhook secret
- `OPENAI_API_KEY` - OpenAI API key

Optional variables:
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude fallback
- `PORT` - Server port (default: 3000)
- `DATABASE_PATH` - SQLite database path (default: ./data/app.db)
- `API_KEY` - API key for protecting endpoints
- `DOCUMENTATION_URL` - Documentation URL for help messages
- `REPOSITORY_URL` - Repository URL for links

### 3. Install and Run

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

The server will start on the configured port (default: 3000).

### 4. Update GitHub App Webhook URL

After deployment, update your GitHub App's webhook URL to:
```
https://your-domain.com/webhooks/github
```

## 📖 Usage

### Automatic Code Reviews

The app automatically reviews pull requests when they are:
- Opened
- Updated (synchronized)

The review includes:
- Summary of changes
- Risk assessment
- Inline code suggestions
- General comments

### Manual Commands

Comment on any pull request with these commands:

- `/ai-review` - Request a new AI code review
- `/ai-explain` - Get AI explanation for code (supports follow-up questions)
- `/ai-fix-lints` - Create a new PR with automated lint fixes
- `/ai-add-types` - Create a PR adding TypeScript type annotations
- `/ai-improve-docs` - Create a PR improving inline documentation
- `/ai-help` - Show available commands

### CLI Usage

```bash
# Get review status for a PR
ai-pr status owner/repo#123

# Get suggestions from a review
ai-pr suggestions owner/repo#123

# Get merge recommendation
ai-pr recommend owner/repo#123

# Wait for review to complete
ai-pr wait owner/repo#123
```

For full CLI documentation, see [CLI Reference](docs/cli-reference.md).

### API Usage

The app exposes REST API endpoints for programmatic access:

- `GET /health` - Health check endpoint
- `POST /webhooks/github` - GitHub webhook receiver
- `GET /api/reviews/:owner/:repo/:pr` - Get review status
- `GET /api/suggestions/:owner/:repo/:pr` - Get suggestions
- `GET /api/recommendations/:owner/:repo/:pr` - Get merge recommendation

For full API documentation, see [API Reference](docs/api-reference.md).

## 🏗️ Architecture

The application is built with TypeScript and follows a clean architecture:

```
src/
├── index.ts              # Fastify server and webhook endpoint
├── config/
│   ├── env.ts           # Environment configuration
│   └── repoConfig.ts    # Repository configuration
├── github/
│   ├── client.ts        # GitHub API client (Octokit)
│   ├── webhooks.ts      # Webhook event handlers
│   └── prHelpers.ts     # PR helper functions
├── ai/
│   ├── prompts.ts       # AI prompts for different tasks
│   ├── reviewer.ts      # AI code reviewer
│   ├── devAgent.ts      # AI dev agent for improvements
│   ├── explainer.ts     # Code explanation service
│   └── providers/       # AI provider implementations
├── services/
│   ├── reviewService.ts     # Handles PR code reviews
│   └── devAgentService.ts  # Handles slash commands
├── database/
│   └── repositories/    # Data access layer
├── api/
│   ├── routes.ts        # API route handlers
│   └── middleware.ts    # API middleware
├── cli/
│   └── commands/        # CLI command implementations
└── mcp/
    ├── server.ts        # MCP server for Cursor
    └── tools.ts         # MCP tool definitions
```

## 🛠️ Technology Stack

- **Server**: Fastify
- **GitHub Integration**: @octokit/webhooks, @octokit/rest
- **AI**: OpenAI GPT-4, Anthropic Claude (fallback)
- **Language**: TypeScript
- **Runtime**: Node.js
- **Database**: SQLite (better-sqlite3)
- **Dashboard**: Next.js, React

## 📚 Documentation

- [Getting Started Guide](docs/getting-started.md) - Complete setup instructions
- [User Guide](docs/user-guide.md) - How to use all features
- [API Reference](docs/api-reference.md) - API endpoint documentation
- [CLI Reference](docs/cli-reference.md) - CLI command documentation
- [Configuration Guide](docs/configuration.md) - Repository configuration
- [GitHub App Setup](docs/github-app-setup.md) - Creating and configuring GitHub App
- [Deployment Guide](docs/deployment.md) - Deployment instructions
- [Cursor Integration](docs/cursor-integration.md) - Cursor IDE integration
- [FAQ](docs/faq.md) - Frequently asked questions
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## 🧪 Development

### Build the project:
```bash
npm run build
```

### Run linting:
```bash
npm run lint
```

### Type checking:
```bash
npm run type-check
```

### Run tests:
```bash
npm test
```

### Run tests with coverage:
```bash
npm run test:coverage
```

### Development mode:
```bash
npm run dev
```

## 🔒 Security

- Never commits secrets
- Never auto-merges changes
- All AI-generated changes require human review
- Uses environment variables for sensitive configuration
- Optional API key authentication for endpoints
- Webhook signature verification

See [SECURITY.md](SECURITY.md) for security policy and vulnerability reporting.

## 📝 Examples

### Example Review Comment

```
## AI Code Review Summary

**Risk Level**: Medium

### Summary
This PR adds user authentication functionality with JWT tokens. The implementation looks solid overall, but there are a few security considerations.

### High Priority Issues
1. **Security**: JWT secret should be stored in environment variables, not hardcoded
2. **Error Handling**: Missing error handling in the login route

### Suggestions
- Consider using bcrypt for password hashing
- Add rate limiting to prevent brute force attacks
- Include token expiration in the response

### General Observations
- Code follows good TypeScript practices
- Tests are well-structured
- Documentation could be improved
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4
- Anthropic for Claude
- GitHub for the excellent API
- The open-source community

## 📞 Support

- 📖 [Documentation](docs/)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)
- 🔒 [Security Issues](SECURITY.md)

---

Made with ❤️ by the AI-PR-Dev team
