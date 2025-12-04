# API Reference

The AI-PR-Dev API provides programmatic access to review data and functionality.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## Authentication

If `API_KEY` is configured, include it in requests:

**Header**:
```
X-API-Key: your-api-key
```

**Query Parameter**:
```
?apiKey=your-api-key
```

## Endpoints

### Health Check

#### `GET /health`

Check if the server is running.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Review Status

#### `GET /api/v1/reviews/:owner/:repo/:pr`

Get review status and results for a PR.

**Parameters**:
- `owner` (path): Repository owner
- `repo` (path): Repository name
- `pr` (path): Pull request number
- `installationId` (query, required): GitHub App installation ID

**Example Request**:
```bash
curl "http://localhost:3000/api/v1/reviews/owner/repo/123?installationId=123456" \
  -H "X-API-Key: your-api-key"
```

**Response**:
```json
{
  "owner": "owner",
  "repo": "repo",
  "pullNumber": 123,
  "commitSha": "abc123",
  "reviewed": true,
  "reviewedAt": "2025-01-15T10:30:00.000Z",
  "modelUsed": "gpt-4-turbo-preview",
  "reviewSummary": "Summary of changes...",
  "severity": "medium",
  "hasHighRisks": false,
  "riskCount": 3,
  "suggestionCount": 5
}
```

**Error Responses**:
- `400`: Invalid PR number or missing installationId
- `404`: Review not found
- `500`: Internal server error

### Suggestions

#### `GET /api/v1/reviews/:owner/:repo/:pr/suggestions`

Get structured suggestions from a review.

**Parameters**:
- `owner` (path): Repository owner
- `repo` (path): Repository name
- `pr` (path): Pull request number
- `installationId` (query, required): GitHub App installation ID

**Example Request**:
```bash
curl "http://localhost:3000/api/v1/reviews/owner/repo/123/suggestions?installationId=123456" \
  -H "X-API-Key: your-api-key"
```

**Response**:
```json
{
  "owner": "owner",
  "repo": "repo",
  "pullNumber": 123,
  "suggestions": [
    {
      "id": "risk-0",
      "category": "security",
      "severity": "high",
      "description": "JWT secret should be stored in environment variables",
      "actionable": true
    },
    {
      "id": "comment-0",
      "category": "code-quality",
      "severity": "medium",
      "description": "Consider using async/await instead of promises",
      "file": "src/api/routes.ts",
      "line": 42,
      "actionable": true
    }
  ]
}
```

### Merge Recommendation

#### `GET /api/v1/reviews/:owner/:repo/:pr/recommendation`

Get merge recommendation for a PR.

**Parameters**:
- `owner` (path): Repository owner
- `repo` (path): Repository name
- `pr` (path): Pull request number
- `installationId` (query, required): GitHub App installation ID

**Example Request**:
```bash
curl "http://localhost:3000/api/v1/reviews/owner/repo/123/recommendation?installationId=123456" \
  -H "X-API-Key: your-api-key"
```

**Response**:
```json
{
  "owner": "owner",
  "repo": "repo",
  "pullNumber": 123,
  "recommendation": "approve",
  "confidence": 0.85,
  "reasons": [
    "No high-severity issues found",
    "Code follows best practices",
    "Tests are passing"
  ],
  "warnings": [
    "Consider adding more error handling"
  ]
}
```

**Recommendation Values**:
- `approve`: Safe to merge
- `request-changes`: Should not merge yet
- `comment`: Needs review but not blocking

### CI Status

#### `GET /api/v1/checks/:owner/:repo/:sha`

Get CI/check status for a commit.

**Parameters**:
- `owner` (path): Repository owner
- `repo` (path): Repository name
- `sha` (path): Commit SHA
- `installationId` (query, required): GitHub App installation ID

**Example Request**:
```bash
curl "http://localhost:3000/api/v1/checks/owner/repo/abc123?installationId=123456" \
  -H "X-API-Key: your-api-key"
```

**Response**:
```json
{
  "owner": "owner",
  "repo": "repo",
  "commitSha": "abc123",
  "status": "success",
  "checks": [
    {
      "name": "CI",
      "status": "success",
      "conclusion": "success"
    },
    {
      "name": "Tests",
      "status": "completed",
      "conclusion": "success"
    }
  ]
}
```

### Create Issue

#### `POST /api/v1/issues/:owner/:repo`

Create a GitHub issue from a suggestion.

**Parameters**:
- `owner` (path): Repository owner
- `repo` (path): Repository name
- `installationId` (query, required): GitHub App installation ID

**Request Body**:
```json
{
  "title": "Fix security issue",
  "body": "Description of the issue",
  "suggestionId": "risk-0",
  "priority": "high",
  "labels": ["bug", "security"]
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/issues/owner/repo?installationId=123456" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix security issue",
    "body": "JWT secret should be stored in environment variables",
    "suggestionId": "risk-0",
    "priority": "high"
  }'
```

**Response**:
```json
{
  "owner": "owner",
  "repo": "repo",
  "issueNumber": 456,
  "url": "https://github.com/owner/repo/issues/456"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes**:
- `INVALID_PR_NUMBER`: Invalid PR number format
- `MISSING_INSTALLATION_ID`: Missing installationId parameter
- `REVIEW_NOT_FOUND`: Review not found for the PR
- `UNAUTHORIZED`: Invalid or missing API key
- `INTERNAL_SERVER_ERROR`: Server error

## Rate Limiting

API requests are rate-limited:
- Default: 60 requests per minute
- Configurable via environment variables

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642248000
```

## Webhooks

### GitHub Webhook

#### `POST /webhooks/github`

Receive GitHub webhook events.

**Headers** (required):
- `X-GitHub-Event`: Event type
- `X-GitHub-Delivery`: Delivery ID
- `X-Hub-Signature-256`: HMAC signature

**Events**:
- `pull_request`: PR opened, updated, etc.
- `issue_comment`: Comments on PRs/issues

See [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks) for details.

## Examples

### JavaScript/TypeScript

```typescript
const API_URL = 'http://localhost:3000';
const API_KEY = 'your-api-key';

async function getReviewStatus(owner: string, repo: string, pr: number, installationId: number) {
  const response = await fetch(
    `${API_URL}/api/v1/reviews/${owner}/${repo}/${pr}?installationId=${installationId}`,
    {
      headers: {
        'X-API-Key': API_KEY,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}
```

### Python

```python
import requests

API_URL = 'http://localhost:3000'
API_KEY = 'your-api-key'

def get_review_status(owner, repo, pr, installation_id):
    response = requests.get(
        f'{API_URL}/api/v1/reviews/{owner}/{repo}/{pr}',
        params={'installationId': installation_id},
        headers={'X-API-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()
```

### cURL

```bash
# Get review status
curl "http://localhost:3000/api/v1/reviews/owner/repo/123?installationId=123456" \
  -H "X-API-Key: your-api-key"

# Get suggestions
curl "http://localhost:3000/api/v1/reviews/owner/repo/123/suggestions?installationId=123456" \
  -H "X-API-Key: your-api-key"

# Get recommendation
curl "http://localhost:3000/api/v1/reviews/owner/repo/123/recommendation?installationId=123456" \
  -H "X-API-Key: your-api-key"
```

## Support

For API-related questions:
- 📖 [Documentation](.)
- 💬 [Discussions](https://github.com/bdaly101/AI-PR-Dev/discussions)
- 🐛 [Issue Tracker](https://github.com/bdaly101/AI-PR-Dev/issues)

