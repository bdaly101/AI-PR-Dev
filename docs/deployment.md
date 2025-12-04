# Deployment Guide

This guide covers deploying AI PR Reviewer to production environments.

## Prerequisites

- Docker (for containerized deployment)
- GitHub App credentials
- OpenAI API key
- (Optional) Anthropic API key for Claude fallback

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_APP_ID` | Yes | Your GitHub App ID |
| `GITHUB_PRIVATE_KEY` | Yes | GitHub App private key (with `\n` for newlines) |
| `GITHUB_WEBHOOK_SECRET` | Yes | Secret for validating webhooks |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4 |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for Claude fallback |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: production) |
| `DATABASE_PATH` | No | SQLite database path (default: ./data/app.db) |

## Deployment Options

### Option 1: Docker

Build and run with Docker:

```bash
# Build the image
docker build -t ai-pr-reviewer .

# Run the container
docker run -d \
  --name ai-pr-reviewer \
  -p 3000:3000 \
  -v ai-pr-data:/app/data \
  -e GITHUB_APP_ID=your_app_id \
  -e GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..." \
  -e GITHUB_WEBHOOK_SECRET=your_secret \
  -e OPENAI_API_KEY=sk-... \
  ai-pr-reviewer
```

### Option 2: Fly.io

1. Install the Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Create `fly.toml`:
```toml
app = "ai-pr-reviewer"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512

[mounts]
  source = "ai_pr_data"
  destination = "/app/data"
```

3. Set secrets:
```bash
fly secrets set GITHUB_APP_ID=your_app_id
fly secrets set GITHUB_PRIVATE_KEY="$(cat private-key.pem)"
fly secrets set GITHUB_WEBHOOK_SECRET=your_secret
fly secrets set OPENAI_API_KEY=sk-...
```

4. Deploy:
```bash
fly launch
fly deploy
```

### Option 3: Railway

1. Connect your GitHub repository to Railway
2. Add environment variables in the Railway dashboard
3. Railway will auto-detect the Dockerfile and deploy

### Option 4: Manual (VPS/EC2)

1. Clone the repository:
```bash
git clone https://github.com/bdaly101/AI-PR-Dev.git
cd AI-PR-Dev
```

2. Install dependencies:
```bash
npm ci --only=production
npm run build
```

3. Set up environment:
```bash
export GITHUB_APP_ID=your_app_id
export GITHUB_PRIVATE_KEY="..."
export GITHUB_WEBHOOK_SECRET=your_secret
export OPENAI_API_KEY=sk-...
export NODE_ENV=production
```

4. Run with a process manager:
```bash
# Using PM2
npm install -g pm2
pm2 start dist/index.js --name ai-pr-reviewer

# Or using systemd
# Create /etc/systemd/system/ai-pr-reviewer.service
```

## GitHub App Configuration

1. **Webhook URL**: Set to your deployment URL + `/webhooks/github`
   - Example: `https://your-app.fly.dev/webhooks/github` (replace with your actual URL)

2. **Webhook Secret**: Must match `GITHUB_WEBHOOK_SECRET` environment variable

3. **Permissions Required**:
   - Repository contents: Read & Write
   - Pull requests: Read & Write
   - Issues: Read & Write
   - Metadata: Read-only

4. **Events to Subscribe**:
   - Pull request
   - Issue comment

## Post-Deployment Checklist

- [ ] Health check endpoint responds: `GET /health`
- [ ] Webhook signature validation works
- [ ] Test review on a sample PR
- [ ] Check logs for any errors
- [ ] Verify database persistence across restarts

## Monitoring

### Health Check

The `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Logs

In Docker:
```bash
docker logs -f ai-pr-reviewer
```

In Fly.io:
```bash
fly logs
```

### Metrics

Metrics are stored in the SQLite database. Access via the metrics repository:
- Reviews per day
- Average response time
- Success rate
- Files/lines reviewed

## Troubleshooting

### Webhook not receiving events
1. Check the webhook URL is correct
2. Verify the webhook secret matches
3. Check GitHub's webhook delivery logs

### AI reviews failing
1. Check OpenAI API key is valid
2. Verify rate limits haven't been exceeded
3. Check if Anthropic fallback is configured

### Database issues
1. Ensure the data volume is mounted correctly
2. Check file permissions on the database directory
3. Verify `DATABASE_PATH` environment variable

## Scaling

For high-traffic scenarios:
1. Use a persistent volume for the SQLite database
2. Consider PostgreSQL for multi-instance deployments
3. Implement request queuing for large PRs
4. Monitor OpenAI API rate limits

## Security Recommendations

1. Use HTTPS for all webhook traffic
2. Rotate secrets periodically
3. Keep dependencies updated
4. Use read-only filesystem where possible
5. Run as non-root user (default in Dockerfile)

