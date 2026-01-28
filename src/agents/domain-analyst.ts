/**
 * Domain Analyst Agent
 * Extracts concepts, methods, and open problems from a research domain
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  DomainAnalysis,
  DomainAnalysisSchema,
  DomainTag,
  DOMAIN_METADATA,
  normalizeDomain,
} from '../types/index.js';

export interface DomainAnalysisRequest {
  query: string;
  domain: DomainTag;
  depth?: 'shallow' | 'standard' | 'deep';
}

const DEFAULT_CONFIG: AgentConfig = {
  name: 'domain-analyst',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.8,
};

export class DomainAnalystAgent extends BaseAgent<
  DomainAnalysisRequest,
  DomainAnalysis
> {
  private currentInputDomain?: DomainTag;

  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(input: DomainAnalysisRequest, signal?: AbortSignal): Promise<DomainAnalysis> {
    this.currentInputDomain = input.domain;
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    // Use tool_use for guaranteed structured output
    const result = await this.callLLMWithSchema(
      systemPrompt,
      userPrompt,
      DomainAnalysisSchema,
      'submit_domain_analysis',
      'Submit structured domain analysis results with concepts, methods, and open problems',
      { signal }
    );

    return result;
  }

  protected buildSystemPrompt(): string {
    return `You are the Domain Analyst, an expert at extracting structured knowledge from research domains.

Your task is to analyze a research query and extract:
1. Core Concepts: Fundamental ideas, entities, and phenomena (5-15)
2. Methods: Techniques, algorithms, and approaches (3-10)
3. Open Problems: Unsolved challenges and research frontiers (3-8)
4. Key Insights: Important observations about the domain (3-5)
5. Research Frontiers: Active areas of investigation (2-4)

CRITICAL INSTRUCTIONS:
- CRITICAL: keyInsights and researchFrontiers MUST be arrays of plain strings, NOT objects
- CRITICAL: Every concept, method, and openProblem MUST include the 'domain' field
- CRITICAL: sources MUST be an array of Citation objects, NOT strings
- Be specific to the query, not a generic domain overview
- Include at least 3 open problems
- Do not fabricate paper citations - use "llm-knowledge" type if unsure
- Focus on concepts relevant to potential cross-domain synthesis

DOMAIN ENUM VALUES (use exactly as shown):
- "computational-biology"
- "materials-science"
- "ml-ai"
- "economics-finance"
- "social-systems"
- "physics-engineering"
- "climate-environment"
- "healthcare-medicine"
- "cognitive-science"
- "information-systems"
- "other"

CONCEPT TYPE ENUM VALUES:
- "method", "phenomenon", "problem", "tool", "theory", "metric"

CITATION TYPE ENUM VALUES:
- "paper", "preprint", "book", "website", "llm-knowledge"

EXACT JSON STRUCTURE:
{
  "domain": "ml-ai",
  "query": "the research query string",
  "concepts": [
    {
      "id": "c1",
      "name": "Concept Name",
      "domain": "ml-ai",
      "subDomain": "optional-subdomain",
      "description": "Detailed description",
      "type": "theory",
      "relatedConcepts": ["Concept 2", "Concept 3"],
      "sources": [
        {
          "id": "src1",
          "type": "llm-knowledge",
          "title": "Source title",
          "relevance": "Why relevant",
          "verified": false
        }
      ]
    }
  ],
  "methods": [],
  "openProblems": [],
  "keyInsights": ["Plain string insight 1", "Plain string insight 2"],
  "researchFrontiers": ["Plain string frontier 1"],
  "analyzedAt": "2025-01-16T12:00:00.000Z"
}

Respond with ONLY valid JSON matching the structure above.`;
  }

  protected buildUserPrompt(input: DomainAnalysisRequest): string {
    const metadata = DOMAIN_METADATA[input.domain];
    const depth = input.depth ?? 'standard';

    return `Analyze the following research query in the ${metadata.name} domain.

QUERY: ${input.query}

DOMAIN CONTEXT:
- Description: ${metadata.description}
- Sub-domains: ${metadata.subDomains.join(', ')}
- Key venues: ${metadata.keyJournals.join(', ')}

ANALYSIS DEPTH: ${depth}
${depth === 'deep' ? '- Extract more concepts and connections' : ''}
${depth === 'shallow' ? '- Focus on the most essential concepts only' : ''}

Extract concepts, methods, and open problems relevant to this query.
Remember to output ONLY valid JSON.`;
  }

  protected parseResponse(response: string): DomainAnalysis {
    // Step 1: Extract and parse JSON
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Step 2: Normalize top-level domain using shared normalizeDomain function
    const inputDomain = this.currentInputDomain ?? 'ml-ai';
    const normalizedDomain = normalizeDomain(parsed.domain, inputDomain);
    parsed.domain = normalizedDomain;

    // Step 3-5: Normalize concepts, methods, openProblems arrays with appropriate default types
    if (Array.isArray(parsed.concepts)) {
      parsed.concepts = parsed.concepts.map((item: unknown) =>
        this.normalizeConcept(item, normalizedDomain, 'theory')
      );
    }
    if (Array.isArray(parsed.methods)) {
      parsed.methods = parsed.methods.map((item: unknown) =>
        this.normalizeConcept(item, normalizedDomain, 'method')
      );
    }
    if (Array.isArray(parsed.openProblems)) {
      parsed.openProblems = parsed.openProblems.map((item: unknown) =>
        this.normalizeConcept(item, normalizedDomain, 'problem')
      );
    }

    // Step 6-7: Normalize keyInsights and researchFrontiers
    if (Array.isArray(parsed.keyInsights)) {
      parsed.keyInsights = this.flattenToStrings(parsed.keyInsights);
    }
    if (Array.isArray(parsed.researchFrontiers)) {
      parsed.researchFrontiers = this.flattenToStrings(parsed.researchFrontiers);
    }

    // Step 8: Ensure analyzedAt
    if (!parsed.analyzedAt) {
      parsed.analyzedAt = new Date().toISOString();
    }

    // Step 9: Validate with Zod
    return DomainAnalysisSchema.parse(parsed);
  }

  private normalizeConcept(
    item: unknown,
    fallbackDomain: DomainTag,
    defaultType: 'method' | 'phenomenon' | 'problem' | 'tool' | 'theory' | 'metric'
  ): unknown {
    if (!item || typeof item !== 'object') return item;
    const obj = item as Record<string, unknown>;

    // Inject/normalize domain using shared normalizeDomain function
    if (!obj.domain) {
      obj.domain = fallbackDomain;
    } else {
      obj.domain = normalizeDomain(obj.domain, fallbackDomain);
    }

    // Inject type if missing (critical for schema validation)
    if (!obj.type) {
      obj.type = defaultType;
    }

    // Map title → name if name is missing (openProblems often use 'title')
    if (!obj.name && obj.title) {
      obj.name = obj.title;
    }

    // Ensure relatedConcepts exists - map from applications/approaches if needed
    if (!obj.relatedConcepts) {
      if (Array.isArray(obj.applications)) {
        obj.relatedConcepts = obj.applications;
      } else if (Array.isArray(obj.approaches)) {
        obj.relatedConcepts = obj.approaches;
      } else {
        obj.relatedConcepts = [];
      }
    }

    // Normalize sources
    if (Array.isArray(obj.sources)) {
      obj.sources = obj.sources.map((src, idx) => this.normalizeSource(src, idx));
    } else {
      obj.sources = [];
    }

    return obj;
  }

  private normalizeSource(source: unknown, index: number): Record<string, unknown> {
    if (typeof source === 'string') {
      return {
        id: `src-${index}`,
        type: 'llm-knowledge',
        title: source,
        relevance: 'From LLM knowledge',
        verified: false,
      };
    }
    if (source && typeof source === 'object') {
      const obj = source as Record<string, unknown>;
      const result: Record<string, unknown> = {
        id: obj.id ?? `src-${index}`,
        type: obj.type ?? 'llm-knowledge',
        title: obj.title ?? 'Unknown source',
        relevance: obj.relevance ?? 'Unspecified',
        verified: obj.verified ?? false,
      };

      // Conditionally add optional fields
      if (obj.authors) result.authors = obj.authors;
      if (obj.year) result.year = obj.year;
      if (obj.venue) result.venue = obj.venue;
      if (obj.url) result.url = obj.url;
      if (obj.doi) result.doi = obj.doi;

      return result;
    }
    return {
      id: `src-${index}`,
      type: 'llm-knowledge',
      title: String(source),
      relevance: 'From LLM knowledge',
      verified: false,
    };
  }

  private flattenToStrings(items: unknown[]): string[] {
    return items.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const text = obj.text ?? obj.content ?? obj.description ??
                     obj.insight ?? obj.frontier ?? obj.name ?? obj.title;
        return typeof text === 'string' ? text : JSON.stringify(item);
      }
      return String(item);
    });
  }
}
