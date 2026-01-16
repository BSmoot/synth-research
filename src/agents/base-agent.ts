/**
 * Base agent class for Synthesis Labs
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '../types/tokens.js';
import type { TraceEntry } from '../types/trace.js';

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
  abstract execute(input: TInput): Promise<TOutput>;

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
    }
  ): Promise<string> {
    const startTime = Date.now();

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature ?? 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

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
}
