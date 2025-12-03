# AI PR Reviewer & Dev Agent - MVP Specification

## 1. Product Overview

**AI PR Reviewer & Dev Agent** is a GitHub App that combines automated code review with intelligent code authorship capabilities. It reviews pull requests using state-of-the-art AI models (OpenAI GPT-4 and Claude), providing detailed feedback and inline suggestions. Beyond reviewing, it acts as a development agent that can propose improvements, create branches, implement changes, and open well-documented pull requests—all while requiring human approval before merging.

**Target Users:**
- Individual developers working on side projects or open-source repositories
- Small engineering teams (2-10 developers) at startups
- Solo founders building products who need code review assistance
- Open-source maintainers managing contributions

**Primary Value Proposition:**

- **Instant Code Reviews**: Get comprehensive PR reviews within seconds, catching bugs, security issues, and style problems before human reviewers see them
- **Continuous Code Improvement**: AI proactively identifies refactoring opportunities, lint issues, and technical debt, opening PRs to address them
- **Clear Impact Analysis**: Every AI-authored PR includes detailed explanations of how changes affect the codebase, dependencies, and behavior
- **Zero Auto-Merge Risk**: All AI-generated changes require explicit human approval, maintaining safety and control
- **Reduced Review Burden**: Developers spend less time on routine review comments and can focus on architectural decisions and business logic

---

## 2. Core Use Cases

### **Reviewer Mode (v1 - Must Have)**

**As a developer**, when I open a pull request, I want the AI to automatically review the changes and leave a summary comment highlighting potential issues, so I can address problems before requesting human review.

**As a code reviewer**, I want inline comments pointing out specific bugs, security vulnerabilities, performance concerns, and style inconsistencies, so I can make more informed review decisions.

**As a team lead**, I want the AI to categorize issues by severity (critical, moderate, minor), so we can prioritize what needs immediate attention.

**As a contributor**, I want the AI to acknowledge good practices and strengths in my code, so I receive balanced feedback and learn what I'm doing well.

### **Dev Agent Mode (v1.1 - Must Have)**

**As a developer**, I want to trigger the AI with a slash command like `/ai-fix-lints` to automatically fix linting issues across the codebase and open a PR, so I don't waste time on mechanical fixes.

**As a maintainer**, I want the AI to scan for low-hanging fruit improvements (type annotations, missing error handling, unused imports) and propose them as separate PRs, so we can incrementally improve code quality.

**As a team member**, I want every AI-authored PR to include a clear title, description, and impact analysis explaining what changed and why, so I can review it effectively.

**As an engineering manager**, I want AI-generated PRs to be clearly labeled and never auto-merged, so we maintain control over what enters our codebase.

### **Nice-to-Have (v1.2)**

**As a developer**, I want to ask the AI "what would you change about this file?" via PR comment and get actionable suggestions, enabling conversational code improvement.

**As a team**, we want the AI to suggest multiple approaches to solving a problem and let us choose, providing flexibility in implementation decisions.

**As a repository owner**, I want to configure which types of changes the AI is allowed to propose (docs only, tests, refactors, etc.), giving us granular control.

### **Future/Stretch (v2+)**

**As a CI/CD owner**, I want to integrate AI review scores into our CI pipeline, potentially blocking merges on critical issues.

**As an organization**, we want centralized policies that prevent AI from touching certain files (migrations, infra configs), ensuring safety at scale.

**As a team**, we want the AI to learn from accepted vs. rejected suggestions over time, improving its relevance through feedback loops.

**As developers**, we want the AI to automatically generate tests for untested functions when it creates PRs, ensuring comprehensive coverage.

---

## 3. Feature List

### **3.1 Reviewer Mode (v1 MVP)**

#### GitHub App Integration
- **Webhook Registration & Event Handling**
  - Listens for `pull_request` events: `opened`, `reopened`, `synchronize`
  - Validates webhook signatures using HMAC with `GITHUB_WEBHOOK_SECRET`
  - Extracts PR metadata: number, title, description, base/head branches, author
  
- **PR Context Fetching**
  - Retrieves list of changed files with additions/deletions counts
  - Fetches unified diff for each changed file (via GitHub API)
  - Captures commit SHAs to prevent duplicate reviews
  - Handles large PRs (>50 files) by summarizing or skipping

#### AI Review Engine
- **Prompt Construction**
  - Builds structured prompt including:
    - PR title and description
    - Changed files list
    - Code diffs with context (±5 lines)
    - Repository language and framework hints
  - Templates for different review depths (quick, standard, thorough)
  
- **AI Provider Integration**
  - Primary: OpenAI GPT-4 Turbo with JSON mode
  - Fallback: Anthropic Claude 3.5 Sonnet
  - Configurable model selection per repository
  - Rate limiting and retry logic with exponential backoff
  
- **Structured Output Parsing**
  - Parses JSON response with schema validation:
    ```json
    {
      "summary": "string",
      "severity": "info|warning|critical",
      "strengths": ["string"],
      "risks": [
        {
          "category": "bug|security|performance|style|maintainability",
          "description": "string",
          "severity": "low|medium|high"
        }
      ],
      "suggestions": ["string"],
      "inlineComments": [
        {
          "path": "string",
          "line": number,
          "body": "string"
        }
      ]
    }
    ```

#### GitHub Comment Posting
- **Review Submission**
  - Posts top-level summary as PR review comment
  - Creates review with `COMMENT` event (not REQUEST_CHANGES)
  - Attaches inline comments to specific file paths and line numbers
  - Includes AI model attribution in footer
  
- **Deduplication Logic**
  - Stores reviewed commit SHAs in memory/database
  - Skips review if commit already processed
  - Updates review if force-push detected
  
- **Error Handling & User Feedback**
  - Posts error comment if AI call fails
  - Graceful degradation (summary only if inline comments fail)
  - Respects GitHub API rate limits (5000/hour)

#### Basic Configuration
- **YAML Config File** (`.ai-pr-reviewer.yml` in repo root)
  ```yaml
  version: 1
  enabled: true
  mode: reviewer  # reviewer | dev_agent | both
  
  reviewer:
    strictness: normal  # relaxed | normal | strict
    languages: [javascript, typescript, python]
    ignorePaths: [dist/*, node_modules/*, '*.test.ts']
    minSeverity: medium  # only show medium+ issues
    maxFilesReviewed: 30
    
  ai:
    provider: openai  # openai | anthropic
    model: gpt-4-turbo-preview
    temperature: 0.3
  ```

- **Environment Variables**
  ```bash
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...  # optional
  GITHUB_APP_ID=123456
  GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
  GITHUB_WEBHOOK_SECRET=your_webhook_secret
  NODE_ENV=production
  PORT=3000
  ```

---

