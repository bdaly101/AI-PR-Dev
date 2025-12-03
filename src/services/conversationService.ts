import { GitHubClient } from '../github/client';
import { explainCode, formatExplanationComment, answerFollowUp, ExplanationResponse } from '../ai/explainer';
import { logger, logPRReview } from '../utils/logging';

/**
 * Conversation message for tracking context
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  commentId?: number;
}

/**
 * Active conversation context
 */
interface ConversationContext {
  prNumber: number;
  owner: string;
  repo: string;
  originalCode?: string;
  originalExplanation?: ExplanationResponse;
  filename?: string;
  messages: ConversationMessage[];
  createdAt: string;
  lastActivityAt: string;
}

/**
 * In-memory conversation store (could be moved to database later)
 * Key format: owner/repo/prNumber/threadId
 */
const conversationStore = new Map<string, ConversationContext>();

/**
 * TTL for conversations (2 hours)
 */
const CONVERSATION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Generate conversation key
 */
function getConversationKey(owner: string, repo: string, prNumber: number, threadId?: number): string {
  return `${owner}/${repo}/${prNumber}/${threadId || 'main'}`;
}

/**
 * Clean up expired conversations
 */
function cleanupExpiredConversations(): void {
  const now = Date.now();
  for (const [key, context] of conversationStore.entries()) {
    const lastActivity = new Date(context.lastActivityAt).getTime();
    if (now - lastActivity > CONVERSATION_TTL_MS) {
      conversationStore.delete(key);
      logger.debug({ key }, 'Cleaned up expired conversation');
    }
  }
}

/**
 * Service for handling conversational AI interactions
 */
