# Getting Started

This guide will walk you through setting up AI-PR-Dev from scratch.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm 9+ installed
- A **GitHub account**
- An **OpenAI API key** with access to GPT-4
- (Optional) An **Anthropic API key** for Claude fallback

## Installation Methods

### Method 1: npm (Recommended)

```bash
# Install globally
npm install -g ai-pr-dev

# Verify installation
ai-pr --version
```

### Method 2: Docker

```bash
# Pull the image
docker pull ai-pr-dev:latest

# Run the container (see Docker section below for full setup)
docker run -d --name ai-pr-reviewer ai-pr-dev:latest
```

### Method 3: From Source

```bash
# Clone the repository
git clone https://github.com/bdaly101/AI-PR-Dev.git
cd AI-PR-Dev

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 1: Create a GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click **"New GitHub App"**
3. Fill in the basic information:
   - **GitHub App name**: `AI PR Reviewer` (or your preferred name)
   - **Homepage URL**: Your repository URL or documentation site
   - **Webhook URL**: `https://your-domain.com/webhooks/github` (update after deployment)
   - **Webhook secret**: Generate with `openssl rand -hex 32`
4. Set **Repository Permissions**:
   - Contents: **Read & Write**
   - Pull requests: **Read & Write**
   - Issues: **Read & Write**
   - Metadata: **Read-only**
5. Subscribe to **Events**:
   - ✅ Pull request
   - ✅ Issue comment
6. Click **"Create GitHub App"**
7. **Generate a private key** and download it
8. **Note your App ID** (found on the app settings page)

For detailed instructions, see [GitHub App Setup Guide](github-app-setup.md).

## Step 2: Configure Environment Variables

### For npm/From Source Installation

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:
   ```env
   # GitHub App Configuration
   GITHUB_APP_ID=123456
   GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYour key content here\n-----END RSA PRIVATE KEY-----"
   GITHUB_WEBHOOK_SECRET=your_webhook_secret

   # AI Provider Configuration
   OPENAI_API_KEY=sk-your_openai_api_key
   ANTHROPIC_API_KEY=sk-ant-your_anthropic_key  # Optional

   # Server Configuration
   PORT=3000
   NODE_ENV=production

   # Database Configuration
   DATABASE_PATH=./data/app.db
   ```

### For Docker Installation

Create a `.env` file or pass environment variables:

```bash
docker run -d \
  --name ai-pr-reviewer \
  -p 3000:3000 \
  -v ai-pr-data:/app/data \
  --env-file .env \
  ai-pr-dev:latest
```

Or pass variables directly:

```bash
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

## Step 3: Start the Server

### For npm/From Source

```bash
# Start the server
npm start

# Or in development mode
npm run dev
```

The server will start on port 3000 (or your configured PORT).

### For Docker

```bash
# Start the container
docker start ai-pr-reviewer

# View logs
docker logs -f ai-pr-reviewer
```

## Step 4: Update GitHub App Webhook URL

1. Go back to your GitHub App settings
2. Update the **Webhook URL** to your deployed endpoint:
   - Local development: `http://localhost:3000/webhooks/github` (use ngrok for testing)
   - Production: `https://your-domain.com/webhooks/github`
3. Save changes

## Step 5: Install the GitHub App

1. Go to your GitHub App settings
2. Click **"Install App"**
3. Choose which repositories to install on:
   - All repositories
   - Only select repositories
   - Only on this account
4. Complete the installation

## Step 6: Test the Installation

1. **Health Check**:
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Create a Test PR**:
   - Open a pull request in a repository where the app is installed
   - The app should automatically post a review comment

3. **Test Slash Commands**:
   - Comment `/ai-review` on a PR
   - The app should respond with a review

## Next Steps

- Read the [User Guide](user-guide.md) to learn how to use all features
- Configure repository settings with [Configuration Guide](configuration.md)
- Set up [Cursor Integration](cursor-integration.md) for IDE support
- Explore the [API Reference](api-reference.md) for programmatic access
- Check the [CLI Reference](cli-reference.md) for command-line tools

## Troubleshooting

If you encounter issues:

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Verify all environment variables are set correctly
3. Check server logs for errors
4. Ensure the GitHub App webhook URL is correct and accessible
5. Verify the app is installed on the repository

## Getting Help

- 📖 [Documentation](.)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)
- ❓ [FAQ](faq.md)