### **3.2 Dev Agent Mode (v1.1)**

#### Trigger Mechanisms
- **Slash Commands** (primary for v1.1)
  - `/ai-fix-lints` – Fix linting errors
  - `/ai-add-types` – Add missing TypeScript types
  - `/ai-improve-docs` – Enhance inline documentation
  - `/ai-refactor <scope>` – Propose safe refactors for a module
  - Triggered via PR or issue comments
  
- **Configuration-Based Triggers** (future)
  - Scheduled scans (e.g., weekly)
  - On specific file patterns changed
  - After dependency updates

#### Change Identification & Planning
- **Scope Analysis**
  - Scans specified files or directories
  - Identifies self-contained, low-risk changes:
    - Lint/format violations
    - Missing type annotations
    - Unused imports/variables
    - Inconsistent naming conventions
    - Simple logic simplifications
  - Maximum scope limits (configurable):
    - Max 10 files per PR
    - Max 200 lines changed
    - Must pass existing tests (CI check)
  
- **Plan Generation**
  - AI creates structured change plan:
    ```json
    {
      "title": "Add TypeScript types to user service",
      "description": "...",
      "changes": [
        {
          "file": "src/services/userService.ts",
          "action": "modify",
          "hunks": [
            {
              "startLine": 15,
              "endLine": 20,
              "oldCode": "function getUser(id) {",
              "newCode": "function getUser(id: string): Promise<User> {"
            }
          ]
        }
      ],
      "impactAnalysis": "...",
      "risks": ["..."]
    }
    ```
  - Requires explicit approval before execution (dry-run mode in v1.1)

#### Code Execution & Git Operations
- **Implementation Approach** (Option B for v1.1)
  - Uses Node.js `child_process` to execute git commands
  - Clones repository to temporary directory
  - Creates feature branch: `ai/<slug>-<timestamp>`
  - Applies changes via file system writes
  - Commits with descriptive message
  - Pushes to remote
  
- **Change Application**
  - Reads file contents
  - Applies AI-generated diffs/replacements
  - Validates syntax where possible (e.g., TypeScript compiler check)
  - Aborts if changes cause compilation errors
  
- **Commit & Branch Creation**
  - Branch naming: `ai/fix-lints-2024-01-15`
  - Commit message format:
    ```
    🤖 AI: Add TypeScript types to user service
    
    - Added return types to 5 functions
    - Added parameter types for user ID and options
    - No behavior changes, purely type safety improvements
    
    Generated by AI PR Reviewer & Dev Agent
    ```
  - Signs commits with bot identity

#### Pull Request Creation
- **PR Metadata**
  - **Title**: Concise, actionable (max 72 chars)
    - ✅ "Add TypeScript types to user service"
    - ❌ "Made some improvements"
  
  - **Description Template**:
    ```markdown
    ## 🤖 AI-Generated Pull Request
    
    ### What Changed
    - Added explicit TypeScript return types to 5 functions in `userService.ts`
    - Added parameter type annotations
    - No runtime behavior changes
    
    ### Why
    Improved type safety reduces potential runtime errors and improves IDE autocomplete. These functions were previously using implicit `any` types.
    
    ### Impact Analysis
    **Affected Modules:**
    - `authController.ts` – Calls `getUser()`, now has better type checking
    - `profileRouter.ts` – Uses `updateUser()`, benefits from typed parameters
    
    **Breaking Changes:** None
    
    **Performance Impact:** None (compile-time only)
    
    **Risks:** 
    - Low risk: Changes are type annotations only
    - If parameter types are incorrect, TypeScript compiler will catch at build time
    
    ### Testing
    - ✅ Existing unit tests pass
    - ✅ TypeScript compilation succeeds
    - ⚠️ Consider adding type-specific test cases
    
    ---
    *Generated by AI PR Reviewer & Dev Agent v1.1*
    *Model: gpt-4-turbo-preview*
    *Triggered by: @username via `/ai-add-types`*
    ```

- **Tagging & Labels**
  - Adds `ai-generated` label automatically
  - Adds `ready-for-review` label
  - Mentions triggering user in PR body
  - Never adds `automerge` or similar tags

#### Safety Guardrails
- **Hard Limits**
  - Never modifies files matching `.ai-pr-reviewer.yml` ignore patterns
  - Never creates PRs targeting `main`/`master`/`production` without base branch
  - Never modifies infrastructure files (Docker, Terraform, CI configs) unless explicitly enabled
  - Never changes database migrations
  - Maximum 10 files or 200 lines per PR (configurable)
  
- **Validation Checks**
  - Runs linter/formatter on changed files
  - Attempts TypeScript/Python/etc. compilation
  - Checks if changes would break imports
  - Aborts if any validation fails
  
- **Human Oversight**
  - All PRs require explicit merge approval
  - Changes clearly attributed to AI
  - Rollback instructions in PR description
  - Link to audit log/reasoning

---

### **3.3 Explanatory Impact Analysis**

Every AI-authored PR must include a structured impact analysis section:

#### Required Components
1. **Direct Effects**
   - Which functions/classes are modified
   - What specific behavior changes (or confirmation of no behavior changes)
   - API signature changes if any

2. **Dependency Impact**
   - List of files that import/use modified code
   - How those dependencies are affected
   - Whether types/interfaces propagate to other modules

3. **System-Wide Implications**
   - Performance: "No measurable impact expected" or "May reduce memory usage by ~5%"
   - Security: "Does not touch authentication/authorization logic"
   - Maintainability: "Reduces code duplication from 3 instances to 1"

4. **Uncertainty & Limitations**
   - "Based on visible code, it appears that..."
   - "I cannot see the implementation of `externalService.call()`, so..."
   - "This change assumes the API contract in `types.ts` is current"
   - Never hallucinate information about unseen code

5. **Recommended Follow-Ups**
   - "Consider adding integration tests for the refactored module"
   - "May want to update documentation in `docs/api.md`"

#### Quality Standards
- **Honesty**: Explicitly state what the AI doesn't know
- **Grounded**: Only reference code the agent has access to
- **Actionable**: Give reviewers clear things to verify
- **Concise**: Impact analysis should be 5-10 sentences, not essays

---

## 4. Non-Goals for Early Versions

To maintain focus and safety, we explicitly exclude:

### **v1 & v1.1 Non-Goals**
- ❌ **No auto-merge**: All AI PRs require human approval
- ❌ **No large-scale refactors**: Changes limited to 10 files / 200 lines
- ❌ **No infrastructure changes**: No Docker, CI/CD, Terraform, or K8s modifications
- ❌ **No database migrations**: No schema changes or data migrations
- ❌ **No dependency updates**: No package.json/requirements.txt changes (yet)
- ❌ **No architectural changes**: No moving files, renaming modules, or restructuring
- ❌ **No code generation from scratch**: Only modifies existing files
- ❌ **No multi-step workflows**: One PR = one focused change
- ❌ **No custom AI training**: Uses pre-trained models only

