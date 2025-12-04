# Staging Deployment Guide

This guide covers deploying AI PR Reviewer to a Fly.io staging environment for testing.

## Prerequisites

- Fly.io account created (sign up at https://fly.io)
- Fly.io CLI installed: `curl -L https://fly.io/install.sh | sh`
- GitHub App created and configured (see [github-app-setup.md](./github-app-setup.md))
- GitHub App credentials ready (App ID, Private Key, Webhook Secret)
- OpenAI API key

## Step 1: Authenticate with Fly.io

```bash
fly auth login
```

## Step 2: Initialize Staging App

```bash
# Navigate to project directory
cd /path/to/AI-PR-Dev

# Launch staging app (this will create fly.toml if it doesn't exist)
# Replace 'your-app-staging' with your preferred app name
fly launch --name your-app-staging --region iad --no-deploy
```

When prompted:
- Use existing `fly.toml`? Yes
- Overwrite? No (keep existing configuration)

## Step 3: Create Persistent Volume

```bash
fly volumes create ai_pr_data --size 1 --region iad --app your-app-staging
```

This creates a 1GB volume for the SQLite database.

## Step 4: Set Environment Secrets

Set all required secrets for the staging environment:

```bash
# GitHub App Configuration
fly secrets set GITHUB_APP_ID=<your_app_id> --app your-app-staging
fly secrets set GITHUB_PRIVATE_KEY="$(cat path/to/private-key.pem)" --app your-app-staging
fly secrets set GITHUB_WEBHOOK_SECRET=<your_webhook_secret> --app your-app-staging

# AI Provider Keys
fly secrets set OPENAI_API_KEY=<your_openai_key> --app your-app-staging
# Optional: Anthropic fallback
fly secrets set ANTHROPIC_API_KEY=<your_anthropic_key> --app your-app-staging

# Environment
fly secrets set NODE_ENV=staging --app your-app-staging
```

**Note**: For `GITHUB_PRIVATE_KEY`, the key file content should include newlines. The `$(cat ...)` command handles this automatically.

## Step 5: Deploy

```bash
fly deploy --app your-app-staging
```

This will:
1. Build the Docker image
2. Push to Fly.io registry
3. Deploy the application
4. Start the service

## Step 6: Update GitHub App Webhook

After successful deployment:

1. Go to your GitHub App settings
2. Update the **Webhook URL** to:
   ```
   https://your-app-staging.fly.dev/webhooks/github
   ```
3. Save changes

## Step 7: Verify Deployment

### Health Check

```bash
curl https://your-app-staging.fly.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-02T..."
}
```

### Check Logs

```bash
fly logs --app your-app-staging
```

Look for:
- Server started successfully
- No error messages
- Database initialized

## Step 8: Functional Testing

### Test 1: Automatic PR Review

1. Install the GitHub App on a test repository
2. Create a test pull request
3. Verify the app automatically posts a review comment

### Test 2: Slash Commands

1. Comment `/ai-review` on a PR
2. Verify the app responds with a review

### Test 3: Dev Agent

1. Comment `/ai-fix-lints` on a PR or issue
2. Verify the app creates a new PR with fixes
3. Check that the PR includes proper description and labels

### Test 4: Database Persistence

1. Trigger a review
2. Restart the app: `fly apps restart your-app-staging`
3. Verify previous reviews are still accessible (no data loss)

## Monitoring

### View Logs

```bash
fly logs --app your-app-staging
```

### View Metrics

```bash
fly status --app your-app-staging
```

Or visit the Fly.io dashboard: https://fly.io/dashboard

### Check App Status

```bash
fly status --app your-app-staging
```

## Troubleshooting

### App Won't Start

- Check logs: `fly logs --app your-app-staging`
- Verify all secrets are set: `fly secrets list --app your-app-staging`
- Check volume is attached: `fly status --app your-app-staging`

### Webhook Not Working

- Verify webhook URL is correct in GitHub App settings
- Check webhook secret matches: `fly secrets list --app your-app-staging`
- Review GitHub webhook delivery logs in app settings
- Check application logs for webhook errors

### Database Issues

- Verify volume is created and attached
- Check volume size: `fly volumes list --app your-app-staging`
- Ensure `DATABASE_PATH` environment variable points to `/app/data/app.db`

## Next Steps

After successful staging validation, proceed to [production deployment](./production-deployment.md).

