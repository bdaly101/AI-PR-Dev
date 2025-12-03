import { z } from 'zod';
import { callOpenAI, isOpenAIAvailable } from './providers/openai';
import { callClaude, isAnthropicAvailable } from './providers/anthropic';
import { logger } from '../utils/logging';

/**
 * Schema for impact analysis result
 */
export const ImpactAnalysisSchema = z.object({
  summary: z.string().describe('One-paragraph summary of the overall impact'),
  affectedModules: z.array(z.object({
    name: z.string().describe('Module or component name'),
    impact: z.enum(['direct', 'indirect']).describe('Whether directly modified or indirectly affected'),
    description: z.string().describe('How this module is affected'),
  })).describe('List of affected modules/components'),
  dependencies: z.object({
    internal: z.array(z.string()).describe('Internal modules that depend on changed code'),
    external: z.array(z.string()).describe('External packages/APIs that interact with changes'),
  }),
  breakingChanges: z.array(z.object({
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    mitigation: z.string().optional(),
  })).describe('List of potential breaking changes'),
  testingRecommendations: z.array(z.object({
    area: z.string().describe('What to test'),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    reason: z.string().describe('Why this testing is important'),
  })).describe('Prioritized testing recommendations'),
  deploymentConsiderations: z.array(z.string()).describe('Things to consider when deploying'),
  rollbackStrategy: z.string().describe('How to rollback if issues are found'),
});

export type ImpactAnalysis = z.infer<typeof ImpactAnalysisSchema>;

/**
 * System prompt for impact analysis
 */
const IMPACT_ANALYSIS_SYSTEM_PROMPT = `You are an expert software architect analyzing the impact of code changes. Your job is to identify:

1. **Affected Modules**: Which parts of the codebase are directly modified and which are indirectly affected
2. **Dependencies**: What internal and external dependencies are involved
3. **Breaking Changes**: Any changes that could break existing functionality
4. **Testing Priorities**: What should be tested and in what priority order
5. **Deployment Considerations**: Special considerations for deploying these changes

You must respond with valid JSON matching this exact schema:

{
  "summary": "One paragraph summary of overall impact",
  "affectedModules": [
    {
      "name": "module name",
      "impact": "direct" | "indirect",
      "description": "how it's affected"
    }
  ],
  "dependencies": {
    "internal": ["list of internal modules that depend on changes"],
    "external": ["list of external packages/APIs involved"]
  },
  "breakingChanges": [
    {
      "description": "what might break",
      "severity": "low" | "medium" | "high",
      "mitigation": "how to mitigate (optional)"
    }
  ],
  "testingRecommendations": [
    {
      "area": "what to test",
      "priority": "critical" | "high" | "medium" | "low",
      "reason": "why this is important"
    }
  ],
  "deploymentConsiderations": ["list of deployment notes"],
  "rollbackStrategy": "how to rollback if needed"
}

Guidelines:
- Be thorough but concise
- Prioritize critical impacts over minor ones
- Consider both immediate and downstream effects
- Think about edge cases and error scenarios
- Provide actionable testing recommendations`;

/**
 * Analyze the impact of code changes
 */
export async function analyzeImpact(
  changedFiles: Array<{
    path: string;
    oldContent?: string;
    newContent: string;
    changeDescription: string;
  }>,
  context?: {
    projectDescription?: string;
    repoLanguages?: string[];
  }
): Promise<ImpactAnalysis | null> {
  const analysisLogger = logger.child({ module: 'impact-analysis' });

  // Build the prompt
  let prompt = `Analyze the impact of the following code changes:\n\n`;

  if (context?.projectDescription) {
    prompt += `**Project Context:** ${context.projectDescription}\n\n`;
  }

  if (context?.repoLanguages && context.repoLanguages.length > 0) {
    prompt += `**Languages:** ${context.repoLanguages.join(', ')}\n\n`;
  }

  prompt += `## Changed Files (${changedFiles.length})\n\n`;

  for (const file of changedFiles.slice(0, 10)) { // Limit to 10 files
    prompt += `### \`${file.path}\`\n`;
    prompt += `**Change:** ${file.changeDescription}\n\n`;

    if (file.newContent) {
      // Show a snippet of the new content (first 50 lines)
      const lines = file.newContent.split('\n').slice(0, 50);
      prompt += `\`\`\`\n${lines.join('\n')}\n`;
      if (file.newContent.split('\n').length > 50) {
        prompt += `... (truncated)\n`;
      }
      prompt += `\`\`\`\n\n`;
    }
  }

  if (changedFiles.length > 10) {
    prompt += `*... and ${changedFiles.length - 10} more files*\n\n`;
  }

  prompt += `\nProvide a comprehensive impact analysis in the specified JSON format.`;

  analysisLogger.info({
    filesCount: changedFiles.length,
  }, 'Generating impact analysis');

  try {
    let content: string;

    if (isOpenAIAvailable()) {
      content = await callOpenAI(IMPACT_ANALYSIS_SYSTEM_PROMPT, prompt, {
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
      });
    } else if (isAnthropicAvailable()) {
      content = await callClaude(IMPACT_ANALYSIS_SYSTEM_PROMPT, prompt, {
        temperature: 0.3,
      });
    } else {
      analysisLogger.warn('No AI provider available for impact analysis');
      return null;
    }

    // Parse and validate the response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const validated = ImpactAnalysisSchema.parse(parsed);

    analysisLogger.info({
      affectedModules: validated.affectedModules.length,
      breakingChanges: validated.breakingChanges.length,
      testingRecommendations: validated.testingRecommendations.length,
    }, 'Impact analysis completed');

    return validated;
  } catch (error) {
    analysisLogger.error({ error }, 'Failed to generate impact analysis');
    return null;
  }
}