### **Deferred to v2+**
- ⏳ Learning from human feedback (accept/reject patterns)
- ⏳ Organization-wide policy enforcement
- ⏳ Scheduled/automated scans
- ⏳ Test generation alongside code changes
- ⏳ CI/CD integration (blocking/passing based on review severity)
- ⏳ Multi-tenancy and SaaS billing
- ⏳ Custom model fine-tuning

### **Security & Compliance**
- ❌ No access to private environment variables or secrets in reviewed code
- ❌ No modifications to security-critical paths without explicit allowlist
- ❌ No external API calls from AI-generated code without review

---

## 5. System Architecture

### **Logical Components**

```
┌────────────────────────────────────────────────────────────┐
│                         GitHub                             │
│  ┌──────────┐      ┌──────────┐       ┌──────────┐         │
│  │   PRs    │      │ Comments │       │  Repos   │         │
│  └────┬─────┘      └────┬─────┘       └────┬─────┘         │
└───────┼─────────────────┼───────────────────┼──────────────┘
        │                 │                   │
        │ webhooks        │ slash commands    │ git operations
        ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Webhook Receiver                          │
│                 (Express + Webhooks SDK)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Event Router: PR events → Reviewer                  │   │
│  │               Issue comments → Dev Agent             │   │
│  └──────────────────────────────────────────────────────┘   │
└───────┬─────────────────────────────────┬───────────────────┘
        │                                 │
        │ PR context                      │ trigger command
        ▼                                 ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Review Service      │         │  Dev Agent Service   │
│                      │         │                      │
│  1. Fetch PR diff    │         │  1. Parse command    │
│  2. Build prompt     │         │  2. Analyze scope    │
│  3. Call AI Engine   │         │  3. Generate plan    │
│  4. Post comments    │         │  4. Execute changes  │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │ prompt                         │ prompt
           ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Engine                              │
│  ┌──────────────────────┐      ┌──────────────────────┐     │
│  │  OpenAI GPT-4        │      │  Anthropic Claude    │     │
│  │  (primary)           │      │  (fallback)          │     │
│  └──────────────────────┘      └──────────────────────┘     │
│                                                             │
│  - Prompt templates                                         │
│  - Response parsing & validation                            │
│  - Rate limiting & retries                                  │
└─────────────────────────────────────────────────────────────┘
           │                                │
           │ structured output              │ code changes
           ▼                                ▼
┌──────────────────────┐         ┌──────────────────────┐
│  GitHub Client       │         │  Git Executor        │
│  (Octokit)           │         │  (child_process)     │
│                      │         │                      │
│  - Post reviews      │         │  - Clone repo        │
│  - Create PRs        │         │  - Create branch     │
│  - Fetch files/diffs │         │  - Commit changes    │
│  - Add labels        │         │  - Push to remote    │
└──────────────────────┘         └──────────────────────┘
           │                                │
           └────────────┬───────────────────┘
                        ▼
              ┌──────────────────────┐
              │   Config & Storage   │
              │                      │
              │  - SQLite DB         │
              │    (logs, history)   │
              │  - YAML parser       │
              │  - Environment vars  │
              └──────────────────────┘
```

### **Request Flow: PR Review**

```
1. Developer opens PR on GitHub
   ↓
2. GitHub sends webhook (pull_request.opened) to /webhooks endpoint
   ↓
3. Webhook receiver validates HMAC signature
   ↓
4. Event router identifies event type → dispatch to Review Service
   ↓
5. Review Service:
   a. Fetch PR metadata (title, description, author)
   b. Fetch changed files list
   c. Fetch unified diffs for each file
   d. Load repo configuration (.ai-pr-reviewer.yml)
   ↓
6. Build review prompt:
   - System: "You are an expert code reviewer..."
   - User: PR context + diffs
   ↓
7. Call AI Engine (OpenAI GPT-4)
   - Send prompt with JSON mode enabled
   - Parse structured response
   - Validate schema
   ↓
8. Post to GitHub:
   a. Create PR review with summary comment
   b. Add inline comments for each issue
   c. Add label "ai-reviewed"
   ↓
9. Log review to database (commit SHA, timestamp, model used)
   ↓
10. Respond 200 OK to GitHub webhook
```

### **Request Flow: Dev Agent PR Creation**

```
1. User comments "/ai-fix-lints" on PR or issue
   ↓
2. GitHub sends webhook (issue_comment.created)
   ↓
3. Webhook receiver validates & routes to Dev Agent Service
   ↓
4. Dev Agent Service:
   a. Parse command type and parameters
   b. Check user permissions (must be repo collaborator)
   c. Load repository configuration
   d. Determine scope (which files to analyze)
   ↓
5. Clone repository to temp directory (or use contents API)
   ↓
6. Scan for issues matching command type:
   - Run linter (ESLint, Pylint, etc.)
   - Collect violations
   ↓
7. Build Dev Agent prompt:
   - System: "You are a code improvement agent..."
   - User: "Fix these lint errors: [violations] in [files]"
   - Include relevant file contents
   ↓
8. Call AI Engine:
   - Generate change plan
   - Produce diffs for each file
   - Generate impact analysis
   ↓
9. Validate changes:
   - Check syntax validity
   - Ensure within size limits (10 files, 200 lines)
   - Run linter on modified files
   ↓
10. Execute git operations:
    a. Create branch: ai/fix-lints-20240115
    b. Apply file changes
    c. Commit with message
    d. Push to remote
    ↓
11. Create PR via GitHub API:
    a. Set title, description (with impact analysis)
    b. Add labels: ai-generated, ready-for-review
    c. Mention triggering user
    ↓
12. Post acknowledgment comment on original issue/PR:
    "✅ Created PR #123 to fix lints"
    ↓
13. Log operation to database
```

---

## 6. Tech Stack

### **Backend**
- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript 5.3+
  - *Why*: Type safety, excellent GitHub/AI SDK support, large ecosystem
- **Web Framework**: Fastify 4.x
  - *Why*: Fast, low overhead, built-in schema validation, better than Express for production

### **GitHub Integration**
- **`@octokit/app`** (v14.x)
  - GitHub App authentication
  - Handles JWT generation and installation tokens
  
- **`@octokit/webhooks`** (v12.x)
  - Type-safe webhook event handling
  - Built-in signature verification
  
- **`@octokit/rest`** (v20.x)
  - Complete GitHub REST API client
  - TypeScript definitions included
  
- **`@octokit/plugin-retry`** & **`@octokit/plugin-throttling`**
  - Automatic retries on failures
  - Rate limit handling

