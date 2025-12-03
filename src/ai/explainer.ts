import { z } from 'zod';
import { callOpenAI, isOpenAIAvailable } from './providers/openai';
import { callClaude, isAnthropicAvailable } from './providers/anthropic';
import { logger } from '../utils/logging';
import { AI_DEFAULTS } from '../config/constants';

/**
 * Schema for code explanation response
 */
export const ExplanationResponseSchema = z.object({
  summary: z.string().describe('Brief one-sentence summary of what the code does'),
  explanation: z.string().describe('Detailed explanation of the code logic'),
  keyConcepts: z.array(z.object({
    term: z.string(),
    definition: z.string(),
  })).describe('Important concepts/patterns used in the code'),
  potentialIssues: z.array(z.string()).optional().describe('Any potential issues or concerns'),
  suggestions: z.array(z.string()).optional().describe('Suggestions for improvement'),
});

export type ExplanationResponse = z.infer<typeof ExplanationResponseSchema>;

/**
 * System prompt for code explanation
 */
const EXPLAINER_SYSTEM_PROMPT = `You are an expert software engineer who excels at explaining code clearly and concisely. Your role is to:

1. Explain what the code does in plain language
2. Identify key patterns, concepts, and design decisions
3. Point out any potential issues or concerns
4. Suggest improvements when appropriate

Guidelines:
- Assume the reader is a developer but may not be familiar with this specific codebase
- Use clear, jargon-free language when possible
- If using technical terms, briefly explain them
- Be concise but thorough
- Focus on the "why" not just the "what"

You must respond with valid JSON matching this schema:
{
  "summary": "One-sentence summary of what the code does",
  "explanation": "Detailed explanation of the code logic and flow",
  "keyConcepts": [
    {
      "term": "concept/pattern name",
      "definition": "brief explanation"
    }
  ],
  "potentialIssues": ["Any issues or concerns (optional)"],
  "suggestions": ["Improvement suggestions (optional)"]
}`;

const explainerLogger = logger.child({ module: 'ai-explainer' });

/**
 * Explain a code snippet
 */
export async function explainCode(
  code: string,
  context?: {
    filename?: string;
    language?: string;
    question?: string;
    surroundingCode?: string;
  }
): Promise<ExplanationResponse> {
  const { filename, language, question, surroundingCode } = context || {};

  let userPrompt = `Explain the following code:\n\n`;

  if (filename) {
    userPrompt += `**File:** \`${filename}\`\n`;
  }
  if (language) {
    userPrompt += `**Language:** ${language}\n`;
  }
  userPrompt += '\n';

  userPrompt += '```\n' + code + '\n```\n\n';

  if (surroundingCode) {
    userPrompt += `**Surrounding Context:**\n\`\`\`\n${surroundingCode}\n\`\`\`\n\n`;
  }

  if (question) {
    userPrompt += `**Specific Question:** ${question}\n\n`;
  }

  userPrompt += 'Provide a clear explanation in JSON format.';

  explainerLogger.info({
    codeLength: code.length,
    hasQuestion: !!question,
    filename,
  }, 'Generating code explanation');

  const startTime = Date.now();

  try {
    let content: string;
    let provider: string;

    if (isOpenAIAvailable()) {
      content = await callOpenAI(EXPLAINER_SYSTEM_PROMPT, userPrompt, {
        model: AI_DEFAULTS.REVIEW_MODEL,
        temperature: 0.3,
        maxTokens: 2000,
      });
      provider = 'openai';
    } else if (isAnthropicAvailable()) {
      content = await callClaude(EXPLAINER_SYSTEM_PROMPT, userPrompt, {
        temperature: 0.3,
        maxTokens: 2000,
      });
      provider = 'anthropic';
    } else {
      throw new Error('No AI provider available');
    }

    // Extract JSON from response
    const jsonContent = extractJSON(content);
    const parsed = JSON.parse(jsonContent);
    const validated = ExplanationResponseSchema.parse(parsed);

    const duration = Date.now() - startTime;
    explainerLogger.info({
      duration,
      provider,
      conceptsCount: validated.keyConcepts.length,
    }, 'Code explanation generated');

    return validated;

  } catch (error) {
    explainerLogger.error({ error }, 'Failed to generate code explanation');
    throw error;
  }
}

