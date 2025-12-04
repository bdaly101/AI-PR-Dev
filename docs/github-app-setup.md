# GitHub App Setup Guide

This guide walks through creating and configuring the GitHub App required for AI PR Reviewer.

## Step 1: Create GitHub App

1. Navigate to your GitHub account settings:
   - Go to https://github.com/settings/apps
   - Or: GitHub Profile → Settings → Developer settings → GitHub Apps

2. Click **"New GitHub App"**

3. Fill in the basic information:
   - **GitHub App name**: `AI PR Reviewer` (or your preferred name)
   - **Homepage URL**: Your repository URL or documentation site
   - **Webhook URL**: 
     - For staging: `https://your-app-staging.fly.dev/webhooks/github` (or your staging URL)
     - For production: `https://your-app.fly.dev/webhooks/github` (or your production URL)
     - *Note: Update this after deployment*
   - **Webhook secret**: Generate a secure random string:
     ```bash
     openssl rand -hex 32
     ```
     Save this value - you'll need it for environment variables.

## Step 2: Configure Permissions

### Repository Permissions

Set the following permissions:

- **Contents**: Read & Write
  - Required for Dev Agent to create branches and commit changes
  
- **Pull requests**: Read & Write
  - Required to post reviews, comments, and create PRs
  
- **Issues**: Read & Write
  - Required to respond to slash commands in issue/PR comments
  
- **Metadata**: Read-only
  - Required for basic repository access

### Subscribe to Events

Enable the following events:

- ✅ **Pull request** - Triggers automatic reviews
- ✅ **Issue comment** - Handles slash commands

## Step 3: Generate Credentials

1. **App ID**: 
   - Found on the app settings page
   - Save this value for `GITHUB_APP_ID`

2. **Private Key**:
   - Click "Generate a private key"
   - Download the `.pem` file
   - Save securely - you'll need the full key content for `GITHUB_PRIVATE_KEY`
   - The key should include newlines (`\n`) when set as environment variable

3. **Webhook Secret**:
   - Use the secret you generated in Step 1
   - Save for `GITHUB_WEBHOOK_SECRET`

## Step 4: Install the App

1. After creating the app, click **"Install App"**
2. Choose which repositories to install on:
   - All repositories
   - Only select repositories
   - Only on this account
3. Complete the installation

## Step 5: Update Webhook URL After Deployment

Once you've deployed to Fly.io:

1. Go back to your GitHub App settings
2. Update the **Webhook URL** to your deployed endpoint:
   - Staging: `https://your-app-staging.fly.dev/webhooks/github` (or your staging URL)
   - Production: `https://your-app.fly.dev/webhooks/github` (or your production URL)
3. Save changes

## Verification

After setup, you can verify the app is working by:

1. Opening a test pull request in an installed repository
2. The app should automatically post a review comment
3. Try a slash command like `/ai-review` in a PR comment

## Troubleshooting

### Webhook Not Receiving Events

- Verify the webhook URL is correct and accessible
- Check that the webhook secret matches in both GitHub and your environment variables
- Review GitHub's webhook delivery logs in the app settings
- Check Fly.io logs: `fly logs`

### Permission Errors

- Ensure all required permissions are set (Contents, Pull requests, Issues)
- Verify the app is installed on the repository
- Check that the private key is correctly formatted (with `\n` for newlines)

### App Not Responding

- Verify environment variables are set correctly in Fly.io
- Check application logs for errors
- Ensure the health endpoint responds: `curl https://your-app.fly.dev/health`

