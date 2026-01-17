/**
 * Cross-Pollinator Agent
 * Finds analogous problems and methods across research domains
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  DomainAnalysis,
  DomainTag,
  CrossPollinationResult,
  CrossPollinationResultSchema,
  DOMAIN_METADATA,
} from '../types/index.js';

export interface PollinationRequest {
  sourceDomain: DomainAnalysis;
  targetDomains: DomainTag[];
  maxConnections?: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  name: 'cross-pollinator',
  model: 'claude-opus-4-20250514',
  maxTokens: 8192,
  temperature: 0.8,
};

export class CrossPollinatorAgent extends BaseAgent<
  PollinationRequest,
  CrossPollinationResult
> {
  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(input: PollinationRequest, signal?: AbortSignal): Promise<CrossPollinationResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    const response = await this.callLLM(systemPrompt, userPrompt, { signal });
    return this.parseResponse(response);
  }

  protected buildSystemPrompt(): string {
    return `You are the Cross-Pollinator, an expert at finding non-obvious connections between research domains.

Your task is to find analogous concepts between domains that could enable novel hypotheses.

CONNECTION TYPES:
- analogous-problem: Same problem appearing in different domain
- transferable-method: Method from one domain could solve problem in another
- shared-structure: Similar mathematical or conceptual structure
- complementary-tools: Tools that could combine productively
- causal-parallel: Similar causal mechanisms at play

SCORING (1-5):
5 = Deep structural parallel, high transfer potential
4 = Strong analogy with clear mechanism transfer
3 = Moderate parallel, transfer plausible with adaptation
2 = Surface similarity, transfer unclear
1 = Weak connection, likely false analogy

ONLY include connections with score >= 3.

For each connection, explain:
- WHY they are analogous (the structural parallel)
- HOW the connection could be used (transfer mechanism)
- WHAT hypothesis might result (potential application)

CRITICAL:
- Prioritize depth over breadth
- Avoid surface-level word matching
- Ensure transfer mechanism is plausible
- Flag low-confidence connections

Respond with ONLY valid JSON matching this structure:
{
  "sourceDomain": "domain-tag",
  "targetDomains": ["domain-tag"],
  "connections": [
    {
      "id": "conn-1",
      "sourceConcept": {...},
      "targetConcept": {...},
      "connectionType": "type",
      "similarityScore": 4,
      "explanation": "...",
      "confidence": "high|medium|low",
      "potentialApplication": "..."
    }
  ],
  "summary": {
    "totalConnections": 5,
    "byType": {...},
    "byTargetDomain": {...},
    "averageSimilarity": 3.8
  }
}`;
  }

  protected buildUserPrompt(input: PollinationRequest): string {
    const analysis = input.sourceDomain;
    const maxConnections = input.maxConnections ?? 10;

    const conceptsList = analysis.concepts
      .map((c) => `- ${c.name}: ${c.description} (${c.type})`)
      .join('\n');

    const methodsList = analysis.methods
      .map((m) => `- ${m.name}: ${m.description}`)
      .join('\n');

    const problemsList = analysis.openProblems
      .map((p) => `- ${p.name}: ${p.description}`)
      .join('\n');

    const targetDomainsInfo = input.targetDomains
      .map((d) => {
        const meta = DOMAIN_METADATA[d];
        return `- ${meta.name}: ${meta.description}
  Sub-domains: ${meta.subDomains.join(', ')}`;
      })
      .join('\n\n');

    return `Find cross-domain connections for the following analysis.

SOURCE DOMAIN: ${DOMAIN_METADATA[analysis.domain].name}
QUERY: ${analysis.query}

KEY CONCEPTS:
${conceptsList}

METHODS:
${methodsList}

OPEN PROBLEMS:
${problemsList}

KEY INSIGHTS:
${analysis.keyInsights.map((i) => `- ${i}`).join('\n')}

TARGET DOMAINS:
${targetDomainsInfo}

Find up to ${maxConnections} connections with similarity score >= 3.
Focus on connections that could lead to novel research hypotheses.
Remember to output ONLY valid JSON.`;
  }

  protected parseResponse(response: string): CrossPollinationResult {
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Ensure IDs are present
    if (parsed.connections) {
      parsed.connections = parsed.connections.map(
        (c: Record<string, unknown>, i: number) => ({
          ...c,
          id: c.id || `conn-${i + 1}`,
        })
      );
    }

    // Validate with Zod
    return CrossPollinationResultSchema.parse(parsed);
  }
}
