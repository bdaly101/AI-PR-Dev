import { callOpenAI, isOpenAIAvailable } from './providers/openai';
import { callClaude, isAnthropicAvailable } from './providers/anthropic';
import { logger } from '../utils/logging';
import { LintResults } from '../linting/types';
import {
  ChangePlan,
  ChangePlanResponse,
  ChangePlanResponseSchema,
  generatePlanId,
} from './changePlan';
import { createUnifiedDiff } from '../utils/diff';

/**
 * System prompt for the change planner AI
 */
const CHANGE_PLANNER_SYSTEM_PROMPT = `You are an expert code refactoring assistant. Your job is to analyze lint issues and propose a structured plan to fix them.

You must respond with valid JSON matching this exact schema:

{
  "canProceed": boolean,
  "reason": "string (if canProceed is false)",
  "plan": {
    "id": "string (use the provided plan ID)",
    "title": "string (brief title, e.g., 'Fix 12 lint issues across 3 files')",
    "summary": "string (2-3 sentence overview)",
    "rationale": "string (why these changes improve the code)",
    "files": [
      {
        "filePath": "string",
        "action": "modify" | "create" | "delete",
        "description": "string (what changes are being made)",
        "originalContent": "string (current file content)",
        "proposedContent": "string (new content after fixes)",
        "issuesAddressed": ["list of issue descriptions"],
        "riskLevel": "low" | "medium" | "high"
      }
    ],
    "totalFiles": number,
    "estimatedLinesChanged": number,
    "riskAssessment": {
      "overall": "low" | "medium" | "high",
      "factors": ["list of risk factors"],
      "mitigations": ["list of mitigations"]
    },
    "testingRecommendations": ["what to test after applying"],
    "rollbackPlan": "string (how to revert)"
  }
}

Guidelines:
1. Only fix the specific lint issues provided - don't make unrelated changes
2. Preserve all existing functionality and behavior
3. Keep changes minimal and focused
4. For each file, provide the COMPLETE proposedContent (not just the changed parts)
5. Assess risk based on: number of changes, complexity, potential side effects
6. If there are no fixable issues, set canProceed to false with appropriate reason
7. Group related changes together when possible
8. Consider the impact on imports, exports, and dependent code

Risk Level Guidelines:
- LOW: Simple formatting, unused variable removal, adding semicolons
- MEDIUM: Variable renaming, refactoring logic, changing control flow
- HIGH: Modifying public APIs, changing function signatures, removing code`;

/**
 * AI Change Planner - generates structured change plans from lint results
 */
export class ChangePlanner {
  /**
   * Generate a change plan from lint results
   */
  async generatePlan(
    owner: string,
    repo: string,
    pullNumber: number,
    lintResults: LintResults,
    filesWithContent: Array<{ path: string; content: string }>
  ): Promise<ChangePlanResponse> {
    const planId = generatePlanId(owner, repo, pullNumber);

    // Build the prompt with lint issues and file contents
    const prompt = this.buildPrompt(planId, lintResults, filesWithContent);

    logger.info({
      module: 'change-planner',
      planId,
      filesCount: filesWithContent.length,
      totalIssues: lintResults.totalErrors + lintResults.totalWarnings,
    }, 'Generating change plan');

    try {
      // Try OpenAI first
      if (isOpenAIAvailable()) {
        const content = await callOpenAI(
          CHANGE_PLANNER_SYSTEM_PROMPT,
          prompt,
          { model: 'gpt-4-turbo-preview' }
        );

        const parsed = this.parseResponse(content, planId);
        
        // Add diffs if plan was generated
        if (parsed.canProceed && parsed.plan) {
          this.addDiffsToplan(parsed.plan, filesWithContent);
        }

        logger.info({
          module: 'change-planner',
          planId,
          canProceed: parsed.canProceed,
          filesInPlan: parsed.plan?.files.length || 0,
        }, 'Change plan generated');

        return parsed;
      }
    } catch (error) {
      logger.warn({ error, planId }, 'OpenAI failed, trying Anthropic');
    }

    // Fallback to Anthropic
    if (isAnthropicAvailable()) {
      try {
        const content = await callClaude(
          CHANGE_PLANNER_SYSTEM_PROMPT,
          prompt
        );

        const parsed = this.parseResponse(content, planId);
        
        if (parsed.canProceed && parsed.plan) {
          this.addDiffsToplan(parsed.plan, filesWithContent);
        }

        return parsed;
      } catch (anthropicError) {
        logger.error({ error: anthropicError, planId }, 'Anthropic also failed');
      }
    }

    // Return error response
    return {
      canProceed: false,
      reason: 'Failed to generate change plan: No AI provider available or all failed',
    };
  }

