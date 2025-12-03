import { CreateIssueResponse, ErrorResponse } from '../../api/types';

interface CreateIssueOptions {
  title: string;
  body: string;
  installationId?: number;
  suggestionId?: string;
  priority?: string;
  labels?: string;
  apiUrl?: string;
}

export async function createIssueCommand(
  parsed: { owner: string; repo: string; pr: number },
  options: CreateIssueOptions
): Promise<void> {
  if (!options.installationId) {
    console.error('Error: --installation-id is required');
    process.exit(1);
  }

  try {
    const url = `${options.apiUrl || 'http://localhost:3000'}/api/v1/issues?installationId=${options.installationId}`;
    
    const labels = options.labels ? options.labels.split(',').map(l => l.trim()) : [];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: parsed.owner,
        repo: parsed.repo,
        pullNumber: parsed.pr,
        title: options.title,
        body: options.body,
        suggestionId: options.suggestionId,
        priority: options.priority as 'low' | 'medium' | 'high' | undefined,
        labels: labels.length > 0 ? labels : undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ErrorResponse;
      console.error(`Error: ${error.error}`);
      if (error.message) {
        console.error(error.message);
      }
      process.exit(1);
    }

    const issue = data as CreateIssueResponse;

    console.log(`\n✅ Issue created successfully!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`📝 Issue #${issue.issueNumber}`);
    console.log(`🔗 ${issue.url}\n`);
  } catch (error) {
    console.error('Failed to create issue:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

