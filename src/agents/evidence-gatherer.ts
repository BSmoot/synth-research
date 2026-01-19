/**
 * Evidence Gatherer Agent
 *
 * ADR-008 Phase 3.3: Implement the Evidence Gatherer from ADR-007.
 *
 * Features:
 * - Find supporting evidence for research hypotheses
 * - Verify citations and assess evidence strength
 * - Default all new citations to verified: false
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import { ScoredHypothesis, Citation, CitationSchema } from '../types/index.js';
import { z } from 'zod';

// Evidence schema
export const EvidenceSchema = z.object({
  verifiedCitations: z.array(CitationSchema),
  newCitations: z.array(CitationSchema),
  evidenceStrength: z.enum(['strong', 'moderate', 'weak', 'none']),
  verificationSummary: z.string(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export interface EvidencedHypothesis extends ScoredHypothesis {
  evidence: Evidence;
}

export interface EvidenceRequest {
  hypotheses: ScoredHypothesis[];
  citationsPerHypothesis?: number;
}

export interface EvidenceResult {
  evidencedHypotheses: EvidencedHypothesis[];
  summary: {
    totalHypotheses: number;
    strong: number;
    moderate: number;
    weak: number;
    none: number;
  };
}

const DEFAULT_CONFIG: AgentConfig = {
  name: 'evidence-gatherer',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.3,
};

export class EvidenceGathererAgent extends BaseAgent<
  EvidenceRequest,
  EvidenceResult
> {
  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(
    input: EvidenceRequest,
    signal?: AbortSignal
  ): Promise<EvidenceResult> {
    const evidencedHypotheses: EvidencedHypothesis[] = [];

    for (const hypothesis of input.hypotheses) {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPromptForHypothesis(
        hypothesis,
        input.citationsPerHypothesis
      );

      const response = await this.callLLM(systemPrompt, userPrompt, {
        signal,
        enableCaching: true,
      });

      const evidence = this.parseEvidenceResponse(response);

      // Ensure all new citations have verified: false
      evidence.newCitations = evidence.newCitations.map((c) => ({
        ...c,
        verified: false,
      }));

      evidencedHypotheses.push({
        ...hypothesis,
        evidence,
      });
    }

    return {
      evidencedHypotheses,
      summary: this.calculateSummary(evidencedHypotheses),
    };
  }

  protected buildSystemPrompt(): string {
    return `You are the Evidence Gatherer for Synthesis Labs.

Your task is to find supporting evidence for research hypotheses.

CRITICAL RULES:
1. NEVER fabricate citations. If unsure, use type: "llm-knowledge" with verified: false
2. Only set verified: true if you are certain the paper/source exists
3. Include DOI or URL when available
4. Assess evidence strength honestly:
   - strong: 3+ verified citations directly supporting the hypothesis
   - moderate: 1-2 verified citations or strong indirect support
   - weak: Only llm-knowledge citations or tangential support
   - none: No relevant evidence found

Respond with JSON only:
{
  "verifiedCitations": [...],
  "newCitations": [...],
  "evidenceStrength": "strong|moderate|weak|none",
  "verificationSummary": "Brief explanation of evidence quality"
}`;
  }

  protected buildUserPrompt(_input: EvidenceRequest): string {
    // Not used directly - see buildUserPromptForHypothesis
    return '';
  }

  private buildUserPromptForHypothesis(
    hypothesis: ScoredHypothesis,
    citationsPerHypothesis?: number
  ): string {
    const numCitations = citationsPerHypothesis ?? 3;

    return `Find evidence for this hypothesis:

Title: ${hypothesis.title}
Statement: ${hypothesis.statement}
Source Domain: ${hypothesis.sourceDomain}
Target Domain: ${hypothesis.targetDomain}

Components:
- Insight: ${hypothesis.components.insight}
- Application: ${hypothesis.components.application}
- Mechanism: ${hypothesis.components.mechanism}
- Prediction: ${hypothesis.components.prediction}

Existing Citations:
${hypothesis.citations.map((c) => `- ${c.title} (${c.type}, verified: ${c.verified})`).join('\n')}

Find ${numCitations} additional citations that support this hypothesis.`;
  }

  protected parseResponse(_response: string): EvidenceResult {
    // This is called by the base class but we handle parsing differently
    throw new Error('Use execute() which handles parsing internally');
  }

  private parseEvidenceResponse(response: string): Evidence {
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Apply defaults for missing fields
    if (!parsed.verifiedCitations) parsed.verifiedCitations = [];
    if (!parsed.newCitations) parsed.newCitations = [];

    // Ensure all citations have required fields
    const normalizeCitation = (c: Partial<Citation>, idx: number): Citation => ({
      id: c.id || `cit-${idx}`,
      type: c.type || 'llm-knowledge',
      title: c.title || 'Unknown',
      authors: c.authors,
      year: c.year,
      venue: c.venue,
      url: c.url,
      doi: c.doi,
      relevance: c.relevance || 'Related',
      verified: c.verified ?? false,
    });

    parsed.verifiedCitations = parsed.verifiedCitations.map(normalizeCitation);
    parsed.newCitations = parsed.newCitations.map(normalizeCitation);

    return EvidenceSchema.parse(parsed);
  }

  private calculateSummary(
    hypotheses: EvidencedHypothesis[]
  ): EvidenceResult['summary'] {
    return {
      totalHypotheses: hypotheses.length,
      strong: hypotheses.filter((h) => h.evidence.evidenceStrength === 'strong')
        .length,
      moderate: hypotheses.filter(
        (h) => h.evidence.evidenceStrength === 'moderate'
      ).length,
      weak: hypotheses.filter((h) => h.evidence.evidenceStrength === 'weak')
        .length,
      none: hypotheses.filter((h) => h.evidence.evidenceStrength === 'none')
        .length,
    };
  }
}