  /**
   * Build the prompt for the AI
   */
  private buildPrompt(
    planId: string,
    lintResults: LintResults,
    filesWithContent: Array<{ path: string; content: string }>
  ): string {
    let prompt = `Generate a change plan to fix the following lint issues.\n\n`;
    prompt += `**Plan ID:** ${planId}\n\n`;

    // Add lint issues
    prompt += `## Lint Issues Found\n\n`;
    
    for (const fileResult of lintResults.files) {
      if (fileResult.issues.length === 0) {
        continue;
      }

      prompt += `### \`${fileResult.filePath}\`\n`;
      prompt += `Errors: ${fileResult.errorCount}, Warnings: ${fileResult.warningCount}\n\n`;

      for (const issue of fileResult.issues) {
        const fixable = issue.fix ? ' [FIXABLE]' : '';
        prompt += `- Line ${issue.line}: ${issue.message} (${issue.ruleId})${fixable}\n`;
      }
      prompt += '\n';
    }

    // Add file contents
    prompt += `## File Contents\n\n`;
    
    for (const file of filesWithContent) {
      const lintResult = lintResults.files.find(f => f.filePath === file.path);
      if (!lintResult || lintResult.issues.length === 0) {
        continue;
      }

      prompt += `### \`${file.path}\`\n`;
      prompt += `\`\`\`\n${file.content}\n\`\`\`\n\n`;
    }

    prompt += `## Instructions\n\n`;
    prompt += `1. Analyze the lint issues above\n`;
    prompt += `2. For each file with issues, generate the fixed content\n`;
    prompt += `3. Return a structured change plan in the specified JSON format\n`;
    prompt += `4. Use the plan ID: ${planId}\n`;

    return prompt;
  }

  /**
   * Parse and validate the AI response
   */
  private parseResponse(content: string, planId: string): ChangePlanResponse {
    try {
      // Try to extract JSON from the response
      let jsonStr = content;
      
      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);
      
      // Validate with Zod
      const validated = ChangePlanResponseSchema.parse(parsed);

      // Ensure plan ID is set correctly
      if (validated.plan) {
        validated.plan.id = planId;
      }

      return validated;
    } catch (error) {
      logger.error({ error, contentPreview: content.substring(0, 500) }, 'Failed to parse AI response');
      
      return {
        canProceed: false,
        reason: 'Failed to parse AI response as valid change plan',
      };
    }
  }

  /**
   * Add unified diffs to the plan
   */
  private addDiffsToplan(
    plan: ChangePlan,
    filesWithContent: Array<{ path: string; content: string }>
  ): void {
    for (const fileChange of plan.files) {
      if (fileChange.action === 'modify' && fileChange.proposedContent) {
        const originalFile = filesWithContent.find(f => f.path === fileChange.filePath);
        if (originalFile) {
          fileChange.originalContent = originalFile.content;
          fileChange.diff = createUnifiedDiff(
            fileChange.filePath,
            originalFile.content,
            fileChange.proposedContent
          );
        }
      }
    }
  }

  /**
   * Validate a change plan against safety limits
   */
  validatePlan(plan: ChangePlan, limits: {
    maxFiles: number;
    maxLinesChanged: number;
  }): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    if (plan.totalFiles > limits.maxFiles) {
      violations.push(`Plan affects ${plan.totalFiles} files (max: ${limits.maxFiles})`);
    }

    if (plan.estimatedLinesChanged > limits.maxLinesChanged) {
      violations.push(`Plan changes ~${plan.estimatedLinesChanged} lines (max: ${limits.maxLinesChanged})`);
    }

    // Check for high-risk changes
    const highRiskFiles = plan.files.filter(f => f.riskLevel === 'high');
    if (highRiskFiles.length > 0) {
      violations.push(`${highRiskFiles.length} high-risk file(s) detected: ${highRiskFiles.map(f => f.filePath).join(', ')}`);
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}

/**
 * Singleton instance
 */
export const changePlanner = new ChangePlanner();

