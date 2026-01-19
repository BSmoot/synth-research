/**
 * Unit tests for StreamingOrchestrator
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - StreamEvent structure
 * - Stage lifecycle events
 * - Token streaming
 * - Error handling
 * - EventEmitter integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  StreamingOrchestrator,
  StreamEvent,
} from '../../../src/streaming/stream-handler.js';
import Anthropic from '@anthropic-ai/sdk';
import { UserQuery } from '../../../src/types/index.js';

describe('StreamingOrchestrator', () => {
  let mockClient: { messages: { stream: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = {
      messages: {
        stream: vi.fn(),
      },
    };
  });

  describe('constructor', () => {
    it('should create instance extending EventEmitter', () => {
      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(EventEmitter);
    });
  });

  describe('StreamEvent structure', () => {
    it('should emit events with required fields', async () => {
      // Create a mock async iterator for the stream
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test research query for streaming' };
      const events: StreamEvent[] = [];

      for await (const event of orchestrator.runStreaming(query)) {
        events.push(event);
      }

      // Check that each event has required fields
      for (const event of events) {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');
      }
    });
  });

  describe('event types', () => {
    it('should emit stage_start event at beginning', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'x' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test streaming query' };
      const events: StreamEvent[] = [];

      for await (const event of orchestrator.runStreaming(query)) {
        events.push(event);
      }

      const stageStart = events.find((e) => e.type === 'stage_start');
      expect(stageStart).toBeDefined();
      expect(stageStart?.data).toHaveProperty('stage');
      expect(stageStart?.data).toHaveProperty('message');
    });

    it('should emit token events during stream', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Token1' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Token2' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test streaming query' };
      const events: StreamEvent[] = [];

      for await (const event of orchestrator.runStreaming(query)) {
        events.push(event);
      }

      const tokenEvents = events.filter((e) => e.type === 'token');
      expect(tokenEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should emit stage_complete event at end', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'done' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test streaming query' };
      const events: StreamEvent[] = [];

      for await (const event of orchestrator.runStreaming(query)) {
        events.push(event);
      }

      const stageComplete = events.find((e) => e.type === 'stage_complete');
      expect(stageComplete).toBeDefined();
      expect(stageComplete?.data).toHaveProperty('stage');
    });
  });

  describe('runStreaming()', () => {
    it('should be an async generator', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'x' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test streaming query' };
      const generator = orchestrator.runStreaming(query);

      expect(generator[Symbol.asyncIterator]).toBeDefined();
    });

    it('should call messages.stream with correct parameters', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'x' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Research about AI systems' };
      const events: StreamEvent[] = [];

      for await (const event of orchestrator.runStreaming(query)) {
        events.push(event);
      }

      expect(mockClient.messages.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          max_tokens: expect.any(Number),
          system: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Research about AI systems',
            }),
          ]),
        })
      );
    });
  });

  describe('timestamp format', () => {
    it('should include ISO 8601 timestamp in events', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'x' },
          };
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test streaming query' };
      const events: StreamEvent[] = [];

      for await (const event of orchestrator.runStreaming(query)) {
        events.push(event);
      }

      for (const event of events) {
        expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });

  describe('error handling', () => {
    it('should emit error event on stream failure', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'start' },
          };
          throw new Error('Stream interrupted');
        },
      };

      mockClient.messages.stream.mockReturnValue(mockStream);

      const orchestrator = new StreamingOrchestrator(
        mockClient as unknown as Anthropic
      );

      const query: UserQuery = { text: 'Test streaming query' };
      const events: StreamEvent[] = [];

      try {
        for await (const event of orchestrator.runStreaming(query)) {
          events.push(event);
        }
      } catch (e) {
        // Expected to throw
      }

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });
});
