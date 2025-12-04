# Frequently Asked Questions

## General

### What is AI-PR-Dev?

AI-PR-Dev is a GitHub App that automatically reviews pull requests using AI (GPT-4 or Claude). It provides code reviews, suggestions, and can even create PRs to fix issues.

### How does it work?

1. Install the GitHub App on your repositories
2. When a PR is opened or updated, the app automatically reviews it
3. The app posts a review comment with suggestions
4. You can also use slash commands to trigger reviews or fixes

### Is it free?

The core application is open-source and free. However, you'll need:
- OpenAI API key (pay-per-use)
- Or Anthropic API key (pay-per-use)
- Hosting for the app (if self-hosting)

### What AI models are supported?

- **OpenAI**: GPT-4 Turbo (primary)
- **Anthropic**: Claude 3.5 Sonnet (fallback)

## Setup

### How do I get started?

See the [Getting Started Guide](getting-started.md) for step-by-step instructions.

### Do I need to host it myself?

Yes, currently you need to self-host the application. We're working on a hosted version.

### What are the system requirements?

- Node.js 18+ and npm 9+
- GitHub account
- OpenAI or Anthropic API key
- Server/hosting for the app

### Can I use it without a GitHub App?

No, the app requires a GitHub App for authentication and webhook access.

## Usage

### How do I trigger a review?

Reviews are automatic when PRs are opened or updated. You can also comment `/ai-review` on a PR.

### Can I customize the review?

Yes! Create a `.ai-pr-reviewer.yml` file in your repository root. See [Configuration Guide](configuration.md).

### What slash commands are available?

- `/ai-review` - Trigger a review
- `/ai-explain` - Explain code
- `/ai-fix-lints` - Fix lint issues
- `/ai-add-types` - Add TypeScript types
- `/ai-improve-docs` - Improve documentation
- `/ai-help` - Show help

### Can the AI merge PRs automatically?

No! The app never auto-merges. All changes require human approval.

### How accurate are the reviews?

The reviews are generally accurate but should be treated as suggestions. Always review AI-generated code before merging.

## Configuration

### How do I configure per repository?

Create a `.ai-pr-reviewer.yml` file in your repository root. See [Configuration Guide](configuration.md).

### Can I ignore certain files?

Yes, use the `ignorePaths` option in configuration:

```yaml
reviewer:
  ignorePaths:
    - "*.test.ts"
    - "dist/*"
    - "node_modules/*"
```

### How do I change the AI model?

Set the `provider` and `model` in configuration:

```yaml
ai:
  provider: openai  # or anthropic
  model: gpt-4-turbo-preview
```

## Troubleshooting

### The app isn't reviewing my PRs

1. Check if the app is installed on the repository
2. Verify the webhook URL is correct
3. Check server logs for errors
4. Ensure the app has the required permissions

### I'm getting API errors

1. Verify your API keys are correct
2. Check your API quota/limits
3. Ensure you have access to GPT-4 (not just GPT-3.5)

### Webhooks aren't being received

1. Check the webhook URL in GitHub App settings
2. Verify webhook secret matches
3. Check GitHub's webhook delivery logs
4. Ensure the server is accessible from the internet

### Reviews are taking too long

1. Large PRs take longer to review
2. Check API rate limits
3. Consider using configuration to limit files reviewed
4. Check server logs for errors

## API & CLI

### How do I use the API?

See the [API Reference](api-reference.md) for full documentation.

### How do I use the CLI?

See the [CLI Reference](cli-reference.md) for full documentation.

### What's my installation ID?

Find it in:
1. GitHub App settings → Installations
2. Or in your database (if you have access)

## Security

### Is my code sent to OpenAI/Anthropic?

Yes, code diffs are sent to the AI providers for review. Only the changed code in PRs is sent, not your entire repository.

### How secure is the app?

- Webhook signatures are verified
- API keys are stored securely
- No code is stored permanently
- All changes require human approval

### Can I use it on private repositories?

Yes, the app works on both public and private repositories.

## Pricing

### How much does it cost?

The app itself is free. You pay for:
- OpenAI API usage (~$0.01-0.03 per review)
- Anthropic API usage (~$0.003-0.015 per review)
- Hosting costs (if self-hosting)

### How can I reduce costs?

1. Use configuration to limit files reviewed
2. Only review on specific events
3. Use less expensive models for simple reviews
4. Cache reviews to avoid re-reviewing

## Development

### Can I contribute?

Yes! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### How do I report bugs?

Open an issue on GitHub with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details

### How do I request features?

Open an issue with the "feature request" label or start a discussion.

## Support

### Where can I get help?

- 📖 [Documentation](.)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)
- 🔧 [Troubleshooting Guide](troubleshooting.md)

### How do I report security issues?

See [SECURITY.md](../SECURITY.md) for security policy and reporting.

