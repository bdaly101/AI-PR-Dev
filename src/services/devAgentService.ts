import { GitHubClient } from '../github/client';
import { devAgent } from '../ai/devAgent';

class DevAgentService {
  async handleFixLints(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number
  ) {
    try {
      const client = new GitHubClient(installationId);

      // Post initial comment
      await client.createIssueComment(
        owner,
        repo,
        pullNumber,
        '🤖 AI Dev Agent is analyzing the PR and will create a new PR with lint fixes...'
      );

      // Get PR details
      const pr = await client.getPullRequest(owner, repo, pullNumber);
      const files = await client.getPullRequestFiles(owner, repo, pullNumber);

      // Get default branch to create new branch from
      const defaultBranch = await client.getDefaultBranch(owner, repo);
      const baseSha = await client.getBranchSha(owner, repo, defaultBranch);

      // Create a new branch for fixes
      const timestamp = Date.now();
      const newBranchName = `ai-fix-lints-${pullNumber}-${timestamp}`;
      await client.createBranch(owner, repo, newBranchName, baseSha);

      const fixedFiles: string[] = [];
      let issuesFixed = '';

      // Process each file (limit to files that likely have linting issues)
      for (const file of files.slice(0, 5)) {
        // Limit to 5 files for now
        if (!file.filename.match(/\.(ts|js|tsx|jsx)$/)) {
          continue; // Only process TypeScript/JavaScript files
        }

        // Get file content
        const content = await client.getFileContent(
          owner,
          repo,
          file.filename,
          pr.head.sha
        );

        if (!content) {
          continue;
        }

        // Simulate lint errors (in a real implementation, you'd run actual linting)
        const mockLintErrors = `File: ${file.filename}\nPotential issues detected. Please review and fix.`;

        // Get AI to fix the issues
        const fixedContent = await devAgent.fixLints(
          file.filename,
          content,
          mockLintErrors
        );

        // Only update if content changed
        if (fixedContent !== content) {
          // Get the file SHA from the new branch
          try {
            await client.createOrUpdateFile(
              owner,
              repo,
              file.filename,
              fixedContent,
              `Fix lints in ${file.filename}`,
              newBranchName
            );

            fixedFiles.push(file.filename);
            issuesFixed += `- Fixed issues in ${file.filename}\n`;
          } catch (error) {
            console.error(`Error updating file ${file.filename}:`, error);
          }
        }
      }

      if (fixedFiles.length === 0) {
        await client.createIssueComment(
          owner,
          repo,
          pullNumber,
          '✅ No linting issues found or no fixes needed.'
        );
        return;
      }

      // Generate PR description
      const prDescription = await devAgent.generatePRDescription(
        fixedFiles,
        issuesFixed
      );

      // Create new pull request
      const newPr = await client.createPullRequest(
        owner,
        repo,
        `🤖 AI: Fix lints for PR #${pullNumber}`,
        newBranchName,
        defaultBranch,
        prDescription +
          `\n\n---\n*This PR was automatically created by AI Dev Agent in response to \`/ai-fix-lints\` command on PR #${pullNumber}.*\n*Please review all changes carefully before merging.*`
      );

      // Post success comment with link to new PR
      await client.createIssueComment(
        owner,
        repo,
        pullNumber,
        `✅ AI Dev Agent has created PR #${newPr.number} with lint fixes!\n\nReview it here: ${newPr.html_url}\n\n**Note:** This PR requires manual review and approval before merging.`
      );

      console.log(`Created fix PR #${newPr.number} for original PR #${pullNumber}`);
    } catch (error) {
      console.error('Error handling fix lints:', error);

      // Try to post an error comment
      try {
        const client = new GitHubClient(installationId);
        await client.createIssueComment(
          owner,
          repo,
          pullNumber,
          '❌ Failed to create lint fixes PR. Please check the logs for details.'
        );
      } catch (commentError) {
        console.error('Error posting error comment:', commentError);
      }
    }
  }
}

export const devAgentService = new DevAgentService();
