# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-04

### Added
- Initial release of AI-PR-Dev
- Automated code reviews using GPT-4
- Risk analysis and inline code suggestions
- Slash commands for PR comments:
  - `/ai-review` - Trigger AI code review
  - `/ai-explain` - Get AI explanation for code
  - `/ai-fix-lints` - Create PR with lint fixes
  - `/ai-add-types` - Add TypeScript type annotations
  - `/ai-improve-docs` - Improve inline documentation
  - `/ai-help` - Show available commands
- GitHub App integration with webhook support
- CLI tools for querying reviews and managing the app
- MCP server for Cursor IDE integration
- Web dashboard for monitoring and configuration
- REST API for programmatic access
- Support for OpenAI GPT-4 and Anthropic Claude (fallback)
- Repository configuration via `.ai-pr-reviewer.yml`
- SQLite database for storing reviews and metrics
- Comprehensive documentation

### Security
- Webhook signature verification
- Optional API key authentication
- Environment variable configuration
- No auto-merge - all changes require human approval

## [Unreleased]

### Planned
- Support for additional AI providers
- Enhanced dashboard features
- More slash commands
- Improved error handling and retry logic
- Performance optimizations
- Additional test coverage

---

[1.0.0]: https://github.com/bdaly101/AI-PR-Dev/releases/tag/v1.0.0

