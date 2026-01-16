/**
 * Base agent class for Synthesis Labs
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AgentConfig {
  name: string;
  model: 'claude-opus-4-20250514' | 'claude-sonnet-4-20250514';
  maxTokens: number;
  temperature?: number;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected readonly client: Anthropic;
  protected readonly config: AgentConfig;

  constructor(client: Anthropic, config: AgentConfig) {
    this.client = client;
    this.config = config;
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
    userPrompt: string
  ): Promise<string> {
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

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from LLM');
    }

    return textContent.text;
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
