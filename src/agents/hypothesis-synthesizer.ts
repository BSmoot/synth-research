/**
 * Hypothesis Synthesizer Agent
 * Generates candidate research hypotheses from cross-domain connections
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  CrossDomainConnection,
  Hypothesis,
  HypothesisSchema,
} from '../types/index.js';
import { ContextSummary } from '../context/pipeline-context.js';
import { z } from 'zod';

export interface SynthesisRequest {
  connections: CrossDomainConnection[];
  context: ContextSummary;
  maxHypotheses?: number;
}

export interface SynthesisResult {
  hypotheses: Hypothesis[];
  metadata: {
    totalGenerated: number;
    connectionsCovered: number;
    averageConfidence: string;
  };
}

const SynthesisResultSchema = z.object({
  hypotheses: z.array(HypothesisSchema),
  metadata: z.object({
    totalGenerated: z.number(),
    connectionsCovered: z.number(),
    averageConfidence: z.string(),
  }),
});

const DEFAULT_CONFIG: AgentConfig = {
  name: 'hypothesis-synthesizer',
  model: 'claude-opus-4-20250514',
  maxTokens: 8192,
  temperature: 0.8,
};

export class HypothesisSynthesizerAgent extends BaseAgent<
  SynthesisRequest,
  SynthesisResult
> {
  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(input: SynthesisRequest, signal?: AbortSignal): Promise<SynthesisResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    const response = await this.callLLM(systemPrompt, userPrompt, { signal });
    return this.parseResponse(response);
  }

  protected buildSystemPrompt(): string {
    return `You are the Hypothesis Synthesizer, an expert at generating novel research hypotheses from cross-domain connections.

Transform each cross-domain connection into a structured, testable hypothesis.

HYPOTHESIS TEMPLATE:
"By applying [INSIGHT] from [SOURCE_DOMAIN] to [PROBLEM] in [TARGET_DOMAIN],
we hypothesize that [PREDICTION] because [MECHANISM]."

For each hypothesis, provide:
1. Title: Short descriptive title (10-15 words)
2. Statement: The actual hypothesis claim (1-3 sentences)
3. Components:
   - insight: What we're borrowing from source domain
   - application: Where we're applying it in target domain
   - mechanism: Why this transfer might work
   - prediction: What we'd expect to observe if true
4. Confidence: high, medium, or low
5. Citations: At least one supporting each domain
6. Suggested experiment (optional): How to test this

QUALITY GUIDELINES:
- Be SPECIFIC: Not "ML could help" but "attention mechanisms could model binding specificity"
- Be TESTABLE: Clear experimental approach exists
- Be NOVEL: Not already published or obvious
- Be GROUNDED: Based on genuine structural parallel
- Be IMPACTFUL: Would advance the field if true

AVOID:
- Too vague: "AI could revolutionize X"
- Too obvious: Combining two things already known to work together
- Untestable: No clear way to validate
- False analogy: Surface similarity without depth

Respond with ONLY valid JSON matching this structure:
{
  "hypotheses": [
    {
      "id": "hyp-001",
      "title": "...",
      "statement": "...",
      "sourceDomain": "ml-ai",
      "targetDomain": "computational-biology",
      "connection": {...},
      "components": {
        "insight": "...",
        "application": "...",
        "mechanism": "...",
        "prediction": "..."
      },
      "confidence": "high|medium|low",
      "citations": [...],
      "suggestedExperiment": {...},
      "generatedAt": "ISO date",
      "status": "raw"
    }
  ],
  "metadata": {
    "totalGenerated": 5,
    "connectionsCovered": 4,
    "averageConfidence": "medium"
  }
}`;
  }

  protected buildUserPrompt(input: SynthesisRequest): string {
    const maxHypotheses = input.maxHypotheses ?? 5;

    const connectionsText = input.connections
      .map(
        (c, i) => `
CONNECTION ${i + 1}:
  Source: ${c.sourceConcept.name} (${c.sourceConcept.domain})
  Target: ${c.targetConcept.name} (${c.targetConcept.domain})
  Type: ${c.connectionType}
  Similarity: ${c.similarityScore}/5
  Explanation: ${c.explanation}
  ${c.potentialApplication ? `Potential: ${c.potentialApplication}` : ''}`
      )
      .join('\n');

    return `Generate research hypotheses from the following cross-domain connections.

CONTEXT:
Query: ${input.context.query}
Domain: ${input.context.domain}
Key Concepts: ${input.context.topConcepts.join(', ')}

CROSS-DOMAIN CONNECTIONS:
${connectionsText}

Generate up to ${maxHypotheses} hypotheses.
Prioritize connections with higher similarity scores.
Generate at least 1 hypothesis for each connection with score >= 4.

Remember to output ONLY valid JSON.`;
  }

  protected parseResponse(response: string): SynthesisResult {
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Ensure required fields
    if (parsed.hypotheses) {
      parsed.hypotheses = parsed.hypotheses.map(
        (h: Record<string, unknown>, i: number) => ({
          ...h,
          id: h.id || `hyp-${String(i + 1).padStart(3, '0')}`,
          generatedAt: h.generatedAt || new Date().toISOString(),
          status: h.status || 'raw',
        })
      );
    }

    return SynthesisResultSchema.parse(parsed);
  }
}
