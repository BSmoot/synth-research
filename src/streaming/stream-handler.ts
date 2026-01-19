/**
 * Streaming Response Handler
 *
 * ADR-008 Phase 3.2: Stream partial results for long operations.
 *
 * Features:
 * - AsyncGenerator for streaming events
 * - Stage lifecycle events (start, complete)
 * - Token-by-token streaming
 * - Error event handling
 */

import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import { UserQuery } from '../types/index.js';

export interface StreamEvent {
  type: 'token' | 'stage_start' | 'stage_complete' | 'hypothesis' | 'error';
  data: unknown;
  timestamp: string;
}

export class StreamingOrchestrator extends EventEmitter {
  private readonly client: Anthropic;

  constructor(client: Anthropic) {
    super();
    this.client = client;
  }

  async *runStreaming(query: UserQuery): AsyncGenerator<StreamEvent> {
    // Emit stage start
    yield this.event('stage_start', {
      stage: 'domain-analysis',
      message: 'Starting domain analysis...',
    });

    // Stream domain analysis
    const analysisStream = this.client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are the Domain Analyst. Analyze the research query and identify key concepts, methods, and open problems in the relevant domain.',
      messages: [{ role: 'user', content: query.text }],
    });

    try {
      for await (const event of analysisStream) {
        if (
          event.type === 'content_block_delta' &&
          'delta' in event &&
          event.delta.type === 'text_delta'
        ) {
          yield this.event('token', {
            stage: 'domain-analysis',
            text: event.delta.text,
          });
        }
      }
    } catch (error) {
      yield this.event('error', {
        stage: 'domain-analysis',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    yield this.event('stage_complete', { stage: 'domain-analysis' });
  }

  private event(type: StreamEvent['type'], data: unknown): StreamEvent {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
