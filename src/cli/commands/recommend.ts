import { RecommendationResponse, ErrorResponse } from '../../api/types';

interface RecommendOptions {
  installationId?: number;
  apiUrl?: string;
}

export async function recommendCommand(
  parsed: { owner: string; repo: string; pr: number },
  options: RecommendOptions
): Promise<void> {
  if (!options.installationId) {
    console.error('Error: --installation-id is required');
    process.exit(1);
  }

  try {
    const url = `${options.apiUrl || 'http://localhost:3000'}/api/v1/reviews/${parsed.owner}/${parsed.repo}/${parsed.pr}/recommendation?installationId=${options.installationId}`;
    
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

    const recommendation = data as RecommendationResponse;

    console.log(`\n🎯 Merge Recommendation: ${parsed.owner}/${parsed.repo}#${parsed.pr}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const recommendationEmoji = recommendation.recommendation === 'MERGE' ? '✅' :
                                 recommendation.recommendation === 'BLOCK' ? '❌' : '⚠️';

    console.log(`${recommendationEmoji} Recommendation: ${recommendation.recommendation}`);
    console.log(`📊 Confidence: ${Math.round(recommendation.confidence * 100)}%\n`);

    if (recommendation.reviewSeverity) {
      const severityEmoji = recommendation.reviewSeverity === 'critical' ? '🔴' :
                           recommendation.reviewSeverity === 'warning' ? '🟡' : '🟢';
      console.log(`${severityEmoji} Review Severity: ${recommendation.reviewSeverity.toUpperCase()}`);
    }
    if (recommendation.ciStatus) {
      const ciEmoji = recommendation.ciStatus === 'success' ? '✅' :
                     recommendation.ciStatus === 'failure' ? '❌' : '⏳';
      console.log(`${ciEmoji} CI Status: ${recommendation.ciStatus.toUpperCase()}`);
    }
    console.log(`\n📊 Risk Summary:`);
    console.log(`   🔴 High: ${recommendation.highRiskCount}`);
    console.log(`   🟡 Medium: ${recommendation.mediumRiskCount}`);
    console.log(`   🟢 Low: ${recommendation.lowRiskCount}`);

    if (recommendation.reasons.length > 0) {
      console.log(`\n💭 Reasons:`);
      recommendation.reasons.forEach((reason, idx) => {
        console.log(`   ${idx + 1}. ${reason}`);
      });
    }
    console.log('');
  } catch (error) {
    console.error('Failed to get recommendation:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

