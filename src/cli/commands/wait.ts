import { ReviewStatusResponse, ErrorResponse } from '../../api/types';

interface WaitOptions {
  installationId?: number;
  apiUrl?: string;
  timeout?: string;
  interval?: string;
}

export async function waitCommand(
  parsed: { owner: string; repo: string; pr: number },
  options: WaitOptions
): Promise<void> {
  if (!options.installationId) {
    console.error('Error: --installation-id is required');
    process.exit(1);
  }

  const timeoutMs = parseInt(options.timeout || '300', 10) * 1000;
  const intervalMs = parseInt(options.interval || '5', 10) * 1000;
  const startTime = Date.now();

  console.log(`⏳ Waiting for review to complete: ${parsed.owner}/${parsed.repo}#${parsed.pr}`);
  console.log(`   Timeout: ${timeoutMs / 1000}s, Poll interval: ${intervalMs / 1000}s\n`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const url = `${options.apiUrl || 'http://localhost:3000'}/api/v1/reviews/${parsed.owner}/${parsed.repo}/${parsed.pr}?installationId=${options.installationId}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        const review = data as ReviewStatusResponse;
        if (review.reviewed) {
          console.log(`✅ Review completed!`);
          console.log(`   Reviewed at: ${review.reviewedAt}`);
          if (review.severity) {
            const emoji = review.severity === 'critical' ? '🔴' : review.severity === 'warning' ? '🟡' : '🟢';
            console.log(`   ${emoji} Severity: ${review.severity.toUpperCase()}`);
          }
          process.exit(0);
        }
      } else {
        const error = data as ErrorResponse;
        if (error.code === 'REVIEW_NOT_FOUND') {
          // Review not found yet, keep waiting
          process.stdout.write('.');
        } else {
          console.error(`\nError: ${error.error}`);
          process.exit(1);
        }
      }
    } catch (error) {
      // Network error, keep trying
      process.stdout.write('.');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  console.log(`\n⏱️  Timeout reached. Review may still be in progress.`);
  process.exit(1);
}

