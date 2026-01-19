/**
 * Base agent class for Synthesis Labs
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { TokenUsage } from '../types/tokens.js';
import type { TraceEntry } from '../types/trace.js';
import { TimeoutError } from '../types/errors.js';

export interface AgentConfig {
  name: string;
  model: 'claude-opus-4-20250514' | 'claude-sonnet-4-20250514';
  maxTokens: number;
  temperature?: number;
}

export interface TokenTracker {
  recordUsage(agent: string, model: string, usage: TokenUsage): void;
}

export interface TraceCollector {
  recordTrace(entry: TraceEntry): void;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected readonly client: Anthropic;
  protected readonly config: AgentConfig;
  protected tracker?: TokenTracker;
  protected traceCollector?: TraceCollector;

  constructor(client: Anthropic, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Set token tracker for this agent
   */
  setTracker(tracker: TokenTracker): void {
    this.tracker = tracker;
  }

  /**
   * Set trace collector for this agent
   */
  setTraceCollector(collector: TraceCollector): void {
    this.traceCollector = collector;
  }

  /**
   * Execute the agent with the given input
   */
  abstract execute(input: TInput, signal?: AbortSignal): Promise<TOutput>;

  /**
   * Build the system prompt for this agent
   */
  protected abstract buildSystemPrompt(): string;

  /**
   * Build the user prompt from the input
   */
  protected abstract buildUserPrompt(input: TInput): string;

  /**
   * Parse the LLM response into the output type
   */
  protected abstract parseResponse(response: string): TOutput;

  /**
   * Call the LLM and get a response
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      tracker?: TokenTracker;
      traceCollector?: TraceCollector;
      agentName?: string;
      signal?: AbortSignal;
      enableCaching?: boolean;
    }
  ): Promise<string> {
    const startTime = Date.now();

    // Use cache_control for system prompt if caching enabled (default: true)
    const systemContent =
      options?.enableCaching !== false
        ? [
            {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' as const },
            },
          ]
        : systemPrompt;

    let response;
    try {
      response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature ?? 0.7,
          system: systemContent,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        },
        options?.signal ? { signal: options.signal } : undefined
      );
    } catch (error) {
      // Handle abort errors by wrapping in TimeoutError
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          options?.agentName ?? this.config.name,
          0 // Timeout value not available here, caller should wrap
        );
      }
      throw error;
    }

    const durationMs = Date.now() - startTime;

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from LLM');
    }

    const rawOutput = textContent.text;

    // Capture token usage
    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    // Use provided trackers or fall back to instance trackers
    const tracker = options?.tracker ?? this.tracker;
    const traceCollector = options?.traceCollector ?? this.traceCollector;
    const agentName = options?.agentName ?? this.config.name;

    // Report to tracker
    if (tracker) {
      tracker.recordUsage(agentName, this.config.model, usage);
    }

    // Report to trace collector
    if (traceCollector) {
      traceCollector.recordTrace({
        stage: agentName,
        agent: agentName,
        model: this.config.model,
        timestamp: new Date().toISOString(),
        input: {
          system: systemPrompt,
          user: userPrompt,
        },
        output: {
          raw: rawOutput,
        },
        usage,
        durationMs,
      });
    }

    return rawOutput;
  }

  /**
   * Call the LLM with a Zod schema using tool_use for guaranteed structured output
   *
   * @param systemPrompt - System instructions for the LLM
   * @param userPrompt - User query/input
   * @param schema - Zod schema defining the expected output structure
   * @param toolName - Name for the tool (used in tool_use API)
   * @param toolDescription - Description of what the tool does
   * @param options - Additional options (signal, tracker, etc.)
   * @returns Parsed and validated output matching the schema
   */
  protected async callLLMWithSchema<T extends z.ZodType>(
    systemPrompt: string,
    userPrompt: string,
    schema: T,
    toolName: string,
    toolDescription: string,
    options?: {
      tracker?: TokenTracker;
      traceCollector?: TraceCollector;
      agentName?: string;
      signal?: AbortSignal;
      enableCaching?: boolean;
    }
  ): Promise<z.infer<T>> {
    const startTime = Date.now();

    // Convert Zod schema to JSON Schema for the tool definition
    const jsonSchema = zodToJsonSchema(schema, {
      $refStrategy: 'none',
      target: 'openApi3',
    });

    // Remove $schema and other metadata that Anthropic doesn't need
    const { $schema, ...inputSchema } = jsonSchema as Record<string, unknown>;

    // Build system content with optional caching
    const systemContent =
      options?.enableCaching !== false
        ? [
            {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' as const },
            },
          ]
        : systemPrompt;

    // Define the tool with the JSON Schema
    const tools: MessageCreateParamsNonStreaming['tools'] = [
      {
        name: toolName,
        description: toolDescription,
        input_schema: inputSchema as Anthropic.Tool['input_schema'],
      },
    ];

    let response;
    try {
      response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature ?? 0.7,
          system: systemContent,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          tools,
          tool_choice: { type: 'tool', name: toolName },
        },
        options?.signal ? { signal: options.signal } : undefined
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(
          options?.agentName ?? this.config.name,
          0
        );
      }
      throw error;
    }

    const durationMs = Date.now() - startTime;

    // Extract tool_use content from response
    const toolUseContent = response.content.find((c) => c.type === 'tool_use');
    if (!toolUseContent || toolUseContent.type !== 'tool_use') {
      throw new Error('No tool_use response from LLM - structured output failed');
    }

    const rawOutput = toolUseContent.input;

    // Capture token usage
    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    // Use provided trackers or fall back to instance trackers
    const tracker = options?.tracker ?? this.tracker;
    const traceCollector = options?.traceCollector ?? this.traceCollector;
    const agentName = options?.agentName ?? this.config.name;

    // Report to tracker
    if (tracker) {
      tracker.recordUsage(agentName, this.config.model, usage);
    }

    // Report to trace collector
    if (traceCollector) {
      traceCollector.recordTrace({
        stage: agentName,
        agent: agentName,
        model: this.config.model,
        timestamp: new Date().toISOString(),
        input: {
          system: systemPrompt,
          user: userPrompt,
        },
        output: {
          raw: JSON.stringify(rawOutput),
        },
        usage,
        durationMs,
      });
    }

    // Validate with Zod schema (should already match, but this provides type safety)
    return schema.parse(rawOutput);
  }

  /**
   * Extract JSON from a response that may contain markdown code blocks
   */
  protected extractJSON(response: string): string {
    // Try to find JSON in code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Try to find raw JSON
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return response.slice(jsonStart, jsonEnd + 1);
    }

    throw new Error('No JSON found in response');
  }

  /**
   * Process items with controlled concurrency
   * @param items - Items to process
   * @param maxConcurrent - Maximum concurrent processors
   * @param processor - Async function to process each item
   * @returns Results in original item order
   */
  protected async processWithConcurrency<T, R>(
    items: T[],
    maxConcurrent: number,
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    if (items.length === 0) return [];

    const results: R[] = new Array(items.length);
    const executing: Set<Promise<void>> = new Set();
    let firstError: Error | null = null;

    for (let i = 0; i < items.length; i++) {
      const index = i;
      const item = items[i];

      const promise = (async () => {
        try {
          results[index] = await processor(item);
        } catch (error) {
          if (!firstError) {
            firstError = error instanceof Error ? error : new Error(String(error));
          }
          throw error;
        }
      })();

      const tracked = promise.finally(() => executing.delete(tracked));
      executing.add(tracked);

      if (executing.size >= maxConcurrent) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);

    if (firstError) {
      throw firstError;
    }

    return results;
  }
}
