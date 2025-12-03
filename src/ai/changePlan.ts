import { z } from 'zod';

/**
 * Schema for a single file change in a change plan
 */
export const FileChangeSchema = z.object({
  filePath: z.string().describe('Path to the file being changed'),
  action: z.enum(['modify', 'create', 'delete']).describe('Type of change'),
  description: z.string().describe('Brief description of what will be changed'),
  originalContent: z.string().optional().describe('Original file content (for modify)'),
  proposedContent: z.string().optional().describe('New content after changes'),
  diff: z.string().optional().describe('Unified diff showing changes'),
  issuesAddressed: z.array(z.string()).describe('List of issues this change addresses'),
  riskLevel: z.enum(['low', 'medium', 'high']).describe('Risk level of this change'),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

/**
 * Schema for a complete change plan
 */
export const ChangePlanSchema = z.object({
  id: z.string().describe('Unique identifier for this plan'),
  title: z.string().describe('Brief title for the change plan'),
  summary: z.string().describe('Overview of what changes will be made'),
  rationale: z.string().describe('Why these changes are being proposed'),
  files: z.array(FileChangeSchema).describe('List of file changes'),
  totalFiles: z.number().describe('Total number of files affected'),
  estimatedLinesChanged: z.number().describe('Estimated lines added + removed'),
  riskAssessment: z.object({
    overall: z.enum(['low', 'medium', 'high']).describe('Overall risk level'),
    factors: z.array(z.string()).describe('Risk factors considered'),
    mitigations: z.array(z.string()).describe('Suggested mitigations'),
  }),
  testingRecommendations: z.array(z.string()).describe('What to test after applying'),
  rollbackPlan: z.string().describe('How to revert if issues occur'),
});

export type ChangePlan = z.infer<typeof ChangePlanSchema>;

/**
 * Schema for AI response when generating a change plan
 */
export const ChangePlanResponseSchema = z.object({
  canProceed: z.boolean().describe('Whether the AI can generate a valid plan'),
  reason: z.string().optional().describe('Reason if cannot proceed'),
  plan: ChangePlanSchema.optional().describe('The change plan if can proceed'),
});

export type ChangePlanResponse = z.infer<typeof ChangePlanResponseSchema>;

/**
 * Status of a change plan
 */
export type ChangePlanStatus = 
  | 'pending'      // Waiting for approval
  | 'approved'     // Approved via reaction
  | 'rejected'     // Rejected or timed out
  | 'executing'    // Currently being applied
  | 'completed'    // Successfully applied
  | 'failed';      // Failed to apply

/**
 * Stored change plan with metadata
 */
export interface StoredChangePlan {
  id: string;
  owner: string;
  repo: string;
  pullNumber: number;
  commentId: number;         // Comment where plan was posted
  triggeredBy: string;       // User who triggered the command
  command: string;           // Original command
  status: ChangePlanStatus;
  plan: ChangePlan;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  resultPrNumber?: number;   // PR number if plan was executed
  error?: string;            // Error message if failed
}

/**
 * Generate a unique plan ID
 */
export function generatePlanId(owner: string, repo: string, pullNumber: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `plan-${owner}-${repo}-${pullNumber}-${timestamp}-${random}`;
}

/**
 * Format a change plan for display in a GitHub comment
 */
export function formatChangePlanComment(plan: ChangePlan, isDryRun: boolean): string {
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
  };

  let comment = `## 🤖 AI Change Plan ${isDryRun ? '(Dry Run)' : ''}\n\n`;
  comment += `### ${plan.title}\n\n`;
  comment += `**Summary:** ${plan.summary}\n\n`;
  comment += `**Rationale:** ${plan.rationale}\n\n`;

  // Risk assessment
  comment += `### ⚠️ Risk Assessment\n\n`;
  comment += `**Overall Risk:** ${riskEmoji[plan.riskAssessment.overall]} ${plan.riskAssessment.overall.toUpperCase()}\n\n`;
  
  if (plan.riskAssessment.factors.length > 0) {
    comment += `**Risk Factors:**\n`;
    plan.riskAssessment.factors.forEach(factor => {
      comment += `- ${factor}\n`;
    });
    comment += '\n';
  }

  if (plan.riskAssessment.mitigations.length > 0) {
    comment += `**Mitigations:**\n`;
    plan.riskAssessment.mitigations.forEach(mitigation => {
      comment += `- ${mitigation}\n`;
    });
    comment += '\n';
  }

  // Files to be changed
  comment += `### 📁 Files to Change (${plan.totalFiles})\n\n`;
  comment += `| File | Action | Risk | Issues Addressed |\n`;
  comment += `|------|--------|------|------------------|\n`;
  
  for (const file of plan.files) {
    const actionEmoji = file.action === 'create' ? '➕' : file.action === 'delete' ? '➖' : '📝';
    const issues = file.issuesAddressed.slice(0, 2).join(', ');
    const moreIssues = file.issuesAddressed.length > 2 ? ` (+${file.issuesAddressed.length - 2} more)` : '';
    comment += `| \`${file.filePath}\` | ${actionEmoji} ${file.action} | ${riskEmoji[file.riskLevel]} | ${issues}${moreIssues} |\n`;
  }
  comment += '\n';

  // Show diffs for modified files (truncated)
  const modifiedFiles = plan.files.filter(f => f.action === 'modify' && f.diff);
  if (modifiedFiles.length > 0) {
    comment += `### 📝 Proposed Changes\n\n`;
    comment += `<details>\n<summary>Click to expand diffs</summary>\n\n`;
    
    for (const file of modifiedFiles.slice(0, 5)) { // Limit to 5 files
      comment += `#### \`${file.filePath}\`\n\n`;
      comment += `${file.description}\n\n`;
      if (file.diff) {
        // Truncate long diffs
        const diffLines = file.diff.split('\n');
        const truncatedDiff = diffLines.slice(0, 50).join('\n');
        const wasTruncated = diffLines.length > 50;
        comment += `\`\`\`diff\n${truncatedDiff}${wasTruncated ? '\n... (truncated)' : ''}\n\`\`\`\n\n`;
      }
    }
    
    if (modifiedFiles.length > 5) {
      comment += `\n*... and ${modifiedFiles.length - 5} more files*\n`;
    }
    
    comment += `</details>\n\n`;
  }

  // Stats
  comment += `### 📊 Stats\n\n`;
  comment += `- **Files affected:** ${plan.totalFiles}\n`;
  comment += `- **Estimated lines changed:** ~${plan.estimatedLinesChanged}\n`;
  comment += '\n';

  // Testing recommendations
  if (plan.testingRecommendations.length > 0) {
    comment += `### 🧪 Testing Recommendations\n\n`;
    plan.testingRecommendations.forEach(rec => {
      comment += `- ${rec}\n`;
    });
    comment += '\n';
  }

  // Rollback plan
  comment += `### ↩️ Rollback Plan\n\n`;
  comment += `${plan.rollbackPlan}\n\n`;

  // Approval instructions
  if (!isDryRun) {
    comment += `---\n\n`;
    comment += `### ✅ Approve this Plan\n\n`;
    comment += `To proceed with these changes:\n`;
    comment += `- React with 👍 to approve and create a PR\n`;
    comment += `- React with 👎 to reject this plan\n`;
    comment += `- Comment \`/ai-cancel\` to cancel\n\n`;
    comment += `*Plan will expire in 24 hours if no action is taken.*\n`;
  }

  comment += `\n---\n`;
  comment += `*Generated by AI Dev Agent • Plan ID: \`${plan.id}\`*`;

  return comment;
}

