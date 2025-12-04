# v1.0.0 Release Checklist

## Pre-Release Tasks

### ✅ Completed
- [x] All code changes committed and merged to main
- [x] Repository placeholders updated (bdaly101)
- [x] Security documentation updated
- [x] Deployment checklist updated
- [x] Production deployment successful on Fly.io
- [x] All tests passing (484 tests)

### ⚠️ Action Required

#### 1. Fix Webhook Secret Mismatch

**Issue**: Webhook signature verification failing - secret in Fly.io doesn't match GitHub App.

**Fix**:
1. Go to your GitHub App settings: https://github.com/settings/apps
2. Find your app → Copy the **Webhook secret**
3. Update Fly.io:
   ```bash
   fly secrets set GITHUB_WEBHOOK_SECRET="<paste_secret_here>" --app ai-dev-pr-reviewer
   ```
4. Test by commenting `/ai-review` on PR #22

#### 2. Verify End-to-End Functionality

- [ ] Fix webhook secret (above)
- [ ] Test `/ai-review` command on a real PR
- [ ] Verify AI review is posted
- [ ] Test automatic PR review (open a new PR)
- [ ] Check logs: `fly logs --app ai-dev-pr-reviewer`

#### 3. Set Up GitHub Secrets for Release

Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions

Add these secrets:

| Secret | How to Get | Required For |
|--------|-----------|--------------|
| `NPM_TOKEN` | npmjs.com → Access Tokens → Generate token | npm publish |
| `DOCKER_USERNAME` | Your Docker Hub username | Docker image push |
| `DOCKER_PASSWORD` | Docker Hub → Account Settings → Security → Access Token | Docker image push |
| `FLY_API_TOKEN` | Already set (for auto-deploy) | Auto-deploy on push |

**Get NPM Token**:
1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Generate "Automation" token
3. Copy and add to GitHub Secrets

**Get Docker Hub Token**:
1. Go to https://hub.docker.com/settings/security
2. Create access token
3. Copy username and token to GitHub Secrets

---

## Release Steps

### Step 1: Final Verification

```bash
# Run all tests
npm test

# Check lint
npm run lint

# Verify build
npm run build

# Check deployment health
curl https://ai-dev-pr-reviewer.fly.dev/health
```

### Step 2: Push All Changes

```bash
git add .
git commit -m "chore: finalize v1.0.0 release"
git push origin main
```

### Step 3: Tag Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

**This automatically triggers**:
- ✅ npm publish workflow
- ✅ Docker image build and push
- ✅ GitHub Release creation

### Step 4: Verify Release

After ~5 minutes:

```bash
# Check npm package
npm info ai-pr-dev

# Check Docker image
docker pull bdaly101/ai-pr-dev:1.0.0

# Verify GitHub Release
# Visit: https://github.com/bdaly101/AI-PR-Dev/releases/tag/v1.0.0
```

---

## Post-Release

### Immediate
- [ ] Verify npm package installs: `npm install -g ai-pr-dev`
- [ ] Test Docker image locally
- [ ] Check GitHub Release page
- [ ] Monitor Fly.io deployment after release

### Documentation
- [ ] Update README with npm install instructions
- [ ] Create announcement (optional)
- [ ] Update any external documentation

### Monitoring
- [ ] Monitor Fly.io logs for first 24 hours
- [ ] Check npm download stats
- [ ] Watch for GitHub issues/questions

---

## Making It Available to Other Developers

### Option 1: Open Source Release (Recommended)

1. **Make Repository Public**
   - Go to: https://github.com/bdaly101/AI-PR-Dev/settings
   - Scroll to "Danger Zone"
   - Click "Change visibility" → "Make public"

2. **Update README**
   - Already includes installation instructions
   - Includes one-click deploy buttons

3. **Publish to npm**
   - Already configured via release workflow
   - Package name: `ai-pr-dev`

4. **Share Documentation**
   - All docs are in `/docs` folder
   - Getting started guide is comprehensive

### Option 2: Keep Private (Enterprise)

- Repository remains private
- Only invited collaborators can access
- npm package can still be published (optional)

---

## Security Notes

- ✅ Dev dependency vulnerabilities are acceptable (vitest/esbuild - dev-only)
- ✅ All production dependencies are secure
- ✅ Webhook signature verification working (once secret is fixed)
- ✅ No secrets in code
- ✅ Input validation throughout

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/bdaly101/AI-PR-Dev/issues
- Security: https://github.com/bdaly101/AI-PR-Dev/security/advisories/new

