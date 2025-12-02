# Configuration Guide

AI PR Reviewer can be configured per-repository using a `.ai-pr-reviewer.yml` file in the repository root.

## Configuration File

Create a `.ai-pr-reviewer.yml` file in your repository root:

```yaml
version: 1
enabled: true
mode: reviewer  # reviewer | dev_agent | both

reviewer:
  strictness: normal  # relaxed | normal | strict
  languages: [javascript, typescript, python]
  ignorePaths:
    - dist/*
    - node_modules/*
    - '*.test.ts'
    - '*.spec.ts'
    - coverage/*
  minSeverity: low  # low | medium | high
  maxFilesReviewed: 50

ai:
  provider: openai  # openai | anthropic
  model: gpt-4-turbo-preview
  temperature: 0.3

devAgent:
  enabled: false
  allowedCommands:
    - fix-lints
    - add-types
    - improve-docs
  maxFilesPerPR: 10
  maxLinesChanged: 200
  requireApproval: true
```

## Configuration Options

### Top-Level Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | number | 1 | Config file version |
| `enabled` | boolean | true | Enable/disable AI reviews |
| `mode` | string | "reviewer" | Operating mode |

### Reviewer Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strictness` | string | "normal" | Review strictness level |
| `languages` | string[] | [] | Preferred languages (hint for AI) |
| `ignorePaths` | string[] | [] | Glob patterns to ignore |
| `minSeverity` | string | "low" | Minimum severity to report |
| `maxFilesReviewed` | number | 50 | Maximum files to review |

### AI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | string | "openai" | Primary AI provider |
| `model` | string | - | Model to use (provider default if not set) |
| `temperature` | number | 0.3 | AI temperature (0-2) |

### Dev Agent Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | false | Enable dev agent features |
| `allowedCommands` | string[] | [...] | Allowed slash commands |
| `maxFilesPerPR` | number | 10 | Max files per AI PR |
| `maxLinesChanged` | number | 200 | Max lines per AI PR |
| `requireApproval` | boolean | true | Require approval before changes |

## Strictness Levels

### Relaxed

- Only flags significant bugs and security issues
- Ignores minor style inconsistencies
- Fewer suggestions, more encouraging feedback
- Best for: Rapid prototyping, early-stage projects

### Normal (Default)

- Balanced review with emphasis on quality
- Flags bugs, security issues, and significant problems
- Notes important style inconsistencies
- Best for: Most production codebases

### Strict

- Thorough and comprehensive review
- Flags all potential issues including minor ones
- Enforces consistent code style
- Checks for edge cases and error handling
- Best for: Critical systems, security-sensitive code

## Ignore Patterns

Use glob patterns to exclude files from review:

```yaml
ignorePaths:
  # Directories
  - dist/*
  - node_modules/*
  - .next/*
  - coverage/*
  
  # File types
  - '*.min.js'
  - '*.min.css'
  - '*.map'
  - '*.generated.*'
  
  # Test files
  - '*.test.ts'
  - '*.spec.ts'
  - __tests__/*
  
  # Lock files (always ignored by default)
  - package-lock.json
  - yarn.lock
```

### Default Ignore Patterns

These patterns are always ignored:
- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`
- `*.min.js`
- `*.min.css`
- `*.map`
- `dist/*`
- `build/*`
- `node_modules/*`

## Example Configurations

### Minimal Configuration

```yaml
version: 1
enabled: true
```

### TypeScript Project

```yaml
version: 1
enabled: true

reviewer:
  strictness: normal
  languages: [typescript]
  ignorePaths:
    - dist/*
    - '*.js'  # Only review TypeScript
  minSeverity: low

ai:
  provider: openai
  model: gpt-4-turbo-preview
```

### Security-Focused

```yaml
version: 1
enabled: true

reviewer:
  strictness: strict
  minSeverity: low
  ignorePaths:
    - '*.test.ts'
    - docs/*

ai:
  temperature: 0.1  # More deterministic
```

### Large Monorepo

```yaml
version: 1
enabled: true

reviewer:
  strictness: relaxed
  maxFilesReviewed: 30
  ignorePaths:
    - packages/legacy/*
    - '*.generated.ts'
```

## Environment Variables

Environment variables always override file configuration:

```bash
# These override .ai-pr-reviewer.yml settings
export AI_PROVIDER=anthropic
export AI_MODEL=claude-3-5-sonnet-20241022
```

## Validation

The configuration file is validated on load. Invalid configurations fall back to defaults with a warning comment on the PR.

Common validation errors:
- `strictness` must be "relaxed", "normal", or "strict"
- `minSeverity` must be "low", "medium", or "high"
- `maxFilesReviewed` must be between 1 and 100
- `temperature` must be between 0 and 2