### **AI Providers**
- **`openai`** (v4.x)
  - Official OpenAI SDK
  - Streaming support, function calling, JSON mode
  
- **`@anthropic-ai/sdk`** (v0.20.x)
  - Official Anthropic Claude SDK
  - Fallback option for reviews

### **Configuration & Validation**
- **`yaml`** (v2.x)
  - Parse `.ai-pr-reviewer.yml` config files
  
- **`zod`** (v3.x)
  - Runtime schema validation for configs and AI responses
  - Type inference for TypeScript

### **Utilities**
- **`dotenv`** (v16.x)
  - Load environment variables from `.env`
  
- **`pino`** (v8.x)
  - High-performance JSON logger
  - Better than Winston/Bunyan for structured logs
  
- **`simple-git`** (v3.x)
  - Programmatic git operations from Node.js
  - Used by Dev Agent to clone/commit/push

### **Storage**
- **`better-sqlite3`** (v9.x)
  - Fast, synchronous SQLite3 bindings
  - File-based DB for logs, job history, metrics
  - No separate DB server needed
  
- **Optional: `@supabase/supabase-js`** (v2.x)
  - For hosted storage/auth in future SaaS version

### **Testing**
- **`vitest`** (v1.x)
  - Fast, modern test runner (Jest-compatible API)
  
- **`@faker-js/faker`** (v8.x)
  - Generate test data
  
- **`nock`** (v13.x)
  - HTTP mocking for GitHub/AI API tests

### **Development**
- **`tsx`** (v4.x)
  - Fast TypeScript execution (replaces ts-node)
  
- **`eslint`** + **`@typescript-eslint/parser`**
  - Code linting
  
- **`prettier`**
  - Code formatting

### **Optional Dashboard (v1.2+)**
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS 3.x**
- **shadcn/ui** components
- **Recharts** for metrics visualization

### **Deployment**
- **Docker** (containerization)
- **Fly.io** or **Railway** (recommended for v1)
  - Simple deployment, built-in secrets management
  - Free tier available
- **AWS Lambda** + API Gateway (alternative for scale)

---

## 7. Permissions & Security

### **GitHub App Permissions**

#### Reviewer Mode (v1)
```yaml
permissions:
  contents: read          # Read repository files and diffs
  pull_requests: write    # Post reviews and comments
  metadata: read          # Basic repo metadata
  
events:
  - pull_request          # opened, reopened, synchronize
```

#### Dev Agent Mode (v1.1+)
```yaml
permissions:
  contents: write         # Create branches, commit changes
  pull_requests: write    # Create PRs, post comments
  metadata: read          # Repository metadata
  issues: read            # Read issue comments for slash commands
  
events:
  - pull_request
  - issue_comment         # For slash commands
  - pull_request_review_comment  # For inline command triggers
```

### **Webhook Security**

#### Signature Verification
- Every webhook payload includes `X-Hub-Signature-256` header
- Verify HMAC using `GITHUB_WEBHOOK_SECRET`:
  ```typescript
  import { verify } from '@octokit/webhooks-methods';
  
  const isValid = await verify(
    secret,
    payload,
    signature
  );
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  ```

#### IP Allowlisting (Optional)
- GitHub webhook IPs: https://api.github.com/meta
- Can restrict incoming requests to GitHub's IP ranges

### **Secret Management**

#### Local Development
```bash
# .env (NEVER commit)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=your_secret_here
DATABASE_URL=./dev.db
NODE_ENV=development
```

#### Production (Fly.io / Railway / AWS)
```bash
# Set via CLI or dashboard
fly secrets set OPENAI_API_KEY=sk-proj-...
fly secrets set GITHUB_PRIVATE_KEY="$(cat private-key.pem)"
```

- **Never** log secrets
- **Never** include secrets in error messages
- **Never** commit `.env` or private keys to git
- Use `.gitignore`:
  ```
  .env
  .env.*
  *.pem
  *.db
  node_modules/
  ```

### **Dev Agent Safety Guardrails**

#### Scope Limits (Enforced in Code)
```typescript
const SAFETY_LIMITS = {
  maxFilesPerPR: 10,
  maxLinesChanged: 200,
  maxCommitsPerPR: 1,
  allowedBranches: ['dev', 'develop', 'feature/*'],  // never main
  forbiddenPaths: [
    'Dockerfile',
    'docker-compose.yml',
    '.github/workflows/*',
    'terraform/*',
    '**/migrations/*',
    'package.json',  // v1.1 restriction
    'requirements.txt'
  ],
  requiredChecks: ['lint', 'compile']  // must pass before creating PR
};
```

#### User Permissions
- Only repo collaborators can trigger Dev Agent
- Check via GitHub API before executing commands:
  ```typescript
  const { data } = await octokit.repos.getCollaboratorPermissionLevel({
    owner,
    repo,
    username
  });
  
  if (!['admin', 'write'].includes(data.permission)) {
    throw new Error('Insufficient permissions');
  }
  ```

#### Branch Protection
- Dev Agent never pushes directly to protected branches
- All changes go through PR workflow
- Leverage GitHub branch protection rules:
  - Require PR reviews before merging
  - Require status checks to pass
  - Restrict who can push to main

#### Audit Logging
```typescript
// Log every Dev Agent action to database
await db.auditLog.create({
  timestamp: new Date(),
  action: 'pr_created',
  triggeredBy: username,
  prNumber: 123,
  filesChanged: ['src/utils.ts', 'src/types.ts'],
  linesAdded: 45,
  linesDeleted: 12,
  aiModel: 'gpt-4-turbo-preview',
  promptHash: hash(prompt)  // for debugging
});
```

### **API Rate Limiting**

#### GitHub API
- 5,000 requests/hour per installation
- Use `@octokit/plugin-throttling` to auto-handle:
  ```typescript
  import { throttling } from '@octokit/plugin-throttling';
  
  const Octokit = RestOctokit.plugin(throttling);
  
  const octokit = new Octokit({
    throttle: {
      onRateLimit: (retryAfter, options) => {
        console.warn(`Rate limit hit, retrying after ${retryAfter}s`);
        return true;  // retry
      }
    }
  });
  ```

#### OpenAI / Anthropic
- Implement exponential backoff for 429 errors
- Set per-repository rate limits in config:
  ```yaml
  ai:
    maxRequestsPerHour: 100  # per repository
  ```

---

## 8. Modules & Code Organization