class ConversationService {
  /**
   * Handle /ai-explain command
   */
  async handleExplainCommand(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number,
    username: string,
    commentId: number,
    options: {
      code?: string;
      filename?: string;
      startLine?: number;
      endLine?: number;
      question?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const prLogger = logPRReview(logger, owner, repo, pullNumber, {
      action: 'explain_code',
      username,
    });

    try {
      const client = new GitHubClient(installationId);

      // React to acknowledge
      try {
        await client.addReaction(owner, repo, commentId, 'eyes');
      } catch {
        // Non-critical
      }

      let codeToExplain = options.code;
      const filename = options.filename;

      // If no code provided but we have line numbers, fetch from PR
      if (!codeToExplain && options.startLine && options.endLine) {
        prLogger.info('Fetching code from PR diff');
        const pr = await client.getPullRequest(owner, repo, pullNumber);
        const files = await client.getPullRequestFiles(owner, repo, pullNumber);

        // Find the file if filename specified
        if (filename) {
          const file = files.find(f => f.filename === filename);
          if (file) {
            const content = await client.getFileContent(owner, repo, filename, pr.head.sha);
            if (content) {
              const lines = content.split('\n');
              codeToExplain = lines.slice(options.startLine - 1, options.endLine).join('\n');
            }
          }
        }
      }

      if (!codeToExplain) {
        await client.createIssueComment(
          owner,
          repo,
          pullNumber,
          `⚠️ No code provided to explain. Please use one of these formats:\n\n` +
          `\`\`\`\n/ai-explain\n\`\`\`\n` +
          `\`\`\`code to explain\n\`\`\`\n\n` +
          `Or as a review comment on specific lines of code.`
        );
        return { success: false, message: 'No code provided' };
      }

      prLogger.info({ codeLength: codeToExplain.length }, 'Generating explanation');

      // Generate explanation
      const explanation = await explainCode(codeToExplain, {
        filename,
        question: options.question,
      });

      // Store conversation context for follow-ups
      const key = getConversationKey(owner, repo, pullNumber, commentId);
      conversationStore.set(key, {
        prNumber: pullNumber,
        owner,
        repo,
        originalCode: codeToExplain,
        originalExplanation: explanation,
        filename,
        messages: [
          {
            role: 'user',
            content: options.question || 'Explain this code',
            timestamp: new Date().toISOString(),
            commentId,
          },
          {
            role: 'assistant',
            content: explanation.explanation,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      });

      // Format and post the explanation
      const formattedExplanation = formatExplanationComment(explanation, options.question);
      await client.createIssueComment(owner, repo, pullNumber, formattedExplanation);

      // Add success reaction
      try {
        await client.addReaction(owner, repo, commentId, 'rocket');
      } catch {
        // Non-critical
      }

      prLogger.info('Explanation posted successfully');
      return { success: true, message: 'Explanation posted' };

    } catch (error) {
      prLogger.error({ error }, 'Failed to explain code');
      
      const client = new GitHubClient(installationId);
      await client.createIssueComment(
        owner,
        repo,
        pullNumber,
        `❌ Failed to generate explanation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Handle inline question (reply to AI comment or @mention with question)
   */
  async handleInlineQuestion(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number,
    username: string,
    commentId: number,
    question: string,
    parentCommentId?: number
  ): Promise<{ success: boolean; message: string }> {
    const prLogger = logPRReview(logger, owner, repo, pullNumber, {
      action: 'inline_question',
      username,
    });

    try {
      const client = new GitHubClient(installationId);

      // React to acknowledge
      try {
        await client.addReaction(owner, repo, commentId, 'eyes');
      } catch {
        // Non-critical
      }

      // Try to find existing conversation context
      let context: ConversationContext | undefined;
      
      // Check for parent comment context
      if (parentCommentId) {
        const key = getConversationKey(owner, repo, pullNumber, parentCommentId);
        context = conversationStore.get(key);
      }

      // If no context, check main thread
      if (!context) {
        const mainKey = getConversationKey(owner, repo, pullNumber);
        context = conversationStore.get(mainKey);
      }

      let answer: string;

      if (context && context.originalCode && context.originalExplanation) {
        // We have context - use follow-up answering
        prLogger.info('Answering with conversation context');
        
        answer = await answerFollowUp(
          context.originalCode,
          context.originalExplanation,
          question,
          {
            filename: context.filename,
            conversationHistory: context.messages,
          }
        );

        // Update conversation context
        context.messages.push(
          { role: 'user', content: question, timestamp: new Date().toISOString(), commentId },
          { role: 'assistant', content: answer, timestamp: new Date().toISOString() }
        );
        context.lastActivityAt = new Date().toISOString();

      } else {
        // No context - just answer the question directly
        prLogger.info('Answering without context');
        
        const explanation = await explainCode(question, {
          question: 'Answer this question about the code in this PR',
        });
        answer = explanation.explanation;
      }

      // Post the answer
      const formattedAnswer = `## 🤖 AI Response\n\n` +
        `> ${question}\n\n` +
        `${answer}\n\n` +
        `---\n` +
        `*Ask more questions by replying to this comment*`;

      await client.createIssueComment(owner, repo, pullNumber, formattedAnswer);

      // Add success reaction
      try {
        await client.addReaction(owner, repo, commentId, 'rocket');
      } catch {
        // Non-critical
      }

      prLogger.info('Answer posted successfully');
      return { success: true, message: 'Answer posted' };

    } catch (error) {
      prLogger.error({ error }, 'Failed to answer question');
      
      const client = new GitHubClient(installationId);
      await client.createIssueComment(
        owner,
        repo,
        pullNumber,
        `❌ Failed to answer question: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if a comment is a follow-up question to an AI response
   */
  isFollowUpQuestion(commentBody: string): boolean {
    // Check for question indicators
    const questionIndicators = [
      /\?$/,                          // Ends with ?
      /^(what|why|how|when|where|who|can|could|would|should|is|are|does|do)\b/i, // Starts with question word
      /explain|clarify|elaborate/i,   // Explanation requests
    ];

    return questionIndicators.some(pattern => pattern.test(commentBody.trim()));
  }

  /**
   * Clean up old conversations
   */
  cleanup(): void {
    cleanupExpiredConversations();
  }

  /**
   * Get conversation context (for debugging/testing)
   */
  getContext(owner: string, repo: string, prNumber: number, threadId?: number): ConversationContext | undefined {
    const key = getConversationKey(owner, repo, prNumber, threadId);
    return conversationStore.get(key);
  }
}

export const conversationService = new ConversationService();

