import { SuggestionsResponse, ErrorResponse } from '../../api/types';

interface SuggestionsOptions {
  installationId?: number;
  apiUrl?: string;
}

export async function suggestionsCommand(
  parsed: { owner: string; repo: string; pr: number },
  options: SuggestionsOptions
): Promise<void> {
  if (!options.installationId) {
    console.error('Error: --installation-id is required');
    process.exit(1);
  }

  try {
    const url = `${options.apiUrl || 'http://localhost:3000'}/api/v1/reviews/${parsed.owner}/${parsed.repo}/${parsed.pr}/suggestions?installationId=${options.installationId}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      const error = data as ErrorResponse;
      console.error(`Error: ${error.error}`);
      if (error.message) {
        console.error(error.message);
      }
      process.exit(1);
    }

    const result = data as SuggestionsResponse;

    console.log(`\n💡 Suggestions: ${parsed.owner}/${parsed.repo}#${parsed.pr}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (result.suggestions.length === 0) {
      console.log('✅ No suggestions found');
      return;
    }

    result.suggestions.forEach((suggestion, idx) => {
      const severityEmoji = suggestion.severity === 'high' ? '🔴' : suggestion.severity === 'medium' ? '🟡' : '🟢';
      console.log(`${idx + 1}. ${severityEmoji} [${suggestion.category.toUpperCase()}] ${suggestion.severity.toUpperCase()}`);
      console.log(`   ${suggestion.description}`);
      if (suggestion.file) {
        console.log(`   📁 ${suggestion.file}:${suggestion.line}`);
      }
      console.log(`   ID: ${suggestion.id}`);
      console.log('');
    });
  } catch (error) {
    console.error('Failed to fetch suggestions:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