```
ai-pr-reviewer/
├── src/
│   ├── index.ts                    # App entry point, server initialization
│   │   - Loads environment variables via dotenv
│   │   - Initializes Fastify server with CORS and error handling
│   │   - Registers webhook routes
│   │   - Connects to SQLite database
│   │   - Starts listening on PORT (default 3000)
│   │   - Graceful shutdown handlers
│   │
│   ├── config/
│   │   ├── env.ts                  # Environment variable loading & validation
│   │   │   - validateEnv(): Uses Zod to ensure all required vars present
│   │   │   - Exports typed config object with all env vars
│   │   │   - Throws descriptive errors for missing/invalid vars
│   │   │
│   │   ├── repoConfig.ts           # Repository-specific config loader
│   │   │   - loadRepoConfig(owner, repo): Fetches .ai-pr-reviewer.yml
│   │   │   - parseConfig(): Validates YAML against schema
│   │   │   - getDefaultConfig(): Returns sensible defaults
│   │   │   - mergeConfig(): Combines repo config with defaults
│   │   │
│   │   └── constants.ts            # Application constants
│   │       - SAFETY_LIMITS (max files, lines, etc.)
│   │       - DEFAULT_AI_MODELS
│   │       - FORBIDDEN_PATHS patterns
│   │
│   ├── github/
│   │   ├── webhooks.ts             # Webhook handling & event routing
│   │   │   - setupWebhooks(): Registers webhook handlers
│   │   │   - handlePullRequest(): Routes PR events to Review Service
│   │   │   - handleIssueComment(): Routes slash commands to Dev Agent
│   │   │   - verifySignature(): HMAC validation middleware
│   │   │
│   │   ├── client.ts               # Octokit client & helper utilities
│   │   │   - createAppClient(): Creates authenticated Octokit instance
│   │   │   - getInstallationClient(): Gets client for specific installation
│   │   │   - withRetry(): Wrapper for API calls with exponential backoff
│   │   │
│   │   ├── prHelpers.ts            # PR-specific GitHub operations
│   │   │   - fetchPRContext(): Gets PR metadata, files, diffs
│   │   │   - postReview(): Creates PR review with comments
│   │   │   - postInlineComments(): Adds line-specific comments
│   │   │   - addLabels(): Adds labels to PR
│   │   │
│   │   └── repoHelpers.ts          # Repository operations
│   │       - fetchFileContents(): Gets file contents from repo
│   │       - checkUserPermissions(): Verifies user is collaborator
│   │       - createBranch(): Creates new branch via API
│   │       - createPullRequest(): Opens new PR with metadata
│   │
│   ├── ai/
│   │   ├── prompts.ts              # Prompt templates for Reviewer and Dev Agent
│   │   │   - buildReviewerPrompt(): Constructs PR review prompt
│   │   │   - buildDevAgentPrompt(): Constructs code change prompt
│   │   │   - SYSTEM_PROMPTS: Predefined system messages
│   │   │   - formatDiff(): Formats code diffs for AI consumption
│   │   │
│   │   ├── reviewer.ts             # AI-based PR review generation
│   │   │   - generateReview(): Main entry point for reviews
│   │   │   - callAIProvider(): Sends prompt to OpenAI/Claude
│   │   │   - parseReviewResponse(): Validates and parses JSON response
│   │   │   - categorizeRisks(): Groups issues by severity/category
│   │   │
│   │   ├── devAgent.ts             # AI-based code change generation
│   │   │   - generateChangePlan(): Creates structured change plan
│   │   │   - generateCodeChanges(): Produces actual code diffs
│   │   │   - generateImpactAnalysis(): Creates impact explanation
│   │   │   - validateChanges(): Ensures changes meet safety criteria
│   │   │
│   │   └── providers/
│   │       ├── openai.ts           # OpenAI GPT integration
│   │       │   - callOpenAI(): Wrapper for OpenAI API with JSON mode
│   │       │   - handleRateLimits(): Manages 429 errors
│   │       │
│   │       └── anthropic.ts        # Anthropic Claude integration
│   │           - callClaude(): Wrapper for Claude API
│   │           - convertToClaudeFormat(): Adapts prompts for Claude
│   │
│   ├── services/
│   │   ├── reviewService.ts        # Orchestrates Reviewer flow
│   │   │   - handlePREvent(): Main handler for PR webhooks
│   │   │   - shouldReview(): Checks if PR should be reviewed
│   │   │   - performReview(): Executes full review pipeline
│   │   │   - avoidDuplicateReview(): Checks if commit already reviewed
│   │   │
│   │   ├── devAgentService.ts      # Orchestrates Dev Agent flow
│   │   │   - handleSlashCommand(): Parses and routes slash commands
│   │   │   - executeFix(): Runs fix workflow (lint, types, etc.)
│   │   │   - createAgentPR(): Full pipeline from analysis to PR creation
│   │   │   - dryRun(): Shows proposed changes without executing
│   │   │
│   │   └── gitService.ts           # Git operations via simple-git
│   │       - cloneRepo(): Clones repo to temp directory
│   │       - createBranch(): Creates and checks out new branch
│   │       - applyChanges(): Writes file changes to disk
│   │       - commitAndPush(): Commits changes and pushes to remote
│   │       - cleanup(): Removes temp directory
│   │
│   ├── validation/
│   │   ├── schemas.ts              # Zod schemas for validation
│   │   │   - ReviewResponseSchema: Validates AI review output
│   │   │   - ChangePlanSchema: Validates Dev Agent plan
│   │   │   - RepoConfigSchema: Validates .ai-pr-reviewer.yml
│   │   │
│   │   └── safetyChecks.ts         # Safety validation for Dev Agent
│   │       - validateFileCount(): Ensures within max files limit
│   │       - validateLineCount(): Ensures within max lines limit
│   │       - validatePaths(): Checks forbidden paths
│   │       - validateSyntax(): Runs language-specific syntax checks
│   │
│   ├── database/
│   │   ├── db.ts                   # SQLite database setup
│   │   │   - initDatabase(): Creates tables if not exist
│   │   │   - getDatabase(): Returns database connection
│   │   │
│   │   ├── models/
│   │   │   ├── Review.ts           # Review history model
│   │   │   ├── DevAgentJob.ts      # Dev Agent job tracking
│   │   │   └── AuditLog.ts         # Audit log for all actions
│   │   │
│   │   └── repositories/
│   │       ├── reviewRepo.ts       # CRUD operations for reviews
│   │       ├── jobRepo.ts          # CRUD operations for jobs
│   │       └── auditRepo.ts        # CRUD operations for audit logs
│   │
│   └── utils/
│       ├── logging.ts              # Logging utilities with Pino
│       │   - createLogger(): Creates structured logger
│       │   - logError(): Logs errors with context
│       │   - logWebhook(): Logs webhook events
│       │
│       ├── errors.ts               # Custom error classes
│       │   - GitHubAPIError
│       │   - AIProviderError
│       │   - ValidationError
│       │   - SafetyViolationError
│       │
│       └── formatters.ts           # Formatting utilities
│           - formatPRTitle(): Ensures title meets conventions
│           - formatCommitMessage(): Formats commit messages
│           - truncateDiff(): Truncates large diffs for AI consumption
│
├── tests/
│   ├── unit/
│   │   ├── ai/
│   │   │   ├── reviewer.test.ts
│   │   │   └── devAgent.test.ts
│   │   ├── services/
│   │   │   ├── reviewService.test.ts
│   │   │   └── devAgentService.test.ts
│   │   └── validation/
│   │       └── safetyChecks.test.ts
│   │
│   ├── integration/
│   │   ├── webhook.test.ts
│   │   └── github-api.test.ts
│   │
│   └── fixtures/
│       ├── pr-payload.json
│       ├── comment-payload.json
│       └── sample-diffs.ts
│
├── docs/
│   ├── design.md                   # This document
│   ├── api.md                      # API documentation
│   ├── deployment.md               # Deployment guide
│   └── configuration.md            # Configuration reference
│
├── .github/
│   └── workflows/
│       ├── test.yml                # Run tests on PR
│       └── deploy.yml              # Deploy to production
│
├── .env.example                    # Example environment variables
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile
└── README.md
```

