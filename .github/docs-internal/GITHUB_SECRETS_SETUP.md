# GitHub Secrets Setup Guide

This guide walks you through setting up GitHub Secrets required for automated releases and deployments.

---

## Required Secrets

| Secret Name | Purpose | Required For |
|-------------|---------|--------------|
| `NPM_TOKEN` | npm authentication | Publishing to npm |
| `DOCKER_USERNAME` | Docker Hub username | Pushing Docker images |
| `DOCKER_PASSWORD` | Docker Hub access token | Pushing Docker images |
| `FLY_API_TOKEN` | Fly.io API access | Auto-deployment (optional) |

---

## Step 1: Get npm Token

1. **Log in to npm**
   - Go to: https://www.npmjs.com/login
   - Or use: `npm login` in terminal

2. **Create Access Token**
   - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click **"Generate New Token"**
   - Select **"Automation"** type (recommended) or **"Publish"**
   - Click **"Generate Token"**
   - **Copy the token immediately** (you won't see it again!)

3. **Add to GitHub Secrets**
   - Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click **"Add secret"**

---

## Step 2: Get Docker Hub Credentials

### Get Your Docker Hub Username

Your Docker Hub username is the one you use to log in at https://hub.docker.com

### Create Access Token

1. **Log in to Docker Hub**
   - Go to: https://hub.docker.com/login

2. **Create Access Token**
   - Go to: https://hub.docker.com/settings/security
   - Click **"New Access Token"**
   - Description: `AI-PR-Dev GitHub Actions`
   - Permissions: **Read & Write**
   - Click **"Generate"**
   - **Copy the token** (save it securely)

3. **Add to GitHub Secrets**
   
   **Secret 1: Username**
   - Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions
   - Click **"New repository secret"**
   - Name: `DOCKER_USERNAME`
   - Value: Your Docker Hub username
   - Click **"Add secret"**

   **Secret 2: Password (Access Token)**
   - Click **"New repository secret"** again
   - Name: `DOCKER_PASSWORD`
   - Value: The access token you just created
   - Click **"Add secret"**

⚠️ **Important**: Use the **access token** as the password, NOT your Docker Hub password.

---

## Step 3: Get Fly.io Token (Optional - for auto-deploy)

If you want automatic deployments when pushing to main:

1. **Install Fly CLI** (if not already installed)
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Deploy Token**
   ```bash
   fly tokens create deploy -x 999999h
   ```
   This creates a token that expires in ~114 years (essentially never).

3. **Add to GitHub Secrets**
   - Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions
   - Click **"New repository secret"**
   - Name: `FLY_API_TOKEN`
   - Value: Paste the token from step 2
   - Click **"Add secret"**

---

## Step 4: Verify Secrets Are Set

Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions

You should see:
- ✅ `NPM_TOKEN` (dots indicate it's set)
- ✅ `DOCKER_USERNAME` (dots indicate it's set)
- ✅ `DOCKER_PASSWORD` (dots indicate it's set)
- ✅ `FLY_API_TOKEN` (if you added it)

**Note**: GitHub hides the values for security. You'll only see dots (●●●●●●).

---

## Testing the Secrets

### Test npm Token

When you tag v1.0.0, the release workflow will:
1. Build the project
2. Run `npm publish`
3. If successful, you'll see the package at: https://www.npmjs.com/package/ai-pr-dev

### Test Docker Secrets

The release workflow will:
1. Build Docker image
2. Tag it with version and `latest`
3. Push to Docker Hub

You can verify at: https://hub.docker.com/r/YOUR_USERNAME/ai-pr-dev

---

## Troubleshooting

### npm Publish Fails

**Error**: `npm ERR! code ENEEDAUTH`

**Fix**: 
- Verify `NPM_TOKEN` is set correctly
- Check token has "Automation" or "Publish" permissions
- Try creating a new token

### Docker Push Fails

**Error**: `unauthorized: authentication required`

**Fix**:
- Verify `DOCKER_USERNAME` matches your Docker Hub username exactly
- Verify `DOCKER_PASSWORD` is the access token, not your password
- Check token has Read & Write permissions

### Fly.io Deploy Fails

**Error**: `Error: failed to fetch an access token`

**Fix**:
- Verify `FLY_API_TOKEN` is set
- Check token was created with `fly tokens create deploy`
- Try creating a new token

---

## Security Best Practices

1. **Use Access Tokens, Not Passwords**
   - npm: Use automation token
   - Docker: Use access token
   - Never commit tokens to code

2. **Rotate Tokens Regularly**
   - Every 90 days for production
   - Immediately if compromised

3. **Limit Token Permissions**
   - Only grant minimum required permissions
   - Use "Automation" tokens when possible

4. **Monitor Token Usage**
   - Check npm token activity
   - Review Docker Hub access logs
   - Watch GitHub Actions logs

---

## Next Steps

Once all secrets are configured:

1. Verify all secrets are set (above)
2. Tag the release: `git tag v1.0.0 && git push origin v1.0.0`
3. Watch the release workflow at: https://github.com/bdaly101/AI-PR-Dev/actions
4. Verify npm package appears: https://www.npmjs.com/package/ai-pr-dev
5. Verify Docker image appears: https://hub.docker.com/r/YOUR_USERNAME/ai-pr-dev

---

For more details, see [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

