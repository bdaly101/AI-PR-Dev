import { ReviewStatusResponse, ErrorResponse } from '../../api/types';

interface StatusOptions {
  installationId?: number;
  apiUrl?: string;
}

export async function statusCommand(
  parsed: { owner: string; repo: string; pr: number },
  options: StatusOptions
): Promise<void> {
  if (!options.installationId) {
    console.error('Error: --installation-id is required');
    process.exit(1);
  }

  try {
    const url = `${options.apiUrl || 'http://localhost:3000'}/api/v1/reviews/${parsed.owner}/${parsed.repo}/${parsed.pr}?installationId=${options.installationId}`;
    
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

    const review = data as ReviewStatusResponse;

    console.log(`\n📋 Review Status: ${parsed.owner}/${parsed.repo}#${parsed.pr}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (!review.reviewed) {
      console.log('❌ Not reviewed yet');
      return;
    }

    console.log(`✅ Reviewed: ${review.reviewedAt || 'Unknown time'}`);
    if (review.modelUsed) {
      console.log(`🤖 Model: ${review.modelUsed}`);
    }
    if (review.severity) {
      const emoji = review.severity === 'critical' ? '🔴' : review.severity === 'warning' ? '🟡' : '🟢';
      console.log(`${emoji} Severity: ${review.severity.toUpperCase()}`);
    }
    console.log(`\n📊 Summary:`);
    if (review.reviewSummary) {
      console.log(`   ${review.reviewSummary}`);
    }
    console.log(`\n📈 Stats:`);
    console.log(`   Risks: ${review.riskCount}`);
    console.log(`   Suggestions: ${review.suggestionCount}`);
    if (review.hasHighRisks) {
      console.log(`   ⚠️  High-severity risks found`);
    }
    console.log('');
  } catch (error) {
    console.error('Failed to fetch review status:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

