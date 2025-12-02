import OpenAI from 'openai';
import { config } from '../config/env';
import { prompts } from './prompts';

export interface ReviewResult {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskJustification: string;
  inlineComments: Array<{
    file: string;
    line: number;
    comment: string;
  }>;
  generalComments: string[];
}

export interface FileReviewComment {
  line: number;
  comment: string;
}

export class AIReviewer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async reviewPullRequest(
    prTitle: string,
    prDescription: string,
    diff: string
  ): Promise<ReviewResult> {
    const prompt = prompts.reviewPR(prTitle, prDescription, diff);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. Provide thorough, constructive feedback.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0].message.content || '{}';
    const review = JSON.parse(responseContent) as ReviewResult;

    return review;
  }

  async reviewFile(
    fileName: string,
    fileContent: string,
    fileDiff: string
  ): Promise<FileReviewComment[]> {
    const prompt = prompts.reviewFile(fileName, fileContent, fileDiff);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. Focus on bugs, security issues, and best practices.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0].message.content || '[]';
    try {
      const comments = JSON.parse(responseContent);
      return Array.isArray(comments) ? comments : comments.comments || [];
    } catch {
      return [];
    }
  }
}

export const aiReviewer = new AIReviewer();
