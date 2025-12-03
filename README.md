# AI-PR-Dev

AI PR Reviewer & Dev Agent is a GitHub App that automates code reviews using GPT-4, adding summaries, risk analysis, and inline comments. It also acts as an AI dev assistant that creates branches, proposes improvements, and opens clear, documented PRs—always requiring human approval.

## Features

- 🤖 **Automated Code Reviews**: AI-powered code reviews on pull requests with:
  - Summary of changes
  - Risk analysis (low/medium/high)
  - Inline suggestions and comments
  - General observations and recommendations

- 🛠️ **Slash Commands**: Respond to commands in PR comments:
  - `/ai-review` - Trigger a new AI code review
  - `/ai-fix-lints` - Create a new PR with AI-generated lint fixes

- 🔒 **Safety First**: Never auto-merges - all changes require human approval

- 🎯 **Cursor IDE Integration**: Use the AI PR Reviewer directly in Cursor with MCP tools:
  - Query review status and suggestions
  - Get merge recommendations
  - Create GitHub issues from suggestions
  - Check CI status
  - See [Cursor Integration Guide](docs/cursor-integration.md) for setup

## Architecture

The application is built with TypeScript and follows a clean architecture:

```
src/
├── index.ts              # Fastify server and webhook endpoint
├── config/
│   └── env.ts           # Environment configuration
├── github/
│   ├── client.ts        # GitHub API client (Octokit)
│   └── webhooks.ts      # Webhook event handlers
├── ai/
│   ├── prompts.ts       # AI prompts for different tasks
│   ├── reviewer.ts      # AI code reviewer
│   └── devAgent.ts      # AI dev agent for improvements
└── services/
    ├── reviewService.ts     # Handles PR code reviews
    └── devAgentService.ts   # Handles slash commands
```

## Technology Stack

- **Server**: Fastify
- **GitHub Integration**: @octokit/webhooks, @octokit/rest
- **AI**: OpenAI GPT-4
- **Language**: TypeScript
- **Runtime**: Node.js

## Setup

### Prerequisites

- Node.js 18+ and npm
- A GitHub App with the following permissions:
  - Repository permissions:
    - Pull requests: Read & write
    - Contents: Read & write
    - Issues: Read & write
  - Subscribe to events:
    - Pull request
    - Issue comment
- OpenAI API key with access to GPT-4

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bdaly101/AI-PR-Dev.git
   cd AI-PR-Dev
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your credentials:
   ```env
   GITHUB_APP_ID=your_app_id
   GITHUB_PRIVATE_KEY=your_private_key
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   OPENAI_API_KEY=your_openai_api_key
   PORT=3000
   NODE_ENV=development
   ```

### Creating a GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps > New GitHub App
2. Configure the app:
   - **Webhook URL**: `https://your-domain.com/webhooks/github`
   - **Webhook secret**: Generate a random secret
   - **Permissions**: Set as listed in Prerequisites
   - **Subscribe to events**: Pull request, Issue comment
3. Generate a private key and save it
4. Note your App ID

### Running the Application

#### Development mode:
```bash
npm run dev
```

#### Production mode:
```bash
npm run build
npm start
```

The server will start on the configured port (default: 3000).

### Endpoints

- `GET /health` - Health check endpoint
- `POST /webhooks/github` - GitHub webhook receiver

## Usage

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
- `/ai-fix-lints` - Create a new PR with automated lint fixes

## Development

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

## Security

- Never commits secrets
- Never auto-merges changes
- All AI-generated changes require human review
- Uses environment variables for sensitive configuration

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


