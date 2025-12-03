import { GitHubClient } from '../github/client';
import { eslintRunner } from '../linting/eslintRunner';
import { changePlanner } from '../ai/changePlanner';
import { changePlanRepo } from '../database/repositories/changePlanRepo';
import { auditRepo } from '../database/repositories/auditRepo';
import { loadRepoConfig } from '../config/repoConfig';
import { logger, logPRReview } from '../utils/logging';
import {
  StoredChangePlan,
  formatChangePlanComment,
} from '../ai/changePlan';
import { gitOperations } from './gitOperations';

/**
 * Service for managing change plans (dry-run and execution)
 */
class ChangePlanService {
  /**
   * Generate a change plan for lint fixes (dry-run mode)
   */
  async generateLintFixPlan(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number,
    triggeredBy: string,
    scope?: string
  ): Promise<{ success: boolean; planId?: string; message: string }> {
    const prLogger = logPRReview(logger, owner, repo, pullNumber, {
      action: 'generate_lint_fix_plan',
      triggeredBy,
    });

    try {
      const client = new GitHubClient(installationId);
      const config = await loadRepoConfig(client, owner, repo);

      // Get PR files
      const pr = await client.getPullRequest(owner, repo, pullNumber);
      const files = await client.getPullRequestFiles(owner, repo, pullNumber);

      // Filter to lintable files
      const lintableExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      let filesToAnalyze = files.filter(file => {
        const ext = file.filename.substring(file.filename.lastIndexOf('.'));
        return lintableExtensions.includes(ext) && file.status !== 'removed';
      });

      // Apply scope filter if provided
      if (scope) {
        filesToAnalyze = filesToAnalyze.filter(file => 
          file.filename.startsWith(scope) || file.filename.includes(scope)
        );
      }

      // Limit files
      const maxFiles = Math.min(config.devAgent.maxFilesPerPR, 20);
      filesToAnalyze = filesToAnalyze.slice(0, maxFiles);

      if (filesToAnalyze.length === 0) {
        return {
          success: false,
          message: scope 
            ? `No lintable files found matching scope: \`${scope}\``
            : 'No lintable files found in this PR',
        };
      }

      prLogger.info({ fileCount: filesToAnalyze.length }, 'Fetching file contents for lint analysis');

      // Fetch file contents
      const filesWithContent: Array<{ path: string; content: string }> = [];
      for (const file of filesToAnalyze) {
        const content = await client.getFileContent(owner, repo, file.filename, pr.head.sha);
        if (content) {
          filesWithContent.push({ path: file.filename, content });
        }
      }

      if (filesWithContent.length === 0) {
        return {
          success: false,
          message: 'Could not fetch content for any lintable files',
        };
      }

      // Run ESLint analysis
      prLogger.info({ fileCount: filesWithContent.length }, 'Running lint analysis');
      const lintResults = await eslintRunner.lintFiles(filesWithContent);

      if (lintResults.totalErrors === 0 && lintResults.totalWarnings === 0) {
        return {
          success: true,
          message: '✅ No lint issues found! The code looks clean.',
        };
      }

      prLogger.info({
        errors: lintResults.totalErrors,
        warnings: lintResults.totalWarnings,
        fixable: lintResults.totalFixable,
      }, 'Lint issues found, generating change plan');

      // Generate change plan
      const planResponse = await changePlanner.generatePlan(
        owner,
        repo,
        pullNumber,
        lintResults,
        filesWithContent
      );

      if (!planResponse.canProceed || !planResponse.plan) {
        return {
          success: false,
          message: `Could not generate change plan: ${planResponse.reason || 'Unknown error'}`,
        };
      }

      const plan = planResponse.plan;

      // Validate plan against safety limits
      const validation = changePlanner.validatePlan(plan, {
        maxFiles: config.devAgent.maxFilesPerPR,
        maxLinesChanged: config.devAgent.maxLinesChanged,
      });

      if (!validation.valid) {
        prLogger.warn({ violations: validation.violations }, 'Change plan exceeds safety limits');
        return {
          success: false,
          message: `Change plan exceeds safety limits:\n${validation.violations.map(v => `- ${v}`).join('\n')}`,
        };
      }

      // Post the plan as a comment
      const planComment = formatChangePlanComment(plan, false);
      const comment = await client.createIssueComment(owner, repo, pullNumber, planComment);

      // Store the plan
      const storedPlan: StoredChangePlan = {
        id: plan.id,
        owner,
        repo,
        pullNumber,
        commentId: comment.id,
        triggeredBy,
        command: '/ai-fix-lints',
        status: 'pending',
        plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      changePlanRepo.create(storedPlan);

      // Audit log
      auditRepo.log({
        timestamp: new Date().toISOString(),
        action: 'change_plan_created',
        triggered_by: triggeredBy,
        owner,
        repo,
        pull_number: pullNumber,
        files_changed: plan.files.map(f => f.filePath).join(','),
        lines_added: plan.estimatedLinesChanged,
        success: 1,
      });

      prLogger.info({ planId: plan.id, commentId: comment.id }, 'Change plan posted');

      return {
        success: true,
        planId: plan.id,
        message: `Change plan generated! React with 👍 on the plan comment to approve.`,
      };
    } catch (error) {
      prLogger.error({ error }, 'Failed to generate change plan');

      auditRepo.log({
        timestamp: new Date().toISOString(),
        action: 'change_plan_failed',
        triggered_by: triggeredBy,
        owner,
        repo,
        pull_number: pullNumber,
        success: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        message: `Failed to generate change plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate a dry-run preview (no approval needed)
   */
  async generateDryRunPreview(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number,
    triggeredBy: string,
    scope?: string
  ): Promise<{ success: boolean; message: string }> {
    const prLogger = logPRReview(logger, owner, repo, pullNumber, {
      action: 'dry_run_preview',
      triggeredBy,
    });

    try {
      const client = new GitHubClient(installationId);

      // Get PR files
      const pr = await client.getPullRequest(owner, repo, pullNumber);
      const files = await client.getPullRequestFiles(owner, repo, pullNumber);

      // Filter to lintable files
      const lintableExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      let filesToAnalyze = files.filter(file => {
        const ext = file.filename.substring(file.filename.lastIndexOf('.'));
        return lintableExtensions.includes(ext) && file.status !== 'removed';
      });

      if (scope) {
        filesToAnalyze = filesToAnalyze.filter(file => 
          file.filename.startsWith(scope) || file.filename.includes(scope)
        );
      }

      filesToAnalyze = filesToAnalyze.slice(0, 20);

      if (filesToAnalyze.length === 0) {
        await client.createIssueComment(
          owner,
          repo,
          pullNumber,
          `## 🔍 Dry Run Results\n\n${scope ? `No lintable files found matching scope: \`${scope}\`` : 'No lintable files found in this PR'}`
        );
        return { success: true, message: 'No files to analyze' };
      }

      // Fetch file contents
      const filesWithContent: Array<{ path: string; content: string }> = [];
      for (const file of filesToAnalyze) {
        const content = await client.getFileContent(owner, repo, file.filename, pr.head.sha);
        if (content) {
          filesWithContent.push({ path: file.filename, content });
        }
      }

      // Run lint analysis
      const lintResults = await eslintRunner.lintFiles(filesWithContent);
      const formattedResults = eslintRunner.formatResults(lintResults);

      // Post results
      let comment = `## 🔍 Dry Run Results\n\n`;
      comment += `**Files Analyzed:** ${filesWithContent.length}\n`;
      comment += `**Scope:** ${scope || 'All PR files'}\n\n`;
      comment += formattedResults;
      comment += `\n\n---\n`;
      comment += `*This is a dry-run preview. No changes were made.*\n`;
      comment += `*To apply fixes, run \`/ai-fix-lints\` without the \`--dry-run\` flag.*`;

      await client.createIssueComment(owner, repo, pullNumber, comment);

      prLogger.info({
        errors: lintResults.totalErrors,
        warnings: lintResults.totalWarnings,
      }, 'Dry run preview posted');

      return { success: true, message: 'Dry run preview posted' };
    } catch (error) {
      prLogger.error({ error }, 'Dry run failed');
      return {
        success: false,
        message: `Dry run failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle approval of a change plan (via command or reaction)
   */
  async handlePlanApproval(
    planId: string,
    approvedBy: string,
    installationId: number
  ): Promise<{ success: boolean; prNumber?: number; message: string }> {
    const storedPlan = changePlanRepo.getById(planId);

    if (!storedPlan) {
      return { success: false, message: 'Change plan not found' };
    }

    if (storedPlan.status !== 'pending') {
      return { success: false, message: `Plan is already ${storedPlan.status}` };
    }

    const prLogger = logPRReview(logger, storedPlan.owner, storedPlan.repo, storedPlan.pullNumber, {
      action: 'execute_change_plan',
      planId,
      approvedBy,
    });

    try {
      // Update status to executing
      changePlanRepo.updateStatus(planId, 'executing', {
        approvedBy,
        approvedAt: new Date().toISOString(),
      });

      const client = new GitHubClient(installationId);

      // Get default branch info
      const defaultBranch = await client.getDefaultBranch(storedPlan.owner, storedPlan.repo);

      // Use the new gitOperations service for validation, PR creation, and rollback
      prLogger.info('Executing change plan with validation');
      
      const result = await gitOperations.createPRFromPlan({
        owner: storedPlan.owner,
        repo: storedPlan.repo,
        plan: storedPlan.plan,
        baseBranch: defaultBranch,
        triggeredBy: approvedBy,
        originalPR: storedPlan.pullNumber,
        installationId,
        skipValidation: false, // Always validate
      });

      if (!result.success) {
        // Update plan status to failed
        changePlanRepo.updateStatus(planId, 'failed', {
          error: result.error,
        });

        prLogger.warn({
          error: result.error,
          rollbackPerformed: result.rollbackPerformed,
        }, 'Change plan execution failed');

        // Post failure comment if not already posted by validation
        if (!result.error?.includes('Syntax validation failed')) {
          await client.createIssueComment(
            storedPlan.owner,
            storedPlan.repo,
            storedPlan.pullNumber,
            `❌ **Change plan execution failed**\n\n` +
            `**Error:** ${result.error}\n\n` +
            `${result.rollbackPerformed ? '✅ Rollback was performed successfully.' : '⚠️ Manual cleanup may be required.'}\n\n` +
            `*Please review the error and try again.*`
          );
        }

        return {
          success: false,
          message: result.error || 'Unknown error',
        };
      }

      // Update plan status to completed
      changePlanRepo.updateStatus(planId, 'completed', {
        resultPrNumber: result.prNumber,
      });

      // Post success comment on original PR
      await client.createIssueComment(
        storedPlan.owner,
        storedPlan.repo,
        storedPlan.pullNumber,
        `✅ **Change plan executed successfully!**\n\n` +
        `PR #${result.prNumber} has been created with the proposed fixes.\n\n` +
        `👉 [Review the changes](${result.prUrl})\n\n` +
        `**Files committed:** ${result.filesCommitted?.length || 0}\n\n` +
        `*This PR requires manual review and approval before merging.*`
      );

      // Audit log
      auditRepo.log({
        timestamp: new Date().toISOString(),
        action: 'change_plan_executed',
        triggered_by: approvedBy,
        owner: storedPlan.owner,
        repo: storedPlan.repo,
        pull_number: storedPlan.pullNumber,
        pr_number: result.prNumber,
        files_changed: result.filesCommitted?.join(',') || '',
        success: 1,
      });

      prLogger.info({ newPrNumber: result.prNumber }, 'Change plan executed successfully');

      return {
        success: true,
        prNumber: result.prNumber,
        message: `PR #${result.prNumber} created successfully`,
      };
    } catch (error) {
      prLogger.error({ error }, 'Failed to execute change plan');

      changePlanRepo.updateStatus(planId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      auditRepo.log({
        timestamp: new Date().toISOString(),
        action: 'change_plan_execution_failed',
        triggered_by: approvedBy,
        owner: storedPlan.owner,
        repo: storedPlan.repo,
        pull_number: storedPlan.pullNumber,
        success: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        message: `Failed to execute plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle rejection of a change plan
   */
  async handlePlanRejection(planId: string, rejectedBy: string): Promise<void> {
    changePlanRepo.updateStatus(planId, 'rejected', {
      error: `Rejected by ${rejectedBy}`,
    });

    logger.info({ planId, rejectedBy }, 'Change plan rejected');
  }

  /**
   * Get a pending plan by comment ID
   */
  getPlanByCommentId(commentId: number): StoredChangePlan | null {
    return changePlanRepo.getByCommentId(commentId);
  }
}

export const changePlanService = new ChangePlanService();

