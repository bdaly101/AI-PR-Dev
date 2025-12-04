# Production Deployment Guide

This guide covers deploying AI PR Reviewer to Fly.io production environment.

## Prerequisites

- ✅ Staging environment deployed and tested
- ✅ All staging tests passed
- ✅ GitHub App configured and tested
- ✅ Fly.io account ready

## Step 1: Create Production App

```bash
# Navigate to project directory
cd /path/to/AI-PR-Dev

# Launch production app
fly launch --name your-app --region iad --no-deploy
```

When prompted:
- Use existing `fly.toml`? Yes
- Overwrite? No (keep existing configuration)

## Step 2: Create Production Volume

```bash
fly volumes create ai_pr_data --size 5 --region iad --app your-app
```

**Note**: Production uses a larger volume (5GB) for better performance and data retention.

## Step 3: Set Production Secrets

Set all required secrets for production:

```bash
# GitHub App Configuration
fly secrets set GITHUB_APP_ID=<your_app_id> --app your-app
fly secrets set GITHUB_PRIVATE_KEY="$(cat path/to/private-key.pem)" --app your-app
fly secrets set GITHUB_WEBHOOK_SECRET=<your_webhook_secret> --app your-app

# AI Provider Keys
fly secrets set OPENAI_API_KEY=<your_openai_key> --app your-app
# Optional: Anthropic fallback
fly secrets set ANTHROPIC_API_KEY=<your_anthropic_key> --app your-app

# Environment
fly secrets set NODE_ENV=production --app your-app
```

**Important**: Use production API keys and credentials. Do not reuse staging credentials.

## Step 4: Deploy to Production

```bash
fly deploy --app your-app
```

## Step 5: Update GitHub App Webhook

Update your GitHub App webhook URL to production:

1. Go to GitHub App settings
2. Update **Webhook URL** to:
   ```
   https://your-app.fly.dev/webhooks/github
   ```
3. Save changes

**Alternative**: If you prefer separate apps for staging and production, create a second GitHub App for production.

## Step 6: Production Verification

### Health Check

```bash
curl https://your-app.fly.dev/health
```

### Check Logs

```bash
fly logs --app your-app
```

### Verify Secrets

```bash
fly secrets list --app your-app
```

Ensure all required secrets are present (values are hidden for security).

## Step 7: Install on Target Repositories

1. Go to your GitHub App settings
2. Click "Install App"
3. Select repositories where you want AI PR Reviewer active
4. Complete installation

## Step 8: Monitor Initial Usage

### Watch Logs

```bash
fly logs --app your-app
```

### Check Metrics

```bash
fly status --app your-app
```

Or use the Fly.io dashboard: https://fly.io/dashboard

### Verify First Reviews

1. Open a test PR in an installed repository
2. Verify automatic review is posted
3. Check review quality and response time

## Production Best Practices

### Monitoring

- Set up Fly.io alerts for:
  - High error rates
  - Slow response times
  - Memory/CPU usage
- Monitor OpenAI API usage and costs
- Track review success rate

### Scaling

If you need to scale:

```bash
# Scale to multiple instances
fly scale count 2 --app your-app

# Increase resources
fly scale vm shared-cpu-2x --memory 1024 --app your-app
```

### Backups

The SQLite database is stored in a persistent volume. For additional safety:

1. Periodically export database: `fly ssh console --app your-app`
2. Copy database file from `/app/data/app.db`
3. Store backups securely

### Updates

To deploy updates:

```bash
# Pull latest changes
git pull origin main

# Deploy
fly deploy --app your-app
```

Or use GitHub Actions workflow (if configured):
- Push to `main` branch triggers automatic deployment

## Troubleshooting

### High Error Rates

- Check logs for patterns: `fly logs --app your-app`
- Verify API keys are valid and not rate-limited
- Check GitHub App permissions and installation status

### Performance Issues

- Monitor resource usage: `fly status --app your-app`
- Consider scaling if CPU/memory is high
- Review database query performance

### Webhook Failures

- Verify webhook URL is correct
- Check webhook secret matches
- Review GitHub webhook delivery logs
- Ensure app is running: `fly status --app your-app`

## Rollback Procedure

If you need to rollback:

```bash
# List recent releases
fly releases --app your-app

# Rollback to previous release
fly releases rollback <release-id> --app your-app
```

## Security Checklist

- ✅ All secrets stored in Fly.io (not in code)
- ✅ Private keys never logged or exposed
- ✅ Webhook secret matches GitHub App
- ✅ HTTPS enforced (automatic with Fly.io)
- ✅ Non-root user in Docker container
- ✅ Database file permissions restricted
- ✅ Regular dependency updates

## Support

For issues:
1. Check logs: `fly logs --app your-app`
2. Review Fly.io status: https://status.fly.io
3. Check GitHub App delivery logs
4. Review application error logs

