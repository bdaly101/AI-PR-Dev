# Deployment Checklist

This checklist guides you through completing v1 development and deploying to staging, then production.

## Phase 1: Pre-Deployment ✅

- [x] Create `.env.example` file
- [x] Create `fly.toml` configuration
- [x] Create GitHub Actions deploy workflow
- [x] **Commit new files** (fly.toml, .github/workflows/deploy.yml, .env.example)
- [x] **Merge feature branches into `main`**

### Files Created
- ✅ `.env.example` - Environment variable template
- ✅ `fly.toml` - Fly.io deployment configuration
- ✅ `.github/workflows/deploy.yml` - Automated deployment workflow
- ✅ `docs/github-app-setup.md` - GitHub App setup guide
- ✅ `docs/staging-deployment.md` - Staging deployment guide
- ✅ `docs/production-deployment.md` - Production deployment guide

## Phase 2: GitHub App Setup

Follow the guide in [github-app-setup.md](./github-app-setup.md):

- [x] Create GitHub App
- [x] Configure permissions (Contents: R/W, Pull requests: R/W, Issues: R/W, Metadata: R)
- [x] Subscribe to events (Pull request, Issue comment)
- [x] Generate and save credentials:
  - [x] App ID
  - [x] Private Key (.pem file)
  - [x] Webhook Secret

## Phase 3: Staging Deployment

Follow the guide in [staging-deployment.md](./staging-deployment.md):

- [ ] Install Fly.io CLI: `curl -L https://fly.io/install.sh | sh`
- [ ] Authenticate: `fly auth login`
- [ ] Initialize staging app: `fly launch --name your-app-staging --region iad --no-deploy`
- [ ] Create persistent volume: `fly volumes create ai_pr_data --size 1 --region iad --app your-app-staging`
- [ ] Set secrets (see staging-deployment.md for commands)
- [ ] Deploy: `fly deploy --app your-app-staging`
- [ ] Update GitHub App webhook URL to staging endpoint

## Phase 4: Staging Validation

- [ ] Health check: `curl https://your-app-staging.fly.dev/health`
- [ ] Install GitHub App on test repository
- [ ] Test automatic PR review (open a test PR)
- [ ] Test `/ai-review` slash command
- [ ] Test `/ai-fix-lints` Dev Agent command (creates PR)
- [ ] Verify database persistence (restart app, check data)
- [ ] Review logs: `fly logs --app your-app-staging`

## Phase 5: Production Deployment

Follow the guide in [production-deployment.md](./production-deployment.md):

- [x] Create production app: `fly launch --name ai-dev-pr-reviewer --region iad --no-deploy`
- [x] Create production volume: `fly volumes create ai_pr_data --size 5 --region iad --app ai-dev-pr-reviewer`
- [x] Set production secrets (use production API keys)
- [x] Deploy: `fly deploy --app ai-dev-pr-reviewer`
- [x] Update GitHub App webhook URL to production endpoint: `https://ai-dev-pr-reviewer.fly.dev/webhooks/github`
- [x] Install GitHub App on target repositories
- [x] Monitor initial usage and verify functionality

## Post-Deployment

- [ ] Set up Fly.io monitoring/alerts (optional)
- [x] Document any environment-specific configurations
- [x] Update README with production deployment info
- [x] Create runbook for common operations (see docs/)

## Quick Reference

### Staging URLs
- App: `https://your-app-staging.fly.dev` (replace with your app name)
- Health: `https://your-app-staging.fly.dev/health`
- Webhook: `https://your-app-staging.fly.dev/webhooks/github`

### Production URLs
- App: `https://your-app.fly.dev` (replace with your app name)
- Health: `https://your-app.fly.dev/health`
- Webhook: `https://your-app.fly.dev/webhooks/github`

### Useful Commands

```bash
# View logs
fly logs --app your-app-staging
fly logs --app your-app

# Check status
fly status --app your-app-staging
fly status --app your-app

# List secrets
fly secrets list --app your-app-staging
fly secrets list --app your-app

# Restart app
fly apps restart your-app-staging
fly apps restart your-app
```

## Troubleshooting

If you encounter issues:

1. Check application logs: `fly logs --app <app-name>`
2. Verify secrets are set: `fly secrets list --app <app-name>`
3. Check GitHub App webhook delivery logs
4. Review deployment guides for specific error scenarios

## Next Steps After Production

- Monitor usage and performance
- Gather user feedback
- Plan v1.1 enhancements based on real-world usage
- Set up automated backups
- Document operational procedures

