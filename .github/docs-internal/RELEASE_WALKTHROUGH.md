# v1.0.0 Release Walkthrough

This guide walks you through the final steps to release AI-PR-Dev v1.0.0 and make it available to other developers.

---

## Pre-Release Checklist

Before releasing, ensure everything is ready:

### ✅ Code Quality
- [x] All tests passing (484 tests)
- [x] Lint passes with no errors
- [x] Build succeeds
- [x] TypeScript compilation successful

### ✅ Documentation
- [x] README is polished and clear
- [x] All documentation is consistent
- [x] All repository URLs updated to `bdaly101`
- [x] Installation instructions clear

### ✅ Deployment
- [x] Production deployment working on Fly.io
- [x] Health check endpoint responding
- [ ] **Webhook secret fixed** (see below)

---

## Step 1: Fix Webhook Secret (5 minutes)

Your webhook signature verification is currently failing. Fix it:

1. **Get your webhook secret from GitHub**:
   - Go to: https://github.com/settings/apps
   - Click your GitHub App
   - Scroll to "Webhook" section
   - **Copy the secret value**

2. **Update Fly.io secret**:
   ```bash
   fly secrets set GITHUB_WEBHOOK_SECRET="<paste_secret_here>" --app ai-dev-pr-reviewer
   ```

3. **Verify it works**:
   - Go to PR #22: https://github.com/bdaly101/AI-PR-Dev/pull/22
   - Comment: `/ai-review`
   - Check Fly.io logs: `fly logs --app ai-dev-pr-reviewer`
   - You should see webhook received and processed (no signature errors)

---

## Step 2: Configure GitHub Secrets for Release (10 minutes)

These secrets are needed for the release workflow to publish to npm and Docker Hub.

### 2.1 Get npm Token

