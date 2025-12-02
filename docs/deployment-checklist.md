# Deployment Checklist

This checklist guides you through completing v1 development and deploying to staging, then production.

## Phase 1: Pre-Deployment ✅

- [x] Create `.env.example` file
- [x] Create `fly.toml` configuration
- [x] Create GitHub Actions deploy workflow
- [ ] **Commit new files** (fly.toml, .github/workflows/deploy.yml, .env.example)
- [ ] **Merge `feature/m6-comprehensive-testing` into `main`**

### Files Created
- ✅ `.env.example` - Environment variable template
- ✅ `fly.toml` - Fly.io deployment configuration
- ✅ `.github/workflows/deploy.yml` - Automated deployment workflow
- ✅ `docs/github-app-setup.md` - GitHub App setup guide
- ✅ `docs/staging-deployment.md` - Staging deployment guide
- ✅ `docs/production-deployment.md` - Production deployment guide

## Phase 2: GitHub App Setup

Follow the guide in [github-app-setup.md](./github-app-setup.md):

- [ ] Create GitHub App
- [ ] Configure permissions (Contents: R/W, Pull requests: R/W, Issues: R/W, Metadata: R)
- [ ] Subscribe to events (Pull request, Issue comment)
- [ ] Generate and save credentials:
  - [ ] App ID
  - [ ] Private Key (.pem file)
  - [ ] Webhook Secret

## Phase 3: Staging Deployment

Follow the guide in [staging-deployment.md](./staging-deployment.md):

- [ ] Install Fly.io CLI: `curl -L https://fly.io/install.sh | sh`
- [ ] Authenticate: `fly auth login`
- [ ] Initialize staging app: `fly launch --name ai-pr-reviewer-staging --region iad --no-deploy`
- [ ] Create persistent volume: `fly volumes create ai_pr_data --size 1 --region iad --app ai-pr-reviewer-staging`
- [ ] Set secrets (see staging-deployment.md for commands)
- [ ] Deploy: `fly deploy --app ai-pr-reviewer-staging`
- [ ] Update GitHub App webhook URL to staging endpoint

## Phase 4: Staging Validation

- [ ] Health check: `curl https://ai-pr-reviewer-staging.fly.dev/health`
- [ ] Install GitHub App on test repository
- [ ] Test automatic PR review (open a test PR)
- [ ] Test `/ai-review` slash command
- [ ] Test `/ai-fix-lints` Dev Agent command (creates PR)
- [ ] Verify database persistence (restart app, check data)
- [ ] Review logs: `fly logs --app ai-pr-reviewer-staging`

## Phase 5: Production Deployment

Follow the guide in [production-deployment.md](./production-deployment.md):

- [ ] Create production app: `fly launch --name ai-pr-reviewer --region iad --no-deploy`
- [ ] Create production volume: `fly volumes create ai_pr_data --size 5 --region iad --app ai-pr-reviewer`
- [ ] Set production secrets (use production API keys)
- [ ] Deploy: `fly deploy --app ai-pr-reviewer`
- [ ] Update GitHub App webhook URL to production endpoint
- [ ] Install GitHub App on target repositories
- [ ] Monitor initial usage and verify functionality

## Post-Deployment

- [ ] Set up Fly.io monitoring/alerts
- [ ] Document any environment-specific configurations
- [ ] Update README with production deployment info
- [ ] Create runbook for common operations

## Quick Reference

### Staging URLs
- App: `https://ai-pr-reviewer-staging.fly.dev`
- Health: `https://ai-pr-reviewer-staging.fly.dev/health`
- Webhook: `https://ai-pr-reviewer-staging.fly.dev/webhooks/github`

### Production URLs
- App: `https://ai-pr-reviewer.fly.dev`
- Health: `https://ai-pr-reviewer.fly.dev/health`
- Webhook: `https://ai-pr-reviewer.fly.dev/webhooks/github`

### Useful Commands

```bash
# View logs
fly logs --app ai-pr-reviewer-staging
fly logs --app ai-pr-reviewer

# Check status
fly status --app ai-pr-reviewer-staging
fly status --app ai-pr-reviewer

# List secrets
fly secrets list --app ai-pr-reviewer-staging
fly secrets list --app ai-pr-reviewer

# Restart app
fly apps restart ai-pr-reviewer-staging
fly apps restart ai-pr-reviewer
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

