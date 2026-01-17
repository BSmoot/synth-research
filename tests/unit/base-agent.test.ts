/**
 * Unit tests for BaseAgent
 * Focus: processWithConcurrency concurrency control
 */

import { describe, it, expect, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from '../../src/agents/base-agent.js';

// Test implementation of BaseAgent to access protected methods
class TestableAgent extends BaseAgent<string, string> {
  async execute(input: string): Promise<string> {
    return input;
  }

  protected buildSystemPrompt(): string {
    return 'test system prompt';
  }

  protected buildUserPrompt(input: string): string {
    return `test user prompt: ${input}`;
  }

  protected parseResponse(response: string): string {
    return response;
  }

  // Expose processWithConcurrency for testing
  public async testProcessWithConcurrency<T, R>(
    items: T[],
    maxConcurrent: number,
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    return this.processWithConcurrency(items, maxConcurrent, processor);
  }
}

const createMockClient = () =>
  ({
    messages: {
      create: vi.fn(),
    },
  }) as unknown as Anthropic;

describe('BaseAgent - processWithConcurrency', () => {
  const mockConfig: AgentConfig = {
    name: 'test-agent',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
  };

  it('should process all items with concurrency limit', async () => {
    const agent = new TestableAgent(createMockClient(), mockConfig);
    const items = [1, 2, 3, 4, 5];
    const maxConcurrent = 2;
    const processedOrder: number[] = [];

    const processor = async (item: number): Promise<number> => {
      processedOrder.push(item);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return item * 2;
    };

    const results = await agent.testProcessWithConcurrency(
      items,
      maxConcurrent,
      processor
    );

    expect(results.length).toBe(5);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should maintain order of results', async () => {
    const agent = new TestableAgent(createMockClient(), mockConfig);
    const items = ['a', 'b', 'c', 'd'];
    const maxConcurrent = 2;

    const processor = async (item: string): Promise<string> => {
      const delay = item === 'a' ? 30 : item === 'b' ? 10 : 5;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return item.toUpperCase();
    };

    const results = await agent.testProcessWithConcurrency(
      items,
      maxConcurrent,
      processor
    );

    expect(results).toEqual(['A', 'B', 'C', 'D']);
  });

  it('should handle empty array', async () => {
    const agent = new TestableAgent(createMockClient(), mockConfig);
    const items: number[] = [];
    const processor = vi.fn(async (item: number) => item * 2);

    const results = await agent.testProcessWithConcurrency(items, 2, processor);

    expect(results).toEqual([]);
    expect(processor).not.toHaveBeenCalled();
  });

  it('should handle single item', async () => {
    const agent = new TestableAgent(createMockClient(), mockConfig);
    const items = [42];
    const processor = vi.fn(async (item: number) => item * 2);

    const results = await agent.testProcessWithConcurrency(items, 3, processor);

    expect(results).toEqual([84]);
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith(42);
  });

  it('should propagate processor errors', async () => {
    const agent = new TestableAgent(createMockClient(), mockConfig);
    const items = [1, 2, 3];
    const processor = async (item: number): Promise<number> => {
      if (item === 2) {
        throw new Error('Processing failed for item 2');
      }
      return item * 2;
    };

    await expect(
      agent.testProcessWithConcurrency(items, 2, processor)
    ).rejects.toThrow('Processing failed for item 2');
  });

  it('should respect maxConcurrent=1 (sequential processing)', async () => {
    const agent = new TestableAgent(createMockClient(), mockConfig);
    const items = [1, 2, 3, 4];
    let currentlyProcessing = 0;
    let maxSimultaneous = 0;

    const processor = async (item: number): Promise<number> => {
      currentlyProcessing++;
      maxSimultaneous = Math.max(maxSimultaneous, currentlyProcessing);
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentlyProcessing--;
      return item;
    };

    await agent.testProcessWithConcurrency(items, 1, processor);

    expect(maxSimultaneous).toBe(1);
  });
});