1. Go to: https://www.npmjs.com/login (log in if needed)
2. Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
3. Click **"Generate New Token"**
4. Select **"Automation"** type
5. Click **"Generate Token"**
6. **Copy the token immediately** (you won't see it again!)

### 2.2 Get Docker Hub Credentials

1. **Get your Docker Hub username**
   - Your login username at https://hub.docker.com

2. **Create access token**:
   - Go to: https://hub.docker.com/settings/security
   - Click **"New Access Token"**
   - Description: `AI-PR-Dev GitHub Actions`
   - Permissions: **Read & Write**
   - Click **"Generate"**
   - **Copy the token** (save it securely)

### 2.3 Add Secrets to GitHub

Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions

Add these three secrets:

1. **NPM_TOKEN**
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm automation token
   - Click "Add secret"

2. **DOCKER_USERNAME**
   - Click "New repository secret"
   - Name: `DOCKER_USERNAME`
   - Value: Your Docker Hub username
   - Click "Add secret"

3. **DOCKER_PASSWORD**
   - Click "New repository secret"
   - Name: `DOCKER_PASSWORD`
   - Value: Your Docker Hub access token (not your password!)
   - Click "Add secret"

**Verify**: You should see all three secrets listed (values hidden as dots).

---

## Step 3: Verify Release Readiness (5 minutes)

Run these final checks:

```bash
# Test build
npm run build

# Run tests
npm test

# Check lint
npm run lint

# Verify deployment
curl https://ai-dev-pr-reviewer.fly.dev/health
```

All should pass without errors.

---

## Step 4: Commit Final Changes (if any)

If you made any final fixes:

```bash
git add .
git commit -m "chore: finalize v1.0.0 release"
git push origin main
```

---

## Step 5: Tag and Release v1.0.0

Once all checks pass and secrets are configured:

```bash
# Create the release tag
git tag v1.0.0

# Push the tag (this triggers the release workflow)
git push origin v1.0.0
```

**What happens next**:
1. GitHub Actions workflow starts automatically
2. Builds and publishes to npm as `ai-pr-dev@1.0.0`
3. Builds and pushes Docker image to Docker Hub
4. Creates GitHub Release with changelog

**Monitor progress**: https://github.com/bdaly101/AI-PR-Dev/actions

---

## Step 6: Verify Release (10 minutes)

After ~5-10 minutes, verify everything was published:

### 6.1 Check npm Package

```bash
npm info ai-pr-dev
```

Should show:
- `version: 1.0.0`
- `repository: https://github.com/bdaly101/AI-PR-Dev.git`

### 6.2 Check Docker Image

Replace `YOUR_DOCKER_USERNAME` with your actual Docker Hub username:

```bash
docker pull YOUR_DOCKER_USERNAME/ai-pr-dev:1.0.0
```

Should pull successfully.

### 6.3 Check GitHub Release

Visit: https://github.com/bdaly101/AI-PR-Dev/releases/tag/v1.0.0

Should show:
- Release notes from CHANGELOG.md
- Source code assets (zip/tar.gz)
- Link to npm package

### 6.4 Test Installation

```bash
npm install -g ai-pr-dev
ai-pr --version
```

Should install and show version 1.0.0.

---

## Step 7: Make Repository Public (Optional)

If you want others to use it:

1. Go to: https://github.com/bdaly101/AI-PR-Dev/settings
2. Scroll to **"Danger Zone"**
3. Click **"Change visibility"**
4. Select **"Make public"**
5. Type repository name to confirm
6. Click **"I understand, change repository visibility"**

⚠️ **Warning**: Once public, all code and history is visible to everyone.

---

## Step 8: Announce Release (Optional)

You can announce on:
- GitHub Discussions
- Twitter/X
- Reddit (r/node, r/typescript, etc.)
- Product Hunt
- Dev.to blog post

Use this template:

```markdown
🚀 AI-PR-Dev v1.0.0 is now available!

A GitHub App that automates code reviews using GPT-4.

✨ Features:
- Automated code reviews
- Slash commands for PRs
- Cursor IDE integration
- Web dashboard

📦 Install: `npm install -g ai-pr-dev`

🔗 https://github.com/bdaly101/AI-PR-Dev
```

---

## Post-Release Tasks

### Immediate
- [ ] Monitor GitHub Actions workflow for any failures
- [ ] Check npm package downloads
- [ ] Watch for GitHub issues/questions
- [ ] Monitor Fly.io deployment (auto-update may occur)

### First Week
- [ ] Respond to any GitHub issues
- [ ] Monitor Docker Hub pulls
- [ ] Gather user feedback
- [ ] Check error logs on Fly.io

### Ongoing
- [ ] Keep dependencies updated
- [ ] Address security vulnerabilities promptly
- [ ] Plan v1.1 features based on feedback

---

## Troubleshooting

### Release Workflow Fails

**npm publish fails**:
- Check `NPM_TOKEN` is set correctly
- Verify token has "Automation" permissions
- Check npm package name isn't already taken

**Docker push fails**:
- Verify `DOCKER_USERNAME` matches your Docker Hub username exactly
- Verify `DOCKER_PASSWORD` is an access token, not your password
- Check token has Read & Write permissions

**GitHub Release fails**:
- Usually auto-resolves, check Actions logs
- `GITHUB_TOKEN` is automatically provided by GitHub Actions

### After Release

**Package not found on npm**:
- Wait a few minutes (npm propagation delay)
- Check Actions logs for errors
- Verify package name in package.json

**Docker image not found**:
- Check Docker Hub repository name matches `DOCKER_USERNAME/ai-pr-dev`
- Verify workflow completed successfully
- Check Docker Hub for the image

---

## Next Steps

Once released:

1. **Share with your team/organization**
2. **Get feedback from early users**
3. **Monitor usage and performance**
4. **Plan improvements for v1.1**

Congratulations on your v1.0.0 release! 🎉

---

## Quick Reference

| Item | Command/Link |
|------|--------------|
| **Monitor Release** | https://github.com/bdaly101/AI-PR-Dev/actions |
| **npm Package** | https://www.npmjs.com/package/ai-pr-dev |
| **Docker Hub** | https://hub.docker.com/r/YOUR_USERNAME/ai-pr-dev |
| **GitHub Release** | https://github.com/bdaly101/AI-PR-Dev/releases |
| **View Logs** | `fly logs --app ai-dev-pr-reviewer` |
| **Health Check** | https://ai-dev-pr-reviewer.fly.dev/health |

---

**Need help?** Check the [Troubleshooting Guide](troubleshooting.md) or open an issue.