### **Key Module Responsibilities**

#### **Core Services**
- **reviewService.ts**: Orchestrates the entire PR review workflow from webhook to comment posting
- **devAgentService.ts**: Manages Dev Agent lifecycle from command parsing to PR creation
- **gitService.ts**: Abstracts all git operations to enable easy switching between implementations

#### **AI Layer**
- **prompts.ts**: Single source of truth for all AI prompts, enabling easy iteration
- **reviewer.ts / devAgent.ts**: Business logic for AI interactions, separate from API calls
- **providers/**: Abstraction layer allowing easy addition of new AI providers

#### **GitHub Integration**
- **webhooks.ts**: Entry point for all GitHub events, validates and routes
- **client.ts**: Manages authentication and provides reusable GitHub API client
- **prHelpers.ts / repoHelpers.ts**: Domain-specific GitHub operations

#### **Safety & Validation**
- **validation/**: All safety checks and schema validations in one place
- **safetyChecks.ts**: Enforces hard limits before any code modifications

---

## 9. Prompting Strategies

### **9.1 Reviewer Prompt**

#### System Prompt
```
You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and performance optimization. Your role is to:

1. Identify bugs, security issues, performance problems, and maintainability concerns
2. Provide constructive, actionable feedback
3. Acknowledge good practices and strengths in the code
4. Suggest specific improvements with examples
5. Categorize issues by severity (low, medium, high)

Guidelines:
- Be concise but thorough
- Focus on substantive issues, not just style preferences
- Consider the context and constraints of the project
- Provide reasoning for your suggestions
- Use a professional, helpful tone

You must respond ONLY with valid JSON matching this exact schema:
{
  "summary": "Brief overview of the PR and main findings",
  "severity": "info" | "warning" | "critical",
  "strengths": ["List of positive aspects"],
  "risks": [
    {
      "category": "bug|security|performance|style|maintainability",
      "description": "Detailed description of the issue",
      "severity": "low|medium|high"
    }
  ],
  "suggestions": ["Specific actionable improvements"],
  "inlineComments": [
    {
      "path": "relative/file/path",
      "line": line_number,
      "body": "Specific comment about this line/block"
    }
  ]
}
```

#### User Prompt Template
```
Review this pull request:

**PR Title:** {{title}}
**Description:** {{description}}
**Author:** {{author}}
**Base Branch:** {{baseBranch}}
**Languages:** {{languages}}

**Changed Files ({{fileCount}} files):**
{{#each files}}
- {{path}} (+{{additions}} -{{deletions}})
{{/each}}

**Code Changes:**
{{#each diffs}}
File: {{path}}
```diff
{{content}}
```
{{/each}}

**Repository Context:**
- Primary language: {{primaryLanguage}}
- Framework: {{framework}}
- Review strictness: {{strictness}}

Provide a comprehensive code review in JSON format.
```

#### Output Format Requirements
- **summary**: 2-4 sentences, high-level assessment
- **severity**: Overall PR risk level
- **strengths**: 2-5 positive observations (builds trust, balanced feedback)
- **risks**: 0-10 issues, prioritized by severity
- **suggestions**: 3-7 actionable recommendations
- **inlineComments**: 0-20 line-specific comments (avoid overwhelming)

---

### **9.2 Dev Agent Prompt**

#### System Prompt
```
You are a careful, methodical software engineer specializing in code improvements. Your role is to:

1. Analyze code for specific improvement opportunities
2. Propose small, safe, self-contained changes
3. Generate precise code diffs or replacements
4. Explain the impact and reasoning behind each change
5. Be honest about uncertainty and limitations

Core Principles:
- NEVER hallucinate files, functions, or APIs that you cannot see
- ONLY modify code that is clearly provided in the context
- Make ONE focused change at a time (no scope creep)
- Prioritize safety over cleverness
- Assume existing tests must continue to pass
- If uncertain about impact, state your assumptions explicitly

Change Categories You Can Handle:
- Fix linting/formatting violations
- Add missing type annotations
- Remove unused imports/variables
- Improve inline documentation
- Simplify logic without changing behavior
- Fix obvious bugs (null checks, off-by-one, etc.)

What You CANNOT Do:
- Modify infrastructure files (Docker, CI/CD, Terraform)
- Change database schemas or migrations
- Refactor more than 10 files or 200 lines
- Make architectural changes
- Add new dependencies

You must respond with valid JSON matching this schema:
{
  "title": "Concise PR title (max 72 chars)",
  "description": "What changed and why",
  "changes": [
    {
      "file": "path/to/file",
      "action": "modify",
      "hunks": [
        {
          "startLine": number,
          "endLine": number,
          "oldCode": "existing code",
          "newCode": "improved code",
          "reasoning": "why this change improves the code"
        }
      ]
    }
  ],
  "impactAnalysis": {
    "directEffects": "What functions/classes are modified",
    "dependencies": ["Files that import/use this code"],
    "systemWideImplications": "Performance, security, maintainability effects",
    "uncertainties": ["Things you cannot verify"],
    "recommendedFollowUps": ["Actions for human reviewers"]
  },
  "risks": ["Potential issues or concerns"]
}
```

#### User Prompt Template (Fix Lints Example)
```
Fix linting violations in the following files:

**Command:** /ai-fix-lints
**Scope:** {{scope}}
**Repository:** {{owner}}/{{repo}}

**Linting Violations:**
{{#each lintErrors}}
File: {{file}}
Line {{line}}: [{{rule}}] {{message}}
{{/each}}

**File Contents:**
{{#each files}}
### {{path}}
```{{language}}
{{content}}
```
{{/each}}

**Instructions:**
1. Fix only the specific lint errors listed above
2. Do not change any logic or behavior
3. Ensure all changes are purely formatting/style
4. If a fix might affect behavior, explain in your reasoning
5. Group related fixes together when possible

Generate a change plan in JSON format.
```

#### User Prompt Template (Add Types Example)
```
Add TypeScript type annotations to improve type safety:

**Command:** /ai-add-types
**Target:** {{targetFiles}}

**Files to Improve:**
{{#each files}}
### {{path}}
```typescript
{{content}}
```
{{/each}}

**Known Type Definitions:**
{{#each typeFiles}}
### {{path}}
```typescript
{{content}}
```
{{/each}}

**Instructions:**
1. Add return type annotations to functions without them
2. Add parameter type annotations where missing
3. Replace `any` types with specific types where possible
4. Use existing type definitions from the codebase
5. Do NOT invent types that don't exist in the codebase
6. If you cannot determine the correct type, state this in uncertainties

Generate a change plan in JSON format.
```

---

### **9.3 Prompt Engineering Best Practices**

#### For Reviewer
- **Context Limiting**: Include max 5,000 lines of diff per request
- **Language Hints**: Specify primary language and framework for better analysis
- **Example-Driven**: Include 2-3 example issues in system prompt
- **Severity Calibration**: Tune strictness based on repo config

#### For Dev Agent
- **Scope Restriction**: Only include files directly relevant to the task
- **Uncertainty Emphasis**: Repeat "be honest about limitations" in multiple places
- **Safety Reminders**: Remind about forbidden paths and safety checks
- **Concrete Examples**: Show example JSON outputs in system prompt

#### Token Management
- Reviewer prompts: ~3,000-8,000 tokens (input) → ~1,000-2,000 tokens (output)
- Dev Agent prompts: ~2,000-5,000 tokens (input) → ~500-1,500 tokens (output)
- Use gpt-4-turbo (128k context) to handle large PRs
- Implement truncation strategy for files >500 lines

#### Temperature Settings
- Reviewer: 0.3 (consistent, focused analysis)
- Dev Agent: 0.1 (deterministic code generation)

---

## 10. MVP Roadmap and Milestones

### **v1.0 – Reviewer Mode (4-6 weeks)**

#### **M1: Foundation & Infrastructure** (Week 1)
**Goal:** Set up project structure, authentication, and basic webhook handling

- [ ] Initialize TypeScript project with Fastify
- [ ] Set up GitHub App registration and credentials
- [ ] Implement webhook receiver with signature verification
- [ ] Create Octokit client with retry and throttling
- [ ] Set up SQLite database with initial schema
- [ ] Configure logging with Pino
- [ ] Write basic health check endpoint

**Deliverable:** Server receives and validates webhooks, logs events

---

#### **M2: PR Context Fetching** (Week 1-2)
**Goal:** Extract all relevant PR information for review

- [ ] Implement `fetchPRContext()` to get PR metadata
- [ ] Fetch list of changed files with stats
- [ ] Fetch unified diffs for each file
- [ ] Handle pagination for large PRs
- [ ] Implement diff truncation for very large changes
- [ ] Add error handling for API failures
- [ ] Cache PR data in database

**Deliverable:** Complete PR context available for AI review

---

#### **M3: AI Review Engine** (Week 2-3)
**Goal:** Generate AI-powered code reviews

- [ ] Write reviewer system and user prompts
- [ ] Integrate OpenAI GPT-4 with JSON mode
- [ ] Implement response parsing and validation (Zod)
- [ ] Add retry logic with exponential backoff
- [ ] Create mock AI responses for testing
- [ ] Implement basic error handling and logging
- [ ] Add Anthropic Claude as fallback provider

**Deliverable:** AI generates structured review JSON from PR context

---

#### **M4: GitHub Comment Posting** (Week 3-4)
**Goal:** Post AI reviews back to GitHub PRs

- [ ] Implement `postReview()` for summary comments
- [ ] Implement `postInlineComments()` for line-specific feedback
- [ ] Add deduplication logic (check commit SHA)
- [ ] Format review comments with markdown
- [ ] Add AI attribution footer
- [ ] Handle GitHub API errors gracefully
- [ ] Add `ai-reviewed` label to PRs

**Deliverable:** Complete review workflow from webhook to posted comments

---

#### **M5: Configuration & Polish** (Week 4-6)
**Goal:** Make the app configurable and production-ready

- [ ] Implement `.ai-pr-reviewer.yml` parser
- [ ] Add config validation with defaults
- [ ] Implement `ignorePaths` filtering
- [ ] Add `strictness` level support (relaxed/normal/strict)
- [ ] Write comprehensive error messages
- [ ] Add metrics tracking (reviews per day, avg response time)
- [ ] Write deployment documentation
- [ ] Create Docker container
- [ ] Deploy to Fly.io/Railway
- [ ] Write user documentation

**Deliverable:** v1.0 production release – fully functional PR reviewer

---

### **v1.1 – Dev Agent (PR Author)** (4-6 weeks after v1.0)

#### **M6: Slash Command Parsing** (Week 7)
**Goal:** Detect and route slash commands from comments

- [ ] Listen for `issue_comment.created` webhook events
- [ ] Parse slash commands (`/ai-fix-lints`, `/ai-add-types`, etc.)
- [ ] Validate user permissions (must be collaborator)
- [ ] Add command acknowledgment replies
- [ ] Route commands to Dev Agent service
- [ ] Implement help command (`/ai-help`)

**Deliverable:** Bot responds to slash commands with acknowledgment

---

#### **M7: Change Planning & Dry-Run** (Week 7-8)
**Goal:** Generate change plans without executing them

- [ ] Implement linting integration (ESLint, Pylint)
- [ ] Scan files for specific issues
- [ ] Build Dev Agent prompts with file context
- [ ] Call AI to generate change plans
- [ ] Validate plan against safety limits
- [ ] Implement dry-run mode (show proposed changes in comment)
- [ ] Add approval mechanism (👍 reaction to proceed)

**Deliverable:** AI proposes changes in PR comments, waits for approval

---

#### **M8: Git Operations & PR Creation** (Week 8-10)
**Goal:** Execute approved changes and create PRs

- [ ] Implement git clone to temp directory
- [ ] Create feature branches with AI naming convention
- [ ] Apply code changes from AI plan to files
- [ ] Run syntax validation (TypeScript compiler, etc.)
- [ ] Commit with structured message
- [ ] Push branch to remote
- [ ] Create PR via GitHub API
- [ ] Clean up temp directories
- [ ] Handle git errors and rollback

**Deliverable:** Dev Agent creates functional PRs with code changes

---

#### **M9: Impact Analysis & PR Polish** (Week 10-11)
**Goal:** Generate high-quality PR descriptions

- [ ] Implement impact analysis prompt
- [ ] Generate "What Changed" section
- [ ] Generate "Why" rationale
- [ ] Analyze affected modules/dependencies
- [ ] Generate testing recommendations
- [ ] Format PR description with template
- [ ] Add ai-generated and ready-for-review labels
- [ ] Mention triggering user in PR
- [ ] Link back to original command comment

**Deliverable:** v1.1 release – AI creates well-documented PRs

---

### **v1.2 – Enhanced Features** (2-3 weeks)

#### **M10: Conversational Review**
- [ ] Support inline questions: "What would you change here?"
- [ ] Support `/ai-explain` command for code explanations
- [ ] Multi-turn conversations in PR threads

#### **M11: Dashboard MVP**
- [ ] Next.js dashboard with authentication
- [ ] View review history per repository
- [ ] View Dev Agent job logs
- [ ] Basic metrics (reviews/day, PRs created, acceptance rate)

**Deliverable:** v1.2 – Enhanced interaction and visibility

---

### **v2.0 – Advanced Automation** (3-6 months)

#### **M12: Scheduled Scans**
- [ ] Weekly/monthly automated scans
- [ ] Configurable scan triggers
- [ ] Batch PR creation for multiple improvements

#### **M13: Learning Loop**
- [ ] Track accepted vs. rejected AI suggestions
- [ ] Adjust prompts based on feedback
- [ ] Repository-specific fine-tuning (future)

#### **M14: CI Integration**
- [ ] Post review status as commit check
- [ ] Block merges on critical AI findings (optional)
- [ ] Integration with GitHub Actions

#### **M15: Organization Features**
- [ ] Multi-repository management
- [ ] Organization-wide policies
- [ ] Team-specific configurations
- [ ] Usage analytics and billing

**Deliverable:** v2.0 – Enterprise-ready AI code assistant

---

## 11. Future Enhancements

### **v2.1+ – Advanced AI Capabilities**

#### **Multi-Option Proposals**
- AI suggests 2-3 different approaches to solving a problem
- Users choose preferred approach via reactions or dropdown
- Implement chosen solution automatically

#### **Test Generation**
- Automatically generate unit tests for new functions
- Generate integration tests for API endpoints
- Ensure test coverage increases with AI PRs

#### **Intelligent Dependency Updates**
- Analyze breaking changes in dependency updates
- Propose code modifications to accommodate new versions
- Run tests before creating update PRs

---

### **v2.2+ – Workflow Automation**

#### **Pre-commit Hooks**
- Run AI review locally before pushing
- CLI tool for developers
- Git hook integration

#### **Release Notes Generation**
- Aggregate PR descriptions into release notes
- Categorize changes (features, fixes, breaking)
- Generate changelog automatically

#### **Documentation Sync**
- Detect when code changes affect documentation
- Open PRs to update docs alongside code
- Keep README and API docs in sync

---

### **v2.3+ – Security & Compliance**

#### **Security Scanning**
- Integrate with SAST tools (Semgrep, CodeQL)
- Detect hardcoded secrets and credentials
- Flag vulnerable dependency usage

#### **Compliance Checks**
- Ensure code meets org coding standards
- License compliance for dependencies
- GDPR/privacy pattern detection

#### **Audit Trail**
- Complete history of all AI decisions
- Rollback capabilities for AI changes
- Explainability reports for compliance

---

### **v3.0+ – Learning & Customization**

#### **Repository-Specific Learning**
- Fine-tune models on accepted/rejected suggestions
- Learn coding style from historical commits
- Adapt to team-specific preferences

#### **Custom Review Rules**
- Define custom linting rules for AI to enforce
- Project-specific architectural patterns
- Domain-specific security requirements

#### **Feedback Loop (RLHF-style)**
- Thumbs up/down on AI suggestions
- Reinforcement learning from human reviews
- Continuous improvement over time

---

### **v3.1+ – Multi-Language & Platform**

#### **Additional Language Support**
- Go, Rust, Java, C++, Ruby, PHP
- Language-specific best practices
- Framework-specific patterns (Spring, Rails, Django)

#### **Other Git Platforms**
- GitLab integration
- Bitbucket support
- Azure DevOps compatibility

#### **IDE Extensions**
- VS Code extension for inline AI suggestions
- JetBrains plugin
- Real-time code review as you type

#### **M16: IDE Agent Integration**
**Goal:** Enable AI IDE agents (Cursor, GitHub Copilot Chat) to interact with AI PR Reviewer in a closed-loop workflow

- [ ] Build MCP (Model Context Protocol) server for Cursor integration
- [ ] Add REST API endpoints for querying review status and suggestions
- [ ] Implement webhook notifications for review completion events
- [ ] Create structured suggestion format for automated task creation
- [ ] Build CLI tool for agent-to-agent communication
- [ ] Auto-create GitHub issues/milestones from high-priority AI suggestions
- [ ] Support polling and push-based status updates
- [ ] Enable agents to query CI/test status alongside review results
- [ ] Provide recommendation engine (merge/iterate/block) based on review + CI

**Use Cases:**
- IDE agent pushes branch → waits for review → reads feedback → decides next steps
- IDE agent creates tasks/milestones from AI reviewer suggestions automatically
- Closed-loop development: code → push → review → fix → merge without context switching

**Deliverable:** Seamless integration between AI coding assistants and AI PR Reviewer

---

### **Enterprise Features**

#### **Self-Hosting**
- On-premise deployment options
- Custom model hosting
- Air-gapped environments

#### **SSO & Advanced Auth**
- SAML/OAuth integration
- Role-based access control (RBAC)
- Team and org management

#### **SLA & Support**
- 99.9% uptime guarantee
- Priority support channels
- Dedicated account managers

#### **Advanced Analytics**
- Code quality trends over time
- Developer productivity metrics
- ROI tracking for AI suggestions

---

## Conclusion

This specification provides a clear path from v1 (Reviewer-only) through v1.1 (Dev Agent) to v2+ (Advanced features). The focus is on:

1. **Safety First**: All AI changes require human approval
2. **Incremental Value**: Each version delivers concrete benefits
3. **Clear Boundaries**: Explicit non-goals prevent scope creep
4. **Production Quality**: Security, error handling, and observability built-in

The MVP (v1.0) can be built in 4-6 weeks by a solo developer or small team, providing immediate value as an AI code reviewer. The Dev Agent (v1.1) adds the unique capability of AI-authored PRs while maintaining safety through human oversight.

Future versions build toward a comprehensive AI engineering assistant that learns, adapts, and becomes an integral part of the development workflow—without replacing human judgment and creativity.