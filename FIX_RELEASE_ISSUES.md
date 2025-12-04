# Fix Release Issues

## Issues Found

### ✅ Issue 1: GitHub Release - FIXED
- **Problem**: Using deprecated `actions/create-release@v1` with permissions issues
- **Fix**: Updated to modern `softprops/action-gh-release@v1` with proper permissions
- **Status**: Workflow file updated ✅

### ⚠️ Issue 2: npm Publish - NEEDS YOUR ACTION
- **Problem**: `403 Forbidden - You may not perform that action with these credentials`
- **Cause**: NPM_TOKEN doesn't have publish permissions or is incorrect
- **Status**: Needs verification

---

## Fix npm Publish Issue

The npm publish failed because your `NPM_TOKEN` doesn't have the right permissions.

### Step 1: Verify NPM_TOKEN Secret

1. **Go to GitHub Secrets**:
   ```
   https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions
   ```

2. **Check if `NPM_TOKEN` exists**:
   - If missing → Add it (see Step 2)
   - If exists → Verify it's correct (see Step 3)

### Step 2: Create/Update NPM_TOKEN

1. **Go to npm**:
   ```
   https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   ```
   (Replace `YOUR_USERNAME` with your npm username)

2. **Generate New Token**:
   - Click **"Generate New Token"**
   - Select **"Automation"** type (NOT "Publish")
   - Automation tokens have full publish permissions
   - Expiration: Choose 1 year or longer
   - Click **"Generate Token"**
   - **Copy the token immediately** (you won't see it again!)

3. **Update GitHub Secret**:
   - Go to: https://github.com/bdaly101/AI-PR-Dev/settings/secrets/actions
   - Find `NPM_TOKEN` (or create new secret)
   - Click **"Update"** (or "New repository secret")
   - Paste your npm Automation token
   - Click **"Update secret"**

### Step 3: Verify Token Type

**Important**: The token MUST be "Automation" type, not "Publish" type.

- ✅ **Automation** - Can publish packages (correct)
- ❌ **Publish** - Limited permissions (won't work for CI/CD)

If you only have a "Publish" token, generate a new "Automation" token.

### Step 4: Verify Package Name

The package name `ai-pr-dev` is available (verified ✅), so that's not the issue.

---

## After Fixing NPM_TOKEN

Once you've updated the `NPM_TOKEN` secret:

1. **Retry the release** by updating the tag:
   ```bash
   # Delete the old tag
   git tag -d v1.0.0
   git push origin :refs/tags/v1.0.0
   
   # Recreate and push tag
   git tag v1.0.0
   git push origin v1.0.0
   ```

   This will trigger the workflow again with the fixed release action and (hopefully) correct npm token.

2. **Monitor the workflow**:
   ```
   https://github.com/bdaly101/AI-PR-Dev/actions
   ```

---

## What Was Fixed

### ✅ GitHub Release Action

**Before** (deprecated):
```yaml
uses: actions/create-release@v1
```

**After** (modern):
```yaml
uses: softprops/action-gh-release@v1
permissions:
  contents: write
```

The new action:
- Works with modern GitHub permissions
- Has proper `contents: write` permission
- Supports release notes generation
- More reliable and maintained

### ⏳ npm Publish

**Issue**: 403 Forbidden error
**Solution**: Verify/update `NPM_TOKEN` secret with "Automation" type token

---

## Quick Checklist

Before retrying:
- [ ] Updated GitHub Release workflow (done ✅)
- [ ] Verified `NPM_TOKEN` exists in GitHub secrets
- [ ] Verified `NPM_TOKEN` is "Automation" type (not "Publish")
- [ ] Verified `DOCKER_USERNAME` exists
- [ ] Verified `DOCKER_PASSWORD` exists
- [ ] Ready to retry release

---

## Next Steps

1. **Fix NPM_TOKEN** (see Step 2 above)
2. **Commit the workflow fix** (I'll do this)
3. **Retry the release** (update the tag)

Let me know when you've fixed the NPM_TOKEN and I'll help you retry the release!

