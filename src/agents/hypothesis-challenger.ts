/**
 * Hypothesis Challenger Agent
 * Validates and scores hypotheses using the quality rubric
 * Supports parallel batch evaluation (ADR-006)
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  Hypothesis,
  ScoredHypothesis,
  ScoredHypothesisSchema,
  HypothesisScores,
  Verdict,
} from '../types/index.js';
import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface ParallelConfig {
  mode?: 'single' | 'batched' | 'individual';
  batchSize?: number;
  maxConcurrent?: number;
}

export interface ChallengeRequest {
  hypotheses: Hypothesis[];
  parallelConfig?: ParallelConfig;
}

export interface ChallengeResult {
  scoredHypotheses: ScoredHypothesis[];
  rejected: Array<{
    hypothesis: Hypothesis;
    scores: HypothesisScores;
    verdict: 'fail';
    rejectionReasons: string[];
  }>;
  summary: {
    totalChallenged: number;
    passed: number;
    borderline: number;
    failed: number;
    averageScore: number;
  };
}

interface BatchResult {
  scoredHypotheses: ScoredHypothesis[];
  rejected: ChallengeResult['rejected'];
}

interface BatchError {
  batchIndex: number;
  hypothesisIds: string[];
  error: Error;
}

// ============================================================================
// Schemas
// ============================================================================

const ChallengeResultSchema = z.object({
  scoredHypotheses: z.array(ScoredHypothesisSchema),
  rejected: z
    .array(
      z.object({
        hypothesis: z.any(),
        scores: z.any(),
        verdict: z.literal('fail'),
        rejectionReasons: z.array(z.string()),
      })
    )
    .transform((arr) =>
      arr.map((item) => ({
        hypothesis: item.hypothesis as Hypothesis,
        scores: item.scores as HypothesisScores,
        verdict: 'fail' as const,
        rejectionReasons: item.rejectionReasons,
      }))
    ),
  summary: z.object({
    totalChallenged: z.number(),
    passed: z.number(),
    borderline: z.number(),
    failed: z.number(),
    averageScore: z.number(),
  }),
});

// ============================================================================
// Agent
// ============================================================================

const DEFAULT_CONFIG: AgentConfig = {
  name: 'hypothesis-challenger',
  model: 'claude-opus-4-20250514',
  maxTokens: 8192,
  temperature: 0.5,
};

export class HypothesisChallengerAgent extends BaseAgent<
  ChallengeRequest,
  ChallengeResult
> {
  // Store current hypotheses for parseResponse to access
  private currentHypotheses: Hypothesis[] = [];

  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(input: ChallengeRequest, signal?: AbortSignal): Promise<ChallengeResult> {
    const config = this.getParallelConfig(
      input.hypotheses.length,
      input.parallelConfig
    );

    if (config.mode === 'single') {
      return this.evaluateSingle(input.hypotheses, signal);
    }

    return this.evaluateParallel(input.hypotheses, config, signal);
  }

  // ============================================================================
  // Parallel Evaluation Methods
  // ============================================================================

  private getParallelConfig(
    hypothesisCount: number,
    override?: ParallelConfig
  ): Required<ParallelConfig> {
    if (override?.mode) {
      return {
        mode: override.mode,
        batchSize: override.batchSize ?? 2,
        maxConcurrent: override.maxConcurrent ?? 3,
      };
    }

    if (hypothesisCount <= 3) {
      return { mode: 'single', batchSize: hypothesisCount, maxConcurrent: 1 };
    }
    return { mode: 'batched', batchSize: 2, maxConcurrent: 3 };
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async evaluateSingle(hypotheses: Hypothesis[], signal?: AbortSignal): Promise<ChallengeResult> {
    // Store hypotheses for parseResponse to access
    this.currentHypotheses = hypotheses;

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt({ hypotheses });

    // Use free-text JSON for complex schemas (tool_use times out with deeply nested schemas)
    const response = await this.callLLM(systemPrompt, userPrompt, { signal });
    return this.parseResponse(response);
  }

  private async evaluateBatch(hypotheses: Hypothesis[], signal?: AbortSignal): Promise<BatchResult> {
    const result = await this.evaluateSingle(hypotheses, signal);
    return {
      scoredHypotheses: result.scoredHypotheses,
      rejected: result.rejected,
    };
  }

  private async evaluateParallel(
    hypotheses: Hypothesis[],
    config: Required<ParallelConfig>,
    signal?: AbortSignal
  ): Promise<ChallengeResult> {
    const batches = this.createBatches(hypotheses, config.batchSize);
    const results: BatchResult[] = [];
    const errors: BatchError[] = [];

    await this.processWithConcurrency(
      batches.map((batch, index) => ({ batch, index })),
      config.maxConcurrent,
      async ({ batch, index }) => {
        try {
          const result = await this.evaluateBatch(batch, signal);
          results.push(result);
        } catch (error) {
          errors.push({
            batchIndex: index,
            hypothesisIds: batch.map((h) => h.id),
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    );

    // All batches failed
    if (errors.length > 0 && results.length === 0) {
      throw new AggregateError(
        errors.map((e) => e.error),
        `All ${errors.length} hypothesis evaluation batches failed`
      );
    }

    return this.mergeResults(results);
  }

  private mergeResults(batchResults: BatchResult[]): ChallengeResult {
    const allScored: ScoredHypothesis[] = [];
    const allRejected: ChallengeResult['rejected'] = [];

    for (const batch of batchResults) {
      allScored.push(...batch.scoredHypotheses);
      allRejected.push(...batch.rejected);
    }

    return {
      scoredHypotheses: allScored,
      rejected: allRejected,
      summary: this.calculateSummary(allScored, allRejected),
    };
  }

  private calculateSummary(
    scored: ScoredHypothesis[],
    rejected: ChallengeResult['rejected']
  ): ChallengeResult['summary'] {
    const total = scored.length + rejected.length;
    const passed = scored.filter((h) => h.verdict === 'pass').length;
    const borderline = scored.filter((h) => h.verdict === 'borderline').length;
    const failed =
      rejected.length + scored.filter((h) => h.verdict === 'fail').length;

    const allComposites = scored.map((h) => h.scores.composite);
    const averageScore =
      allComposites.length > 0
        ? allComposites.reduce((a, b) => a + b, 0) / allComposites.length
        : 0;

    return { totalChallenged: total, passed, borderline, failed, averageScore };
  }

  // ============================================================================
  // LLM Methods
  // ============================================================================

  protected buildSystemPrompt(): string {
    return `You are the Hypothesis Challenger, a rigorous evaluator of research hypotheses.
Your role is ADVERSARIAL - actively seek weaknesses and be skeptical but fair.

SCORING RUBRIC (each dimension 1-5):

SPECIFICITY (25%):
5 = Precise variables, conditions, measurable outcomes
4 = Clear variables, some conditions need clarification
3 = Variables identified, conditions unclear
2 = Vague claim, variables not well-defined
1 = Untestable or too abstract

NOVELTY (20%):
5 = No existing research found, genuinely novel
4 = Novel application, tangentially related work exists
3 = Related work exists but different angle
2 = Similar work exists, incremental only
1 = Already published or obvious

CONNECTION VALIDITY (25%):
5 = Deep structural parallel, same underlying principles
4 = Strong analogy with clear mechanism transfer
3 = Moderate parallel, mechanism transfer plausible
2 = Superficial similarity, transfer unclear
1 = False analogy, no genuine parallel

FEASIBILITY (15%):
5 = Standard lab, <$100K, <1 year
4 = Moderate resources, $100K-500K, 1-2 years
3 = Significant resources, $500K-1M, 2-5 years
2 = Major resources, >$1M or >5 years
1 = Currently untestable

GROUNDING (15%):
5 = 3+ verifiable sources
4 = 2 verifiable sources
3 = 1 verifiable source
2 = LLM knowledge only
1 = No sources, pure speculation

VERDICT RULES:
- Any dimension < 2 → FAIL (hard floor)
- Composite < 3.0 → FAIL
- Composite 3.0-3.5 → BORDERLINE
- Composite >= 3.5 → PASS

CHALLENGE QUESTIONS (apply to each):
1. "Is this actually testable?" - Demand concrete operationalization
2. "Has this been done?" - Search for prior work
3. "Is the analogy real?" - Look for false parallels
4. "Can this actually be tested?" - Consider practical barriers
5. "Is this grounded?" - Verify sources exist

Respond with ONLY valid JSON matching this structure:
{
  "scoredHypotheses": [...],
  "rejected": [...],
  "summary": {
    "totalChallenged": N,
    "passed": N,
    "borderline": N,
    "failed": N,
    "averageScore": N.N
  }
}`;
  }

  protected buildUserPrompt(input: { hypotheses: Hypothesis[] }): string {
    const hypothesesText = input.hypotheses
      .map(
        (h, i) => `
HYPOTHESIS ${i + 1} (${h.id}):
Title: ${h.title}
Statement: ${h.statement}

Source Domain: ${h.sourceDomain}
Target Domain: ${h.targetDomain}

Components:
- Insight: ${h.components.insight}
- Application: ${h.components.application}
- Mechanism: ${h.components.mechanism}
- Prediction: ${h.components.prediction}

Connection Type: ${h.connection.connectionType}
Connection Explanation: ${h.connection.explanation}

Citations: ${h.citations.map((c) => c.title).join('; ')}
`
      )
      .join('\n---\n');

    return `Evaluate and score the following ${input.hypotheses.length} hypotheses.

Apply the scoring rubric rigorously. Be skeptical but fair.
For each hypothesis, score all 5 dimensions and determine the verdict.

${hypothesesText}

Remember:
- Provide explanation for each score
- Calculate composite score correctly
- Apply hard floor rule (any dimension < 2 = fail)
- Include challenge notes for improvement

Output ONLY valid JSON.`;
  }

  protected parseResponse(response: string): ChallengeResult {
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);

    // Create lookup map for original hypotheses
    const hypothesisMap = new Map<string, Hypothesis>();
    for (const h of this.currentHypotheses) {
      hypothesisMap.set(h.id, h);
    }

    // Normalize scored hypotheses
    if (parsed.scoredHypotheses) {
      parsed.scoredHypotheses = parsed.scoredHypotheses.map(
        (scored: Record<string, unknown>) =>
          this.normalizeScoredHypothesis(scored, hypothesisMap)
      );
    }

    // Normalize rejected hypotheses
    if (parsed.rejected) {
      parsed.rejected = parsed.rejected.map(
        (rejected: Record<string, unknown>) =>
          this.normalizeRejectedHypothesis(rejected, hypothesisMap)
      );
    }

    return ChallengeResultSchema.parse(parsed);
  }

  // ============================================================================
  // Normalization Methods
  // ============================================================================

  private normalizeScoredHypothesis(
    scored: Record<string, unknown>,
    hypothesisMap: Map<string, Hypothesis>
  ): Record<string, unknown> {
    const id = scored.id as string;
    const original = hypothesisMap.get(id);

    if (!original) {
      // If we can't find the original, try to construct a minimal valid object
      return this.constructMinimalScoredHypothesis(scored);
    }

    // Merge original hypothesis data with scored data
    return {
      // All original hypothesis fields
      id: original.id,
      title: original.title,
      statement: original.statement,
      sourceDomain: original.sourceDomain,
      targetDomain: original.targetDomain,
      connection: original.connection,
      components: original.components,
      confidence: original.confidence,
      citations: original.citations,
      suggestedExperiment: original.suggestedExperiment,
      generatedAt:
        typeof original.generatedAt === 'string'
          ? original.generatedAt
          : (original.generatedAt as Date).toISOString(),
      status: 'challenged',

      // Scored fields (normalized)
      scores: this.normalizeScores(scored.scores, scored),
      verdict: this.normalizeVerdict(scored.verdict),
      challengeNotes: this.normalizeChallengeNotes(scored.challengeNotes),
    };
  }

  private normalizeRejectedHypothesis(
    rejected: Record<string, unknown>,
    hypothesisMap: Map<string, Hypothesis>
  ): Record<string, unknown> {
    const hypothesis = rejected.hypothesis as Record<string, unknown> | undefined;
    const id = hypothesis?.id as string | undefined;
    const original = id ? hypothesisMap.get(id) : undefined;

    return {
      hypothesis: original || hypothesis || { id: 'unknown' },
      scores: this.normalizeScores(rejected.scores, rejected),
      verdict: 'fail' as const,
      rejectionReasons: Array.isArray(rejected.rejectionReasons)
        ? rejected.rejectionReasons
        : [String(rejected.rejectionReasons || 'Rejected')],
    };
  }

  private constructMinimalScoredHypothesis(
    scored: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      id: scored.id || 'unknown',
      title: scored.title || 'Unknown Hypothesis',
      statement: scored.statement || '',
      sourceDomain: scored.sourceDomain || 'other',
      targetDomain: scored.targetDomain || 'other',
      connection: {
        id: 'conn-fallback',
        sourceConcept: this.createFallbackConcept('source'),
        targetConcept: this.createFallbackConcept('target'),
        connectionType: 'shared-structure',
        similarityScore: 3,
        explanation: 'Connection details not available',
        confidence: 'medium',
      },
      components: scored.components || {
        insight: '',
        application: '',
        mechanism: '',
        prediction: '',
      },
      confidence: scored.confidence || 'medium',
      citations: [],
      generatedAt: new Date().toISOString(),
      status: 'challenged',
      scores: this.normalizeScores(scored.scores, scored),
      verdict: this.normalizeVerdict(scored.verdict),
      challengeNotes: this.normalizeChallengeNotes(scored.challengeNotes),
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

  private normalizeScores(
    scores: unknown,
    scored: Record<string, unknown>
  ): HypothesisScores {
    const defaultWeights = {
      specificity: 0.25,
      novelty: 0.2,
      connectionValidity: 0.25,
      feasibility: 0.15,
      grounding: 0.15,
    };

    if (!scores || typeof scores !== 'object') {
      // If no scores object, return defaults
      return {
        specificity: { score: 3, weight: 0.25, explanation: 'Not evaluated' },
        novelty: { score: 3, weight: 0.2, explanation: 'Not evaluated' },
        connectionValidity: { score: 3, weight: 0.25, explanation: 'Not evaluated' },
        feasibility: { score: 3, weight: 0.15, explanation: 'Not evaluated' },
        grounding: { score: 3, weight: 0.15, explanation: 'Not evaluated' },
        composite: 3.0,
      };
    }

    const s = scores as Record<string, unknown>;

    // Normalize each dimension
    const specificity = this.normalizeDimensionScore(
      s.specificity,
      defaultWeights.specificity
    );
    const novelty = this.normalizeDimensionScore(
      s.novelty,
      defaultWeights.novelty
    );
    const connectionValidity = this.normalizeDimensionScore(
      s.connectionValidity,
      defaultWeights.connectionValidity
    );
    const feasibility = this.normalizeDimensionScore(
      s.feasibility,
      defaultWeights.feasibility
    );
    const grounding = this.normalizeDimensionScore(
      s.grounding,
      defaultWeights.grounding
    );

    // Get composite score from various possible locations
    let composite =
      typeof s.composite === 'number'
        ? s.composite
        : typeof scored.compositeScore === 'number'
          ? scored.compositeScore
          : this.calculateComposite({
              specificity,
              novelty,
              connectionValidity,
              feasibility,
              grounding,
            });

    return {
      specificity,
      novelty,
      connectionValidity,
      feasibility,
      grounding,
      composite,
    };
  }

  private normalizeDimensionScore(
    dim: unknown,
    defaultWeight: number
  ): { score: number; weight: number; explanation: string } {
    if (!dim || typeof dim !== 'object') {
      return {
        score: 3,
        weight: defaultWeight,
        explanation: 'Not evaluated',
      };
    }

    const d = dim as Record<string, unknown>;
    return {
      score: typeof d.score === 'number' ? d.score : 3,
      weight: typeof d.weight === 'number' ? d.weight : defaultWeight,
      explanation: typeof d.explanation === 'string' ? d.explanation : '',
    };
  }

  private calculateComposite(scores: {
    specificity: { score: number; weight: number };
    novelty: { score: number; weight: number };
    connectionValidity: { score: number; weight: number };
    feasibility: { score: number; weight: number };
    grounding: { score: number; weight: number };
  }): number {
    return (
      scores.specificity.score * scores.specificity.weight +
      scores.novelty.score * scores.novelty.weight +
      scores.connectionValidity.score * scores.connectionValidity.weight +
      scores.feasibility.score * scores.feasibility.weight +
      scores.grounding.score * scores.grounding.weight
    );
  }

  private normalizeVerdict(verdict: unknown): Verdict {
    if (typeof verdict === 'string') {
      const lower = verdict.toLowerCase();
      if (lower === 'pass') return 'pass';
      if (lower === 'borderline') return 'borderline';
      if (lower === 'fail') return 'fail';
    }
    return 'borderline';
  }

  private normalizeChallengeNotes(notes: unknown): string[] {
    if (Array.isArray(notes)) {
      return notes.map((n) => String(n));
    }
    if (typeof notes === 'string') {
      return [notes];
    }
    return [];
  }
}
