import { GitHubClient } from '../github/client';
import { logger } from '../utils/logging';
import { validateMultipleFiles, formatValidationResultForComment } from '../validation/syntaxValidator';
import { ChangePlan } from '../ai/changePlan';
import { analyzeImpact, formatImpactAnalysisForPR, ImpactAnalysis } from '../ai/impactAnalysis';

/**
 * Result of a git operation
 */
export interface GitOperationResult {
  success: boolean;
  branchName?: string;
  prNumber?: number;
  prUrl?: string;
  error?: string;
  filesCommitted?: string[];
  rollbackPerformed?: boolean;
}

/**
 * Options for creating a PR from a change plan
 */
export interface CreatePROptions {
  owner: string;
  repo: string;
  plan: ChangePlan;
  baseBranch: string;
  triggeredBy: string;
  originalPR: number;
  originalCommentId?: number;  // For linking back to the command comment
  installationId: number;
  skipValidation?: boolean;
  includeImpactAnalysis?: boolean;  // Whether to generate AI impact analysis
}

/**
 * Service for handling Git operations with proper error handling and rollback
 */
export class GitOperationsService {
  /**
   * Create a PR from a change plan with validation and rollback support
   */
  async createPRFromPlan(options: CreatePROptions): Promise<GitOperationResult> {
    const {
      owner,
      repo,
      plan,
      baseBranch,
      triggeredBy,
      originalPR,
      originalCommentId,
      installationId,
      skipValidation = false,
      includeImpactAnalysis = true,
    } = options;

    const client = new GitHubClient(installationId);
    const operationLogger = logger.child({
      module: 'git-operations',
      owner,
      repo,
      planId: plan.id,
      originalPR,
    });

    let branchName: string | null = null;
    const committedFiles: string[] = [];

    try {
      // Step 1: Validate proposed changes (syntax check)
      if (!skipValidation) {
        operationLogger.info('Validating proposed changes');
        
        const filesToValidate = plan.files
          .filter(f => f.action === 'modify' && f.proposedContent)
          .map(f => ({ path: f.filePath, content: f.proposedContent! }));

        if (filesToValidate.length > 0) {
          const validationResult = validateMultipleFiles(filesToValidate);
          
          if (!validationResult.isValid) {
            operationLogger.warn({
              totalErrors: validationResult.totalErrors,
            }, 'Syntax validation failed');

            // Post validation failure comment
            await client.createIssueComment(
              owner,
              repo,
              originalPR,
              formatValidationResultForComment(validationResult)
            );

            return {
              success: false,
              error: `Syntax validation failed: ${validationResult.totalErrors} error(s) found`,
            };
          }
        }

        operationLogger.info('Syntax validation passed');
      }

      // Step 2: Get base branch SHA
      operationLogger.info({ baseBranch }, 'Getting base branch SHA');
      const baseSha = await client.getBranchSha(owner, repo, baseBranch);

      // Step 3: Create feature branch
      const timestamp = Date.now();
      branchName = `ai-fix/${plan.id.split('-').slice(-2).join('-')}-${timestamp}`;
      
      operationLogger.info({ branchName }, 'Creating feature branch');
      await client.createBranch(owner, repo, branchName, baseSha);

      // Step 4: Apply changes with individual commits
      for (const fileChange of plan.files) {
        if (fileChange.action === 'modify' && fileChange.proposedContent) {
          try {
            operationLogger.debug({ file: fileChange.filePath }, 'Applying change to file');

            // Generate commit message for this file
            const commitMessage = `fix: ${fileChange.description}`;

            await client.createOrUpdateFile(
              owner,
              repo,
              fileChange.filePath,
              fileChange.proposedContent,
              commitMessage,
              branchName
            );

            committedFiles.push(fileChange.filePath);
            operationLogger.debug({ file: fileChange.filePath }, 'Change applied successfully');

          } catch (fileError) {
            operationLogger.error({ 
              file: fileChange.filePath, 
              error: fileError 
            }, 'Failed to apply change to file');

            // Continue with other files, but track the failure
            // We'll handle partial failures at the end
          }
        }
      }

      // Step 5: Check if any files were committed
      if (committedFiles.length === 0) {
        operationLogger.warn('No files were committed');

        // Cleanup: delete the empty branch
        await this.deleteBranch(client, owner, repo, branchName, operationLogger);

        return {
          success: false,
          error: 'No files were successfully committed',
          rollbackPerformed: true,
        };
      }

      // Step 6: Generate impact analysis (optional)
      let impactAnalysis: ImpactAnalysis | null = null;
      if (includeImpactAnalysis) {
        operationLogger.info('Generating impact analysis');
        try {
          const changedFilesForAnalysis = plan.files
            .filter(f => f.action === 'modify' && committedFiles.includes(f.filePath))
            .map(f => ({
              path: f.filePath,
              newContent: f.proposedContent || '',
              changeDescription: f.description,
            }));

          impactAnalysis = await analyzeImpact(changedFilesForAnalysis);
        } catch (analysisError) {
          operationLogger.warn({ error: analysisError }, 'Impact analysis failed, continuing without it');
        }
      }

      // Step 7: Create the PR
      operationLogger.info('Creating pull request');

      const prTitle = `🤖 AI: ${plan.title}`;
      const prBody = this.generatePRBody({
        plan,
        triggeredBy,
        originalPR,
        originalCommentId,
        committedFiles,
        owner,
        repo,
        impactAnalysis,
      });

      const newPR = await client.createPullRequest(
        owner,
        repo,
        prTitle,
        branchName,
        baseBranch,
        prBody
      );

      // Step 8: Add labels
      try {
        await client.addLabels(owner, repo, newPR.number, [
          'ai-generated',
          'automated',
          'ready-for-review',
        ]);
      } catch (labelError) {
        operationLogger.warn({ error: labelError }, 'Failed to add labels');
        // Non-critical, continue
      }

      operationLogger.info({
        prNumber: newPR.number,
        filesCommitted: committedFiles.length,
      }, 'PR created successfully');

      return {
        success: true,
        branchName,
        prNumber: newPR.number,
        prUrl: newPR.html_url,
        filesCommitted: committedFiles,
      };

    } catch (error) {
      operationLogger.error({ error }, 'Git operation failed');

      // Attempt rollback if branch was created
      if (branchName) {
        operationLogger.info({ branchName }, 'Attempting rollback');
        const rollbackSuccess = await this.deleteBranch(client, owner, repo, branchName, operationLogger);
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          rollbackPerformed: rollbackSuccess,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a branch (for rollback)
   */
  private async deleteBranch(
    client: GitHubClient,
    owner: string,
    repo: string,
    branchName: string,
    operationLogger: typeof logger
  ): Promise<boolean> {
    try {
      await client.deleteBranch(owner, repo, branchName);
      operationLogger.info({ branchName }, 'Branch deleted (rollback successful)');
      return true;
    } catch (deleteError) {
      operationLogger.error({ 
        branchName, 
        error: deleteError 
      }, 'Failed to delete branch during rollback');
      return false;
    }
  }

  /**
   * Generate PR body with full context
   */
  private generatePRBody(options: {
    plan: ChangePlan;
    triggeredBy: string;
    originalPR: number;
    originalCommentId?: number;
    committedFiles: string[];
    owner: string;
    repo: string;
    impactAnalysis?: ImpactAnalysis | null;
  }): string {
    const { plan, triggeredBy, originalPR, originalCommentId, committedFiles, owner, repo, impactAnalysis } = options;
    
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
    };

    let body = `## 🤖 AI-Generated Changes\n\n`;
    body += `This PR was automatically generated by AI Dev Agent in response to a command from @${triggeredBy}.\n\n`;

    // Link to original command comment if available
    if (originalCommentId) {
      body += `> 📎 [View original command](https://github.com/${owner}/${repo}/pull/${originalPR}#issuecomment-${originalCommentId})\n\n`;
    }

    body += `### Summary\n\n`;
    body += `${plan.summary}\n\n`;

    body += `### Rationale\n\n`;
    body += `${plan.rationale}\n\n`;

    body += `### 📁 Files Changed (${committedFiles.length})\n\n`;
    for (const file of committedFiles) {
      const fileChange = plan.files.find(f => f.filePath === file);
      if (fileChange) {
        body += `- \`${file}\`: ${fileChange.description}\n`;
      } else {
        body += `- \`${file}\`\n`;
      }
    }
    body += '\n';

    // Files that failed (if any)
    const failedFiles = plan.files
      .filter(f => f.action === 'modify' && !committedFiles.includes(f.filePath))
      .map(f => f.filePath);

    if (failedFiles.length > 0) {
      body += `### ⚠️ Files Not Updated\n\n`;
      body += `The following files could not be updated:\n`;
      for (const file of failedFiles) {
        body += `- \`${file}\`\n`;
      }
      body += '\n';
    }

    // Include AI-generated impact analysis if available
    if (impactAnalysis) {
      body += formatImpactAnalysisForPR(impactAnalysis);
      body += '\n';
    } else {
      // Fallback to plan's built-in risk assessment
      body += `### ⚠️ Risk Assessment\n\n`;
      body += `**Overall Risk:** ${riskEmoji[plan.riskAssessment.overall]} ${plan.riskAssessment.overall.toUpperCase()}\n\n`;

      if (plan.riskAssessment.factors.length > 0) {
        body += `**Risk Factors:**\n`;
        for (const factor of plan.riskAssessment.factors) {
          body += `- ${factor}\n`;
        }
        body += '\n';
      }

      if (plan.riskAssessment.mitigations.length > 0) {
        body += `**Mitigations:**\n`;
        for (const mitigation of plan.riskAssessment.mitigations) {
          body += `- ${mitigation}\n`;
        }
        body += '\n';
      }

      if (plan.testingRecommendations.length > 0) {
        body += `### 🧪 Testing Recommendations\n\n`;
        for (const rec of plan.testingRecommendations) {
          body += `- ${rec}\n`;
        }
        body += '\n';
      }

      body += `### ↩️ Rollback\n\n`;
      body += `${plan.rollbackPlan}\n\n`;
    }

    body += `---\n\n`;
    body += `### 📋 Metadata\n\n`;
    body += `| Field | Value |\n`;
    body += `|-------|-------|\n`;
    body += `| **Triggered by** | @${triggeredBy} |\n`;
    body += `| **Original PR** | #${originalPR} |\n`;
    body += `| **Plan ID** | \`${plan.id}\` |\n`;
    body += `| **Files Modified** | ${committedFiles.length} |\n`;
    body += '\n';

    body += `---\n\n`;
    body += `### ✅ Review Checklist\n\n`;
    body += `- [ ] I have reviewed all changed files\n`;
    body += `- [ ] The changes look correct and safe\n`;
    body += `- [ ] I have run the test suite locally\n`;
    body += `- [ ] No unintended side effects are present\n\n`;

    body += `---\n`;
    body += `*This PR was generated by AI Dev Agent and requires human review before merging.*\n`;
    body += `*Please verify all changes carefully. cc @${triggeredBy}*`;

    return body;
  }
}

/**
 * Singleton instance
 */
export const gitOperations = new GitOperationsService();

