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
  normalizeDomainsInObject,
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

    // Use free-text JSON for complex schemas (tool_use times out with deeply nested schemas)
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
7. Suggested research (optional): Pre-experiment literature/data gathering

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
      "suggestedExperiment": {
        "title": "...",
        "objective": "...",
        "methodology": "...",
        "expectedOutcome": "...",
        "requirements": {
          "dataSources": ["dataset1", "dataset2"],
          "expertise": ["ML", "Biology"],
          "infrastructure": ["GPU cluster"],
          "dependencies": ["existing tool"],
          "risks": ["data quality"]
        },
        "successCriteria": ["criterion1"]
      },
      "suggestedResearch": [
        {
          "type": "literature-review",
          "scope": "Review existing approaches to X",
          "questions": ["Q1", "Q2"],
          "sources": ["journal1", "database2"],
          "estimatedEffort": "moderate"
        }
      ],
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
    let parsed = JSON.parse(json);

    // Normalize all domain fields before validation
    parsed = normalizeDomainsInObject(parsed, 'other');

    // Deeply normalize hypotheses
    if (parsed.hypotheses) {
      parsed.hypotheses = parsed.hypotheses.map(
        (h: Record<string, unknown>, i: number) =>
          this.normalizeHypothesis(h, i)
      );
    }

    return SynthesisResultSchema.parse(parsed);
  }

  private normalizeHypothesis(
    h: Record<string, unknown>,
    index: number
  ): Record<string, unknown> {
    return {
      ...h,
      id: h.id || `hyp-${String(index + 1).padStart(3, '0')}`,
      generatedAt:
        typeof h.generatedAt === 'string'
          ? h.generatedAt
          : new Date().toISOString(),
      status: h.status || 'raw',
      connection: this.normalizeConnection(h.connection),
      citations: this.normalizeCitations(h.citations),
      suggestedExperiment: this.normalizeExperiment(h.suggestedExperiment),
      suggestedResearch: this.normalizeResearchSuggestions(h.suggestedResearch),
    };
  }

  private normalizeConnection(
    conn: unknown
  ): Record<string, unknown> {
    if (!conn || typeof conn !== 'object') {
      return {
        id: 'conn-fallback',
        sourceConcept: this.createFallbackConcept('source'),
        targetConcept: this.createFallbackConcept('target'),
        connectionType: 'shared-structure',
        similarityScore: 3,
        explanation: 'Connection details not provided',
        confidence: 'medium',
      };
    }

    const c = conn as Record<string, unknown>;
    return {
      id: c.id || 'conn-gen',
      sourceConcept: this.normalizeConcept(c.sourceConcept, 'source'),
      targetConcept: this.normalizeConcept(c.targetConcept, 'target'),
      connectionType: c.connectionType || 'shared-structure',
      similarityScore: c.similarityScore ?? 3,
      explanation: c.explanation || 'Connection explanation',
      confidence: c.confidence || 'medium',
      potentialApplication: c.potentialApplication,
    };
  }

  private normalizeConcept(
    concept: unknown,
    prefix: string
  ): Record<string, unknown> {
    if (!concept || typeof concept !== 'object') {
      return this.createFallbackConcept(prefix);
    }

    const c = concept as Record<string, unknown>;
    return {
      id: c.id || `${prefix}-concept`,
      name: c.name || c.title || 'Unknown',
      domain: c.domain || 'other',
      description: c.description || '',
      type: c.type || 'theory',
      relatedConcepts: Array.isArray(c.relatedConcepts)
        ? c.relatedConcepts
        : [],
      sources: Array.isArray(c.sources)
        ? c.sources.map((s, i) => this.normalizeSource(s, i))
        : [],
    };
  }

  private createFallbackConcept(prefix: string): Record<string, unknown> {
    return {
      id: `${prefix}-fallback`,
      name: 'Unknown',
      domain: 'other',
      description: 'Concept details not provided',
      type: 'theory',
      relatedConcepts: [],
      sources: [],
    };
  }

  private normalizeCitations(citations: unknown): Record<string, unknown>[] {
    if (!Array.isArray(citations)) return [];

    return citations.map((c, i) => {
      if (typeof c === 'string') {
        return {
          id: `cit-${i + 1}`,
          type: 'llm-knowledge',
          title: c,
          relevance: 'Related',
          verified: false,
        };
      }
      if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        return {
          id: obj.id || `cit-${i + 1}`,
          type: obj.type || 'llm-knowledge',
          title: obj.title || 'Unknown',
          relevance: obj.relevance || 'Related',
          verified: obj.verified ?? false,
          authors: obj.authors,
          year: obj.year,
          venue: obj.venue,
          url: obj.url,
          doi: obj.doi,
        };
      }
      return {
        id: `cit-${i + 1}`,
        type: 'llm-knowledge',
        title: String(c),
        relevance: 'Related',
        verified: false,
      };
    });
  }

  private normalizeExperiment(
    exp: unknown
  ): Record<string, unknown> | undefined {
    if (!exp || typeof exp !== 'object') return undefined;

    const e = exp as Record<string, unknown>;

    // Map LLM field names to schema field names
    // LLM returns: method, metrics, timeline, requirements
    // Schema expects: title, objective, methodology, expectedOutcome, resourceEstimate, successCriteria
    const title =
      e.title ||
      (typeof e.method === 'string' ? this.extractExperimentTitle(e.method) : 'Experiment');

    const methodology = e.methodology || e.method || 'TBD';

    const objective =
      e.objective ||
      (typeof e.requirements === 'string' ? e.requirements : 'Test hypothesis');

    const expectedOutcome =
      e.expectedOutcome ||
      (Array.isArray(e.metrics) ? `Measure: ${(e.metrics as string[]).join(', ')}` : 'TBD');

    const successCriteria = Array.isArray(e.successCriteria)
      ? e.successCriteria
      : Array.isArray(e.metrics)
        ? e.metrics
        : ['TBD'];

    return {
      title,
      objective,
      methodology,
      expectedOutcome,
      requirements: this.normalizeRequirements(e.requirements),
      successCriteria,
    };
  }

  private extractExperimentTitle(method: string): string {
    // Extract a short title from the method description
    // Take first clause or truncate at reasonable length
    const firstClause = method.split(',')[0].split('.')[0];
    if (firstClause.length <= 60) return firstClause;
    return firstClause.substring(0, 57) + '...';
  }

  private normalizeRequirements(req: unknown): Record<string, unknown> {
    if (req && typeof req === 'object') {
      const r = req as Record<string, unknown>;
      return {
        dataSources: Array.isArray(r.dataSources) ? r.dataSources : ['TBD'],
        expertise: Array.isArray(r.expertise) ? r.expertise : ['Research'],
        infrastructure: Array.isArray(r.infrastructure) ? r.infrastructure : ['TBD'],
        dependencies: Array.isArray(r.dependencies) ? r.dependencies : [],
        risks: Array.isArray(r.risks) ? r.risks : ['TBD'],
      };
    }
    return {
      dataSources: ['TBD'],
      expertise: ['Research'],
      infrastructure: ['TBD'],
      dependencies: [],
      risks: ['TBD'],
    };
  }

  private normalizeResearchSuggestion(suggestion: unknown): Record<string, unknown> | undefined {
    if (!suggestion || typeof suggestion !== 'object') return undefined;
    const s = suggestion as Record<string, unknown>;

    // Handle type field variations
    const typeValue = s.type || s.researchType || s.kind || s.category || 'literature-review';
    let type = this.normalizeResearchType(String(typeValue));

    // Handle scope
    const scope = typeof s.scope === 'string' ? s.scope : 'TBD';

    // Handle questions - convert string to array if needed
    let questions: string[] = [];
    if (Array.isArray(s.questions)) {
      questions = s.questions;
    } else if (typeof s.questions === 'string') {
      questions = s.questions.split(/[?;.]+/).map(q => q.trim()).filter(q => q.length > 0);
      if (questions.length > 0 && !questions[questions.length - 1].endsWith('?')) {
        questions = questions.map(q => q + '?');
      }
    }

    // Handle sources - convert string to array if needed
    let sources: string[] = [];
    if (Array.isArray(s.sources)) {
      sources = s.sources;
    } else if (typeof s.sources === 'string') {
      sources = s.sources.split(',').map(src => src.trim()).filter(src => src.length > 0);
    }

    // Handle estimatedEffort field variations
    const effortValue = s.estimatedEffort || s.effort || s.timeRequired || s.duration || 'moderate';

    return {
      type,
      scope,
      questions,
      sources,
      estimatedEffort: effortValue,
    };
  }

  private normalizeResearchType(type: string): string {
    const typeMap: Record<string, string> = {
      'lit review': 'literature-review',
      'literature review': 'literature-review',
      'data gathering': 'data-gathering',
      'data collection': 'data-gathering',
      'expert consultation': 'expert-consultation',
      'consult experts': 'expert-consultation',
      'preliminary modeling': 'preliminary-modeling',
      'initial modeling': 'preliminary-modeling',
    };
    const lower = type.toLowerCase();
    return typeMap[lower] || type;
  }

  private normalizeResearchSuggestions(suggestions: unknown): Record<string, unknown>[] | undefined {
    if (!suggestions) return undefined;

    if (!Array.isArray(suggestions)) {
      const normalized = this.normalizeResearchSuggestion(suggestions);
      return normalized ? [normalized] : undefined;
    }

    // Handle empty array - return empty array instead of undefined
    if (suggestions.length === 0) {
      return [];
    }

    const result = suggestions
      .map(s => this.normalizeResearchSuggestion(s))
      .filter((s): s is Record<string, unknown> => s !== undefined);

    return result.length > 0 ? result : [];
  }

  private normalizeSource(
    source: unknown,
    index: number
  ): Record<string, unknown> {
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
