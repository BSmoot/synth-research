/**
 * Cross-Pollinator Agent
 * Finds analogous problems and methods across research domains
 */

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  DomainAnalysis,
  DomainTag,
  CrossPollinationResult,
  CrossPollinationResultSchema,
  DOMAIN_METADATA,
  normalizeDomainsInObject,
  normalizeDomain,
  ConceptType,
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
  temperature: 0.9,
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

    // Use tool_use for guaranteed structured output
    const result = await this.callLLMWithSchema(
      systemPrompt,
      userPrompt,
      CrossPollinationResultSchema,
      'submit_cross_pollination',
      'Submit cross-domain connections with source/target concepts and similarity scores',
      { signal }
    );

    return result;
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
    let parsed = JSON.parse(json);

    // Normalize all domain fields before validation
    parsed = normalizeDomainsInObject(parsed, 'other');

    // Normalize connections with full concept structure
    if (parsed.connections) {
      parsed.connections = parsed.connections.map(
        (c: Record<string, unknown>, i: number) => ({
          ...c,
          id: c.id || `conn-${i + 1}`,
          sourceConcept: this.normalizeConcept(c.sourceConcept, 'other', 'theory'),
          targetConcept: this.normalizeConcept(c.targetConcept, 'other', 'theory'),
        })
      );
    }

    // Normalize summary.byTargetDomain keys
    if (parsed.summary?.byTargetDomain) {
      const normalized: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed.summary.byTargetDomain)) {
        const normalizedKey = normalizeDomain(key, 'other');
        normalized[normalizedKey] = (normalized[normalizedKey] || 0) + (value as number);
      }
      parsed.summary.byTargetDomain = normalized;
    }

    // Validate with Zod
    return CrossPollinationResultSchema.parse(parsed);
  }

  /**
   * Normalize a concept object to have all required fields
   */
  private normalizeConcept(
    concept: unknown,
    fallbackDomain: DomainTag,
    defaultType: ConceptType
  ): Record<string, unknown> {
    if (!concept || typeof concept !== 'object') {
      return {
        id: `concept-${randomUUID().slice(0, 8)}`,
        name: 'Unknown',
        domain: fallbackDomain,
        description: '',
        type: defaultType,
        relatedConcepts: [],
        sources: [],
      };
    }

    const obj = concept as Record<string, unknown>;
    return {
      id: obj.id || `concept-${randomUUID().slice(0, 8)}`,
      name: obj.name || obj.title || 'Unknown',
      domain: normalizeDomain(obj.domain, fallbackDomain),
      subDomain: obj.subdomain || obj.subDomain,
      description: obj.description || '',
      type: obj.type || defaultType,
      relatedConcepts: Array.isArray(obj.relatedConcepts) ? obj.relatedConcepts : [],
      sources: Array.isArray(obj.sources) ? obj.sources.map((s, i) => this.normalizeSource(s, i)) : [],
    };
  }

  /**
   * Normalize a source/citation object
   */
  private normalizeSource(source: unknown, index: number): Record<string, unknown> {
    if (typeof source === 'string') {
      return {
        id: `src-${index}`,
        type: 'llm-knowledge',
        title: source,
        relevance: 'Related',
        verified: false,
      };
    }
    if (source && typeof source === 'object') {
      const obj = source as Record<string, unknown>;
      return {
        id: obj.id || `src-${index}`,
        type: obj.type || 'llm-knowledge',
        title: obj.title || 'Unknown',
        relevance: obj.relevance || 'Related',
        verified: obj.verified ?? false,
      };
    }
    return {
      id: `src-${index}`,
      type: 'llm-knowledge',
      title: String(source),
      relevance: 'Related',
      verified: false,
    };
  }
}
