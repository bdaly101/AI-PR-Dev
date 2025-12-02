import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a properly hoisted mock function
const mockCreate = vi.hoisted(() => vi.fn());

// Mock the OpenAI module
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Import after mocking
import { DevAgent } from '../../../src/ai/devAgent';

describe('ai/devAgent', () => {
  let devAgent: DevAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    devAgent = new DevAgent();
  });

  describe('fixLints', () => {
    it('should return fixed file content', async () => {
      const fixedContent = 'const x: number = 1;';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: fixedContent } }],
      });

      const result = await devAgent.fixLints(
        'test.ts',
        'const x = 1;',
        'Line 1: type annotation missing'
      );

      expect(result).toBe(fixedContent);
    });

    it('should return original content when AI returns null', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const originalContent = 'const x = 1;';
      const result = await devAgent.fixLints(
        'test.ts',
        originalContent,
        'some lint error'
      );

      expect(result).toBe(originalContent);
    });

    it('should use low temperature for deterministic output', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'fixed' } }],
      });

      await devAgent.fixLints('test.ts', 'code', 'error');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
        })
      );
    });

    it('should use GPT-4 model', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'fixed' } }],
      });

      await devAgent.fixLints('test.ts', 'code', 'error');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
        })
      );
    });

    it('should include file name in prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'fixed' } }],
      });

      await devAgent.fixLints('src/utils/helper.ts', 'code', 'error');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('src/utils/helper.ts');
    });

    it('should include lint errors in prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'fixed' } }],
      });

      await devAgent.fixLints('test.ts', 'code', 'Line 5: unused variable x');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('unused variable x');
    });
  });

  describe('generatePRDescription', () => {
    it('should return generated description', async () => {
      const description = '## Summary\nFixed linting errors';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: description } }],
      });

      const result = await devAgent.generatePRDescription(
        ['file1.ts', 'file2.ts'],
        '- Fixed unused imports'
      );

      expect(result).toBe(description);
    });

    it('should return fallback when AI returns null', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const result = await devAgent.generatePRDescription([], '');

      expect(result).toBe('AI-generated fixes');
    });

    it('should use moderate temperature', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'desc' } }],
      });

      await devAgent.generatePRDescription(['file.ts'], 'issues');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        })
      );
    });

    it('should include files in prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'desc' } }],
      });

      await devAgent.generatePRDescription(
        ['src/auth.ts', 'src/login.ts'],
        'issues'
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('src/auth.ts');
      expect(callArgs.messages[1].content).toContain('src/login.ts');
    });
  });

  describe('analyzeCode', () => {
    it('should return analysis', async () => {
      const analysis = 'The code could benefit from better error handling.';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: analysis } }],
      });

      const result = await devAgent.analyzeCode(
        'const x = 1;',
        'typescript'
      );

      expect(result).toBe(analysis);
    });

    it('should return fallback when AI returns null', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const result = await devAgent.analyzeCode('code', 'python');

      expect(result).toBe('No suggestions');
    });

    it('should use appropriate temperature', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'analysis' } }],
      });

      await devAgent.analyzeCode('code', 'javascript');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        })
      );
    });

    it('should include language in system prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'analysis' } }],
      });

      await devAgent.analyzeCode('code', 'rust');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('rust');
    });

    it('should include code in user prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'analysis' } }],
      });

      const code = 'function test() { return 42; }';
      await devAgent.analyzeCode(code, 'javascript');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain(code);
    });
  });
});
