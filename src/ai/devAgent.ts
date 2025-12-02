import OpenAI from 'openai';
import { config } from '../config/env';
import { prompts } from './prompts';

export class DevAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async fixLints(
    fileName: string,
    fileContent: string,
    lintErrors: string
  ): Promise<string> {
    const prompt = prompts.fixLints(fileName, fileContent, lintErrors);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert developer. Fix linting errors while preserving functionality.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    return completion.choices[0].message.content || fileContent;
  }

  async generatePRDescription(
    files: string[],
    issuesFixed: string
  ): Promise<string> {
    const prompt = prompts.generateFixDescription(files, issuesFixed);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert developer. Write clear, professional PR descriptions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    return completion.choices[0].message.content || 'AI-generated fixes';
  }

  async analyzeCode(code: string, language: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert ${language} developer. Analyze the code for potential improvements.`,
        },
        {
          role: 'user',
          content: `Analyze this ${language} code and suggest improvements:\n\n${code}`,
        },
      ],
      temperature: 0.3,
    });

    return completion.choices[0].message.content || 'No suggestions';
  }
}

export const devAgent = new DevAgent();
