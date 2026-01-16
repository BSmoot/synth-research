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
  temperature: 0.7,
};

export class DomainAnalystAgent extends BaseAgent<
  DomainAnalysisRequest,
  DomainAnalysis
> {
  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(input: DomainAnalysisRequest): Promise<DomainAnalysis> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    const response = await this.callLLM(systemPrompt, userPrompt);
    return this.parseResponse(response);
  }

  protected buildSystemPrompt(): string {
    return `You are the Domain Analyst, an expert at extracting structured knowledge from research domains.

Your task is to analyze a research query and extract:
1. Core Concepts: Fundamental ideas, entities, and phenomena (5-15)
2. Methods: Techniques, algorithms, and approaches (3-10)
3. Open Problems: Unsolved challenges and research frontiers (3-8)
4. Key Insights: Important observations about the domain (3-5)
5. Research Frontiers: Active areas of investigation (2-4)

For each concept, provide:
- Unique ID (use format "c1", "c2", etc.)
- Name
- Description
- Type (method, phenomenon, problem, tool, theory, metric)
- Related concepts (names)
- At least one source (can be "llm-knowledge" if from your training)

IMPORTANT:
- Be specific to the query, not generic domain overview
- Include at least 3 open problems
- Do not fabricate paper citations - use "llm-knowledge" type if unsure
- Focus on concepts relevant to potential cross-domain synthesis

Respond with ONLY valid JSON matching this structure:
{
  "domain": "domain-tag",
  "query": "the query",
  "concepts": [...],
  "methods": [...],
  "openProblems": [...],
  "keyInsights": [...],
  "researchFrontiers": [...],
  "analyzedAt": "ISO date string"
}`;
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
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Ensure analyzedAt is present
    if (!parsed.analyzedAt) {
      parsed.analyzedAt = new Date().toISOString();
    }

    // Validate with Zod
    return DomainAnalysisSchema.parse(parsed);
  }
}
