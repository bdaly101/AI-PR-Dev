# Public Release Guide

This guide helps you make AI-PR-Dev available to other developers after v1.0.0 release.

---

## Prerequisites

- ✅ v1.0.0 tagged and released to npm
- ✅ Docker image published
- ✅ Repository is ready to be public
- ✅ Documentation is complete

---

## Making the Repository Public

### Step 1: Review Repository Settings

Before making public, verify:

1. **No secrets in code**
   ```bash
   # Check for any committed secrets
   git log --all --full-history --source -S "sk-" 
   git log --all --full-history --source -S "GITHUB_PRIVATE_KEY"
   ```

2. **All sensitive data in .gitignore**
   - ✅ `.env` files
   - ✅ `*.pem` files
   - ✅ Database files

3. **Repository metadata**
   - Go to: https://github.com/bdaly101/AI-PR-Dev/settings
   - Review description, topics, website

### Step 2: Make Repository Public

1. Go to: https://github.com/bdaly101/AI-PR-Dev/settings
2. Scroll to **"Danger Zone"**
3. Click **"Change visibility"**
4. Select **"Make public"**
5. Type repository name to confirm
6. Click **"I understand, change repository visibility"**

⚠️ **Warning**: Once public, anyone can see all code and commit history.

---

## Publishing to npm

The release workflow automatically publishes when you tag v1.0.0, but verify:

### Check npm Package

After tagging v1.0.0:

```bash
# Wait ~5 minutes for workflow to complete
npm info ai-pr-dev

# Should show:
# - version: 1.0.0
# - repository: https://github.com/bdaly101/AI-PR-Dev.git
```

### Manual Publish (if needed)

```bash
npm login
npm publish
```

---

## Publishing Docker Image

The release workflow also pushes to Docker Hub automatically.

### Verify Docker Image

```bash
docker pull bdaly101/ai-pr-dev:1.0.0
docker run --rm bdaly101/ai-pr-dev:1.0.0 --version
```

### Manual Push (if needed)

```bash
docker login
docker build -t bdaly101/ai-pr-dev:1.0.0 .
docker push bdaly101/ai-pr-dev:1.0.0
docker push bdaly101/ai-pr-dev:latest
```

---

## GitHub Marketplace (Optional)

You can list your GitHub App in the marketplace:

1. Go to: https://github.com/settings/apps
2. Click your app
3. Scroll to **"Marketplace"** section
4. Click **"Submit to GitHub Marketplace"**
5. Fill out listing details:
   - Pricing (Free recommended)
   - Category
   - Screenshots
   - Description

---

## Documentation for Users

Your documentation is already comprehensive:

### Key Files
- `README.md` - Main entry point
- `docs/getting-started.md` - Setup guide
- `docs/github-app-setup.md` - GitHub App creation
- `docs/deployment.md` - Deployment options
- `docs/user-guide.md` - How to use features

### What Users Need to Know

1. **They need their own:**
   - GitHub App (they create it)
   - OpenAI API key
   - Deployment platform (Fly.io, Railway, etc.)

2. **Installation options:**
   - npm: `npm install -g ai-pr-dev`
   - Docker: `docker pull bdaly101/ai-pr-dev`
   - From source: Clone and build

3. **One-click deploy:**
   - Railway deploy button in README
   - Fly.io template (if created)

---

## Cost Model for Users

**Zero cost to you** - each user:
- Creates their own GitHub App (free)
- Deploys their own instance ($0-5/month)
- Uses their own API keys (pay-per-use)

**Your costs:**
- Fly.io hosting: $0-5/month (for your instance)
- npm: Free
- Docker Hub: Free

---

## Support Channels

Set up before going public:

### 1. GitHub Issues
- Already configured
- Issue templates ready

### 2. Discussions (Optional)
- Enable at: https://github.com/bdaly101/AI-PR-Dev/settings
- Check "Discussions" → Enable

### 3. Security Advisories
- Already configured
- Private vulnerability reporting enabled

---

## Announcement Template

When ready to announce:

```markdown
# 🚀 AI-PR-Dev v1.0.0 Released!

AI-PR-Dev is a GitHub App that automates code reviews using GPT-4.

## Features
- 🤖 Automated code reviews
- 🛠️ Slash commands for PRs
- 🎯 Cursor IDE integration
- 📊 Web dashboard

## Quick Start

```bash
npm install -g ai-pr-dev
```

Or deploy with one click:
[![Deploy on Railway](https://railway.app/button.svg)](...)

## Links
- GitHub: https://github.com/bdaly101/AI-PR-Dev
- Documentation: https://github.com/bdaly101/AI-PR-Dev#readme
- npm: https://www.npmjs.com/package/ai-pr-dev

## Support
- Issues: https://github.com/bdaly101/AI-PR-Dev/issues
- Security: https://github.com/bdaly101/AI-PR-Dev/security/advisories/new
```

---

## Post-Release Monitoring

### First Week
- Monitor GitHub Issues
- Check Fly.io logs for errors
- Review npm download stats
- Watch for security reports

### Metrics to Track
- npm downloads
- GitHub stars/forks
- Docker pulls
- Issue submissions
- Deployment success rate

---

## Next Steps

1. ✅ Complete release checklist items
2. ✅ Fix webhook secret
3. ✅ Tag and push v1.0.0
4. ✅ Verify npm/Docker publication
5. Make repository public (if desired)
6. Announce release (optional)
7. Monitor and gather feedback