/**
 * Extract JSON from AI response
 */
function extractJSON(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  return content;
}

/**
 * Format explanation for GitHub comment
 */
export function formatExplanationComment(
  explanation: ExplanationResponse,
  originalQuestion?: string
): string {
  let comment = `## 🤖 AI Code Explanation\n\n`;

  if (originalQuestion) {
    comment += `> **Question:** ${originalQuestion}\n\n`;
  }

  comment += `### Summary\n\n${explanation.summary}\n\n`;

  comment += `### Detailed Explanation\n\n${explanation.explanation}\n\n`;

  if (explanation.keyConcepts.length > 0) {
    comment += `### Key Concepts\n\n`;
    for (const concept of explanation.keyConcepts) {
      comment += `- **${concept.term}:** ${concept.definition}\n`;
    }
    comment += '\n';
  }

  if (explanation.potentialIssues && explanation.potentialIssues.length > 0) {
    comment += `### ⚠️ Potential Issues\n\n`;
    for (const issue of explanation.potentialIssues) {
      comment += `- ${issue}\n`;
    }
    comment += '\n';
  }

  if (explanation.suggestions && explanation.suggestions.length > 0) {
    comment += `### 💡 Suggestions\n\n`;
    for (const suggestion of explanation.suggestions) {
      comment += `- ${suggestion}\n`;
    }
    comment += '\n';
  }

  comment += `---\n`;
  comment += `*Generated by AI • Ask follow-up questions by replying to this comment*`;

  return comment;
}

/**
 * Answer a follow-up question about previously explained code
 */
export async function answerFollowUp(
  originalCode: string,
  originalExplanation: ExplanationResponse,
  followUpQuestion: string,
  context?: {
    filename?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }
): Promise<string> {
  const { filename, conversationHistory } = context || {};

  let userPrompt = `You previously explained this code:\n\n`;
  
  if (filename) {
    userPrompt += `**File:** \`${filename}\`\n\n`;
  }

  userPrompt += '```\n' + originalCode + '\n```\n\n';

  userPrompt += `**Your previous explanation:**\n${originalExplanation.explanation}\n\n`;

  if (conversationHistory && conversationHistory.length > 0) {
    userPrompt += `**Previous Q&A:**\n`;
    for (const msg of conversationHistory.slice(-4)) { // Last 4 messages for context
      const prefix = msg.role === 'user' ? 'Q' : 'A';
      userPrompt += `${prefix}: ${msg.content}\n\n`;
    }
  }

  userPrompt += `**New question:** ${followUpQuestion}\n\n`;
  userPrompt += `Please answer this follow-up question concisely but thoroughly. `;
  userPrompt += `Respond in plain text (not JSON).`;

  explainerLogger.info({
    codeLength: originalCode.length,
    question: followUpQuestion.substring(0, 100),
    hasHistory: !!(conversationHistory && conversationHistory.length > 0),
  }, 'Answering follow-up question');

  try {
    let answer: string;

    if (isOpenAIAvailable()) {
      answer = await callOpenAI(
        'You are a helpful code expert answering follow-up questions about code. Be concise but thorough.',
        userPrompt,
        {
          model: AI_DEFAULTS.REVIEW_MODEL,
          temperature: 0.3,
          maxTokens: 1500,
        }
      );
    } else if (isAnthropicAvailable()) {
      answer = await callClaude(
        'You are a helpful code expert answering follow-up questions about code. Be concise but thorough.',
        userPrompt,
        {
          temperature: 0.3,
          maxTokens: 1500,
        }
      );
    } else {
      throw new Error('No AI provider available');
    }

    return answer;

  } catch (error) {
    explainerLogger.error({ error }, 'Failed to answer follow-up question');
    throw error;
  }
}

