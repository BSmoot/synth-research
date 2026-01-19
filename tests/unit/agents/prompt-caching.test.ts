/**
 * Unit tests for Prompt Caching in BaseAgent
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - Cache control headers added to system prompts
 * - Caching can be disabled via option
 * - Cache usage tracking in response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from '../../../src/agents/base-agent.js';

// Test implementation that exposes callLLM for testing
class TestableAgentForCaching extends BaseAgent<string, string> {
  async execute(input: string): Promise<string> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);
    return this.callLLM(systemPrompt, userPrompt, { enableCaching: true });
  }

  async executeWithoutCaching(input: string): Promise<string> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);
    return this.callLLM(systemPrompt, userPrompt, { enableCaching: false });
  }

  protected buildSystemPrompt(): string {
    return 'You are a test agent for prompt caching.';
  }

  protected buildUserPrompt(input: string): string {
    return `Process: ${input}`;
  }

  protected parseResponse(response: string): string {
    return response;
  }

  // Expose callLLM for direct testing
  public async testCallLLM(
    system: string,
    user: string,
    options?: { enableCaching?: boolean }
  ): Promise<string> {
    return this.callLLM(system, user, options);
  }
}

describe('Prompt Caching', () => {
  let mockClient: { messages: { create: ReturnType<typeof vi.fn> } };
  let agent: TestableAgentForCaching;
  const mockConfig: AgentConfig = {
    name: 'test-caching-agent',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
  };

  beforeEach(() => {
    mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'test response' }],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 80,
            cache_creation_input_tokens: 0,
          },
        }),
      },
    };
    agent = new TestableAgentForCaching(
      mockClient as unknown as Anthropic,
      mockConfig
    );
  });

  describe('callLLM with enableCaching option', () => {
    it('should add cache_control to system prompt when enableCaching is true', async () => {
      await agent.testCallLLM('Test system prompt', 'Test user prompt', {
        enableCaching: true,
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: 'Test system prompt',
              cache_control: { type: 'ephemeral' },
            }),
          ]),
        }),
        undefined
      );
    });

    it('should use plain string system prompt when enableCaching is false', async () => {
      await agent.testCallLLM('Test system prompt', 'Test user prompt', {
        enableCaching: false,
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Test system prompt',
        }),
        undefined
      );
    });

    it('should default to caching enabled when option not specified', async () => {
      await agent.testCallLLM('Test system prompt', 'Test user prompt');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.arrayContaining([
            expect.objectContaining({
              cache_control: { type: 'ephemeral' },
            }),
          ]),
        }),
        undefined
      );
    });
  });

  describe('cache performance tracking', () => {
    it('should handle response with cache hit metrics', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'cached response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 80,
          cache_creation_input_tokens: 0,
        },
      });

      const result = await agent.testCallLLM('system', 'user', {
        enableCaching: true,
      });

      expect(result).toBe('cached response');
    });

    it('should handle response with cache creation metrics', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'new response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 95,
        },
      });

      const result = await agent.testCallLLM('system', 'user', {
        enableCaching: true,
      });

      expect(result).toBe('new response');
    });

    it('should handle response without cache metrics', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'regular response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });

      const result = await agent.testCallLLM('system', 'user', {
        enableCaching: true,
      });

      expect(result).toBe('regular response');
    });
  });

  describe('execute methods with caching', () => {
    it('should use caching in normal execute', async () => {
      await agent.execute('test input');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.arrayContaining([
            expect.objectContaining({
              cache_control: { type: 'ephemeral' },
            }),
          ]),
        }),
        undefined
      );
    });

    it('should not use caching when explicitly disabled', async () => {
      await agent.executeWithoutCaching('test input');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a test agent for prompt caching.',
        }),
        undefined
      );
    });
  });
});