/**
 * Format impact analysis for PR description
 */
export function formatImpactAnalysisForPR(analysis: ImpactAnalysis): string {
  let section = `## 📊 Impact Analysis\n\n`;
  section += `${analysis.summary}\n\n`;

  // Affected Modules
  if (analysis.affectedModules.length > 0) {
    section += `### 🎯 Affected Modules\n\n`;
    section += `| Module | Impact | Description |\n`;
    section += `|--------|--------|-------------|\n`;
    for (const mod of analysis.affectedModules) {
      const impactIcon = mod.impact === 'direct' ? '🔴' : '🟡';
      section += `| \`${mod.name}\` | ${impactIcon} ${mod.impact} | ${mod.description} |\n`;
    }
    section += '\n';
  }

  // Dependencies
  if (analysis.dependencies.internal.length > 0 || analysis.dependencies.external.length > 0) {
    section += `### 🔗 Dependencies\n\n`;
    if (analysis.dependencies.internal.length > 0) {
      section += `**Internal:** ${analysis.dependencies.internal.map(d => `\`${d}\``).join(', ')}\n\n`;
    }
    if (analysis.dependencies.external.length > 0) {
      section += `**External:** ${analysis.dependencies.external.map(d => `\`${d}\``).join(', ')}\n\n`;
    }
  }

  // Breaking Changes
  if (analysis.breakingChanges.length > 0) {
    section += `### ⚠️ Breaking Changes\n\n`;
    for (const bc of analysis.breakingChanges) {
      const severityIcon = bc.severity === 'high' ? '🔴' : bc.severity === 'medium' ? '🟡' : '🟢';
      section += `- ${severityIcon} **${bc.severity.toUpperCase()}:** ${bc.description}`;
      if (bc.mitigation) {
        section += ` → *Mitigation: ${bc.mitigation}*`;
      }
      section += '\n';
    }
    section += '\n';
  }

  // Testing Recommendations
  if (analysis.testingRecommendations.length > 0) {
    section += `### 🧪 Testing Recommendations\n\n`;
    const sorted = [...analysis.testingRecommendations].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    });
    for (const rec of sorted) {
      const priorityIcon = rec.priority === 'critical' ? '🔴' : 
                          rec.priority === 'high' ? '🟠' :
                          rec.priority === 'medium' ? '🟡' : '🟢';
      section += `- ${priorityIcon} **[${rec.priority.toUpperCase()}]** ${rec.area} - ${rec.reason}\n`;
    }
    section += '\n';
  }

  // Deployment Considerations
  if (analysis.deploymentConsiderations.length > 0) {
    section += `### 🚀 Deployment Considerations\n\n`;
    for (const consideration of analysis.deploymentConsiderations) {
      section += `- ${consideration}\n`;
    }
    section += '\n';
  }

  // Rollback Strategy
  section += `### ↩️ Rollback Strategy\n\n`;
  section += `${analysis.rollbackStrategy}\n`;

  return section;
}

/**
 * Generate a simple impact summary without AI (fallback)
 */
export function generateSimpleImpactSummary(
  changedFiles: Array<{ path: string; changeDescription: string }>
): string {
  let summary = `## 📊 Change Summary\n\n`;
  summary += `This PR modifies **${changedFiles.length} file(s)**:\n\n`;

  // Group files by directory
  const byDirectory: Record<string, string[]> = {};
  for (const file of changedFiles) {
    const parts = file.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    if (!byDirectory[dir]) {
      byDirectory[dir] = [];
    }
    byDirectory[dir].push(file.path);
  }

  for (const [dir, files] of Object.entries(byDirectory)) {
    summary += `**\`${dir}/\`**\n`;
    for (const file of files) {
      const fileName = file.split('/').pop();
      summary += `- \`${fileName}\`\n`;
    }
    summary += '\n';
  }

  summary += `### Testing Recommendations\n\n`;
  summary += `- Run the existing test suite\n`;
  summary += `- Manually verify the changed functionality\n`;
  summary += `- Check for any console errors or warnings\n`;

  return summary;
}

