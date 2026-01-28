# ADR-010: Hypothesis Integration Enhancement

**Status**: Proposed
**Date**: 2026-01-19
**Tier**: 2 (Strategic - Cross-module, new pattern)

---

## Context

The Synthesis Labs pipeline currently generates and validates hypotheses independently. The 4-stage pipeline produces ranked hypotheses, but lacks the capability to synthesize related hypotheses into coherent research programs.

### Problem Statement

A recent session on alternative economic systems produced 5 valid hypotheses that could form a coherent theory stack:

| # | Hypothesis | Score | Core Method |
|---|-----------|-------|-------------|
| 1 | Value Pareto Frontiers | 3.80 | Multi-objective optimization |
| 2 | Economic Phylogenetics | 3.60 | Maximum likelihood attribution |
| 3 | Federated Economics | 3.40 | Privacy-preserving contribution scoring |
| 4 | Scale-Free Architecture | 3.20 | Fractal fairness at scale |
| 5 | Economic Mycorrhiza | 3.20 | Biomimetic resource flow |

These hypotheses share conceptual foundations and could be composed into a unified research program:

```
Pareto Frontiers (attribution measurement)
       ↓
Phylogenetic Tracing (value flow tracking)
       ↓
Federated Privacy (competitive coexistence)
       ↓
Scale-Free Architecture (scaling mechanism)
       ↓
Mycorrhizal Distribution (resource balancing)
```

But the system ranked them independently (by composite score) without recognizing their compositional potential.

### Architectural Gap Analysis

From codebase examination of `src/orchestrator/synthesis-orchestrator.ts` (lines 379-422) and `src/types/hypothesis.ts`:

| Gap | Current State | Impact |
|-----|--------------|--------|
| No inter-hypothesis composition | `buildOutput()` sorts by composite score only | Related hypotheses not combined into composite theories |
| No feedback loops | Hypotheses with `verdict: 'borderline'` are included but not refined | Promising hypotheses discarded without iteration |
| No connection clustering | `CrossDomainConnection` objects treated independently | Similar analogies not recognized as a pattern |
| No adversarial stress-testing | `HypothesisChallengerAgent` validates but doesn't attack | Weaknesses not systematically probed |
| No dependency mapping | `ScoredHypothesis` has no reference to other hypotheses | Execution order unclear for researchers |
| No gap detection | Output does not compare against original `UserQuery` | Uncovered query requirements invisible |

### Files Affected

**Primary Changes:**
- `src/types/integration.ts` - New file: `HypothesisCluster`, `IntegratedTheory`, `HypothesisDependency`, `QueryCoverage` schemas
- `src/types/errors.ts` - New `IntegrationError` class
- `src/types/index.ts` - Re-exports for new types
- `src/agents/hypothesis-integrator.ts` - New agent (500-600 lines)
- `src/orchestrator/synthesis-orchestrator.ts` - Stage 5 integration
- `src/context/pipeline-context.ts` - New state: `_clusters`, `_integratedTheories`, `_dependencies`, `_queryCoverage`

**Secondary Changes:**
- `src/cli.ts` - Output formatting for integrated theories
- `src/types/trace.ts` - Trace entries for integrator stage

**Tests:**
- `tests/unit/hypothesis-integrator.test.ts` - New test file
- `tests/integration/integration-pipeline.test.ts` - End-to-end tests

### Existing Contracts to Honor

From `src/types/hypothesis.ts` (lines 154-160):
```typescript
export const ScoredHypothesisSchema = HypothesisSchema.extend({
  scores: HypothesisScoresSchema,
  verdict: VerdictSchema,
  challengeNotes: z.array(z.string()),
});
```

The new stage must consume `ScoredHypothesis[]` and produce types that extend (not replace) the existing output structure.

---

## Decision Drivers

### Technical Drivers

1. **Type Safety**: New types must compose with existing Zod schemas without breaking validation
2. **Pipeline Consistency**: Integration stage follows hub-and-spoke pattern (ADR-002)
3. **Token Budget**: Integration analysis must fit within existing budget constraints
4. **Idempotency**: Running integrator multiple times should produce consistent clusters
5. **Backward Compatibility**: Existing output format must remain valid; integration is additive

### Experiential Drivers (Researcher Mental Model)

1. **Research Programs, Not Isolated Hypotheses**: Researchers think in terms of interconnected research agendas. Output should reflect this.
2. **Dependency-Aware Prioritization**: When hypotheses depend on each other, researchers need to know which to pursue first.
3. **Confidence Calibration**: Integrated theories should surface composition uncertainty (if H1 depends on H2, joint confidence cannot exceed min(H1, H2)).
4. **Actionability**: Clear next steps with explicit dependencies and investigation order.
5. **Transparency**: Researchers must understand WHY hypotheses were grouped and HOW integration logic works.

---

## Decision

Implement a **Hypothesis Integration Stage** (Stage 5) that performs four functions:

### 1. Cluster Related Hypotheses

Group hypotheses by shared characteristics:

```typescript
// New file: src/types/integration.ts

import { z } from 'zod';
import { randomUUID } from 'crypto';

export const ClusteringCriterionSchema = z.enum([
  'shared-source-domain',     // Same domain provided the insight
  'shared-target-domain',     // Same domain receives the application
  'shared-mechanism',         // Similar underlying mechanisms
  'complementary-predictions', // Predictions that test each other
  'prerequisite-chain',       // One enables testing another
]);

export type ClusteringCriterion = z.infer<typeof ClusteringCriterionSchema>;

export const HypothesisClusterSchema = z.object({
  id: z.string().uuid(),  // MUST use crypto.randomUUID()
  name: z.string(),
  hypothesisIds: z.array(z.string()),
  primaryCriterion: ClusteringCriterionSchema,
  secondaryCriteria: z.array(ClusteringCriterionSchema),
  cohesionScore: z.number().min(0).max(1), // 0=loose, 1=tight
  clusterRationale: z.string(), // Why these hypotheses belong together
});

export type HypothesisCluster = z.infer<typeof HypothesisClusterSchema>;
```

**Clustering Algorithm:**
- Extract features: source domain, target domain, mechanism keywords, prediction variables
- Compute pairwise similarity using connection type overlap and semantic similarity
- Apply agglomerative clustering with cohesion threshold >= 0.4
- Singleton hypotheses remain unclustered (valid output)

**Cohesion Score Calculation:**

The cohesion score (0-1) measures how tightly related the hypotheses in a cluster are:

```typescript
function calculateCohesionScore(hypotheses: ScoredHypothesis[]): number {
  if (hypotheses.length < 2) return 0;

  // Extract features for each hypothesis
  const features = hypotheses.map(h => ({
    sourceDomain: h.sourceDomain,
    targetDomain: h.targetDomain,
    mechanismKeywords: extractKeywords(h.components.mechanism),
    predictionVariables: extractVariables(h.components.prediction),
    connectionTypes: h.crossDomainConnections?.map(c => c.connectionType) ?? [],
  }));

  // Compute pairwise similarity matrix
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const sim = computePairwiseSimilarity(features[i], features[j]);
      totalSimilarity += sim;
      pairCount++;
    }
  }

  // Average pairwise similarity is the cohesion score
  return pairCount > 0 ? totalSimilarity / pairCount : 0;
}

function computePairwiseSimilarity(a: Features, b: Features): number {
  const weights = {
    domainMatch: 0.3,      // Same source/target domain
    mechanismOverlap: 0.3, // Shared mechanism keywords
    connectionTypeMatch: 0.2, // Same connection types
    predictionOverlap: 0.2,   // Shared prediction variables
  };

  let score = 0;

  // Domain matching (0 or 1 for each)
  if (a.sourceDomain === b.sourceDomain) score += weights.domainMatch / 2;
  if (a.targetDomain === b.targetDomain) score += weights.domainMatch / 2;

  // Mechanism keyword overlap (Jaccard similarity)
  score += weights.mechanismOverlap * jaccardSimilarity(a.mechanismKeywords, b.mechanismKeywords);

  // Connection type overlap
  score += weights.connectionTypeMatch * jaccardSimilarity(a.connectionTypes, b.connectionTypes);

  // Prediction variable overlap
  score += weights.predictionOverlap * jaccardSimilarity(a.predictionVariables, b.predictionVariables);

  return score;
}
```

**Cohesion Score Interpretation:**
| Range | Interpretation |
|-------|---------------|
| 0.0 - 0.3 | Loose cluster (weak connections) |
| 0.3 - 0.5 | Moderate cluster (some shared elements) |
| 0.5 - 0.7 | Tight cluster (strong methodological overlap) |
| 0.7 - 1.0 | Very tight cluster (near-identical framing) |

### 2. Compose Integrated Theories

Build composite theories from clusters:

```typescript
export const IntegratedTheorySchema = z.object({
  id: z.string().uuid(),  // MUST use crypto.randomUUID()
  name: z.string(),
  clusterId: z.string(),

  // Synthesis
  unifyingPrinciple: z.string(), // What ties these hypotheses together
  compositeStatement: z.string(), // Single statement capturing the whole

  // Components
  componentHypothesisIds: z.array(z.string()),
  componentSummaries: z.array(z.object({
    hypothesisId: z.string(),
    role: z.string(), // How this hypothesis contributes to the theory
  })),

  // Scoring (0-1 scale, NOT 1-5)
  compositeConfidence: z.number().min(0).max(1),
  confidenceRationale: z.string(),
  synergiesIdentified: z.array(z.string()), // How components strengthen each other
  tensionsIdentified: z.array(z.string()),  // Where components may conflict

  // Actionability
  suggestedInvestigationOrder: z.array(z.string()), // Hypothesis IDs in recommended order
  integrationRisks: z.array(z.string()), // Risks specific to pursuing as integrated program
});

export type IntegratedTheory = z.infer<typeof IntegratedTheorySchema>;
```

**Composition Logic:**
- For each cluster with >= 2 hypotheses, synthesize unifying principle
- Derive composite confidence as: `min(component scores / 5) * cohesionScore` (normalized to 0-1)
- Identify synergies (predictions that cross-validate) and tensions (contradictory assumptions)
- Order investigation by dependency chain + individual scores

### 3. Map Dependencies Between Hypotheses

Create explicit dependency graph:

```typescript
export const DependencyTypeSchema = z.enum([
  'methodological',  // H1's method requires H2's findings
  'evidential',      // H1's evidence would strengthen/weaken H2
  'theoretical',     // H1's mechanism assumes H2 is true
  'practical',       // Testing H1 requires resources from testing H2
]);

export type DependencyType = z.infer<typeof DependencyTypeSchema>;

export const HypothesisDependencySchema = z.object({
  fromHypothesisId: z.string(),
  toHypothesisId: z.string(),
  dependencyType: DependencyTypeSchema,
  strength: z.enum(['weak', 'moderate', 'strong']),
  explanation: z.string(),
  bidirectional: z.boolean(), // True if dependency goes both ways
});

export type HypothesisDependency = z.infer<typeof HypothesisDependencySchema>;
```

**Dependency Detection:**
- Parse hypothesis components for references to concepts in other hypotheses
- Check if predictions of H1 are required inputs for H2
- Identify shared experimental requirements
- Build directed acyclic graph (DAG) with cycle detection (cycles become bidirectional edges)

### 4. Detect Query Coverage Gaps

Analyze how well hypotheses address the original query:

```typescript
export const QueryRequirementSchema = z.object({
  id: z.string(),
  description: z.string(),
  extractedFrom: z.string(), // Which part of the query this came from
});

export type QueryRequirement = z.infer<typeof QueryRequirementSchema>;

export const QueryCoverageSchema = z.object({
  originalQuery: z.string(),
  extractedRequirements: z.array(QueryRequirementSchema),

  coverageMap: z.array(z.object({
    requirementId: z.string(),
    coveredByHypothesisIds: z.array(z.string()),
    coverageStrength: z.enum(['full', 'partial', 'tangential', 'none']),
    coverageExplanation: z.string(),
  })),

  gaps: z.array(z.object({
    requirementId: z.string(),
    gapDescription: z.string(),
    suggestedApproaches: z.array(z.string()), // How to address the gap
  })),

  overallCoverageScore: z.number().min(0).max(1),
});

export type QueryCoverage = z.infer<typeof QueryCoverageSchema>;
```

**Coverage Analysis:**
- Parse original query into distinct requirements (LLM extraction)
- Map each hypothesis to requirements it addresses
- Identify requirements with no coverage (gaps)
- Suggest approaches for gaps (additional domains to explore, alternative framings)

---

## Integration with Existing Pipeline

### Pipeline Modification

Update `src/orchestrator/synthesis-orchestrator.ts`:

```typescript
// After Stage 4, add Stage 5
async run(query: UserQuery): Promise<SynthesisOutput> {
  // ... Stages 1-4 unchanged ...

  // Stage 5: Hypothesis Integration (new)
  this.checkBudget(context);
  await this.runHypothesisIntegration(context);

  // Write traces if enabled
  if (this.config.traceEnabled) {
    await this.writeTraces(context);
  }

  // Build output (modified to include integration results)
  return this.buildOutput(context);
}

private async runHypothesisIntegration(context: PipelineContext): Promise<void> {
  const startTime = Date.now();
  context.log('Stage 5: Hypothesis Integration');
  this.reportProgress('hypothesis-integration', 'Clustering and integrating hypotheses...');

  // Get passing and borderline hypotheses
  const eligibleHypotheses = context.scoredHypotheses.filter(
    h => h.verdict === 'pass' || h.verdict === 'borderline'
  );

  // Skip if fewer than 2 hypotheses (nothing to integrate)
  if (eligibleHypotheses.length < 2) {
    context.addWarning('Insufficient hypotheses for integration (need >= 2)');
    context.addStage({
      stage: 'hypothesis-integration',
      status: 'partial',
      durationMs: Date.now() - startTime,
      message: 'Skipped - fewer than 2 passing hypotheses',
    });
    return;
  }

  // Run for coverage analysis only if exactly 1 hypothesis
  if (eligibleHypotheses.length === 1) {
    context.addWarning('Single hypothesis - running coverage analysis only');
    // Run limited integration for coverage only
  }

  try {
    const result = await this.withRetry(
      (signal) =>
        this.hypothesisIntegrator.execute({
          hypotheses: eligibleHypotheses,
          originalQuery: context.query.text,
          domain: context.domain,
        }, signal),
      this.config.maxRetries,
      'hypothesis-integrator'
    );

    context.setClusters(result.clusters);
    context.setIntegratedTheories(result.integratedTheories);
    context.setDependencies(result.dependencies);
    context.setQueryCoverage(result.queryCoverage);

    context.addStage({
      stage: 'hypothesis-integration',
      status: 'success',
      durationMs: Date.now() - startTime,
      message: `Found ${result.clusters.length} clusters, ${result.integratedTheories.length} theories, ${result.queryCoverage.gaps.length} gaps`,
    });

    context.log(
      `  ${result.clusters.length} clusters, ${result.integratedTheories.length} integrated theories`
    );
  } catch (error) {
    context.addStage({
      stage: 'hypothesis-integration',
      status: 'error',
      durationMs: Date.now() - startTime,
      message: String(error),
    });
    // Integration failure is NON-FATAL - log warning and continue
    context.addWarning(`Integration stage failed: ${error}. Output will include ranked hypotheses without integration.`);
  }
}
```

### Output Schema Extension

Extend `SynthesisOutputSchema` in `src/types/index.ts`:

```typescript
export const SynthesisOutputSchema = z.object({
  traceId: z.string(),
  query: z.string(),
  domain: DomainTagSchema,

  hypotheses: z.array(RankedHypothesisSchema),

  // NEW: Integration results (optional for backward compatibility)
  integration: z.object({
    clusters: z.array(HypothesisClusterSchema),
    integratedTheories: z.array(IntegratedTheorySchema),
    dependencies: z.array(HypothesisDependencySchema),
    queryCoverage: QueryCoverageSchema,
  }).optional(),

  metadata: z.object({...}),
  warnings: z.array(z.string()),
});
```

### Error Type

Add to `src/types/errors.ts`:

```typescript
export const IntegrationErrorTypeSchema = z.enum([
  'CLUSTERING_FAILED',        // is_retryable: true (LLM timeout or transient failure)
  'SYNTHESIS_FAILED',         // is_retryable: true (theory composition failed)
  'DEPENDENCY_MAPPING_FAILED', // is_retryable: true (dependency detection failed)
  'COVERAGE_ANALYSIS_FAILED', // is_retryable: true (query coverage failed)
  'INVALID_HYPOTHESIS_INPUT', // is_retryable: false (malformed input)
  'INSUFFICIENT_HYPOTHESES',  // is_retryable: false (< 2 hypotheses provided)
  'INVALID_HYPOTHESIS_REFERENCE', // is_retryable: false (LLM referenced unknown hypothesis)
]);

export type IntegrationErrorType = z.infer<typeof IntegrationErrorTypeSchema>;

const RETRYABLE_ERRORS: Set<IntegrationErrorType> = new Set([
  'CLUSTERING_FAILED',
  'SYNTHESIS_FAILED',
  'DEPENDENCY_MAPPING_FAILED',
  'COVERAGE_ANALYSIS_FAILED',
]);

export class IntegrationError extends Error {
  readonly phase: 'clustering' | 'synthesis' | 'dependency' | 'coverage';
  readonly errorType: IntegrationErrorType;
  readonly isRetryable: boolean;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    phase: IntegrationError['phase'],
    errorType: IntegrationErrorType,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'IntegrationError';
    this.phase = phase;
    this.errorType = errorType;
    this.isRetryable = RETRYABLE_ERRORS.has(errorType);
    this.context = context;
  }
}
```

**Error Type Usage:**
| Error Type | Phase | Retryable | When Thrown |
|-----------|-------|-----------|-------------|
| `CLUSTERING_FAILED` | clustering | Yes | LLM fails to produce valid cluster structure |
| `SYNTHESIS_FAILED` | synthesis | Yes | Theory composition times out or fails |
| `DEPENDENCY_MAPPING_FAILED` | dependency | Yes | Dependency graph construction fails |
| `COVERAGE_ANALYSIS_FAILED` | coverage | Yes | Query requirement extraction fails |
| `INVALID_HYPOTHESIS_INPUT` | clustering | No | Input hypotheses fail schema validation |
| `INSUFFICIENT_HYPOTHESES` | clustering | No | Fewer than 2 hypotheses provided |
| `INVALID_HYPOTHESIS_REFERENCE` | clustering | No | LLM output references non-existent hypothesis ID |

### Agent Configuration

```typescript
// src/agents/hypothesis-integrator.ts

const DEFAULT_CONFIG: AgentConfig = {
  name: 'hypothesis-integrator',
  model: 'claude-opus-4-20250514', // Opus for synthesis quality
  maxTokens: 8192,
  temperature: 0.6, // Between challenger (0.5) and synthesizer (0.8)
};
```

---

## Structured Output Approach

**CRITICAL**: The Hypothesis Integrator will use **free-text JSON output** (not tool_use) due to the complex nested schema structure.

This follows the established pattern from `hypothesis-synthesizer.ts` and `hypothesis-challenger.ts`:

```typescript
// From hypothesis-synthesizer.ts:60
// Use free-text JSON for complex schemas (tool_use times out with deeply nested schemas)
const response = await this.callLLM(systemPrompt, userPrompt, { signal });
return this.parseResponse(response);
```

**Rationale:**
- The integration output contains deeply nested arrays: `clusters[].hypothesisIds[]`, `integratedTheories[].componentSummaries[]`, `queryCoverage.coverageMap[]`, etc.
- Anthropic's `tool_use` feature times out with deeply nested JSON schemas
- Free-text JSON with `extractJSON()` + Zod validation is the proven pattern for complex output

**Implementation:**

```typescript
export class HypothesisIntegratorAgent extends BaseAgent<IntegrationRequest, IntegrationResult> {

  async execute(input: IntegrationRequest, signal?: AbortSignal): Promise<IntegrationResult> {
    // Build set of valid hypothesis IDs for reference validation
    const validHypothesisIds = new Set(input.hypotheses.map(h => h.id));

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    // Use free-text JSON for complex nested schemas (matches synthesizer/challenger pattern)
    const response = await this.callLLM(systemPrompt, userPrompt, { signal });
    return this.parseResponse(response, validHypothesisIds);
  }

  protected parseResponse(response: string, validHypothesisIds: Set<string>): IntegrationResult {
    const jsonStr = this.extractJSON(response);
    const parsed = JSON.parse(jsonStr);

    // Normalize domains in nested objects
    const normalized = normalizeDomainsInObject(parsed);

    // Generate UUIDs for any missing IDs
    if (normalized.clusters) {
      for (const cluster of normalized.clusters) {
        if (!cluster.id) cluster.id = randomUUID();
      }
    }
    if (normalized.integratedTheories) {
      for (const theory of normalized.integratedTheories) {
        if (!theory.id) theory.id = randomUUID();
      }
    }

    // Validate hypothesis ID references (LLM may hallucinate IDs)
    this.validateHypothesisReferences(normalized, validHypothesisIds);

    // Validate with Zod schema
    return IntegrationResultSchema.parse(normalized);
  }

  /**
   * Validates that all hypothesis ID references in clusters, theories, and dependencies
   * refer to actual hypotheses from the input. Removes invalid references and logs warnings.
   * Throws IntegrationError if critical references are invalid (e.g., all cluster members invalid).
   */
  private validateHypothesisReferences(
    result: Record<string, unknown>,
    validIds: Set<string>
  ): void {
    const invalidRefs: string[] = [];

    // Validate cluster hypothesis references
    if (result.clusters && Array.isArray(result.clusters)) {
      for (const cluster of result.clusters as Array<{ id: string; hypothesisIds: string[] }>) {
        const originalCount = cluster.hypothesisIds.length;
        cluster.hypothesisIds = cluster.hypothesisIds.filter(id => {
          if (!validIds.has(id)) {
            invalidRefs.push(`cluster[${cluster.id}].hypothesisIds: ${id}`);
            return false;
          }
          return true;
        });

        // If cluster lost all members, this is a critical error
        if (cluster.hypothesisIds.length === 0 && originalCount > 0) {
          throw new IntegrationError(
            `Cluster ${cluster.id} has no valid hypothesis references`,
            'clustering',
            'INVALID_HYPOTHESIS_REFERENCE',
            { clusterId: cluster.id, originalCount }
          );
        }
      }
    }

    // Validate integrated theory references
    if (result.integratedTheories && Array.isArray(result.integratedTheories)) {
      for (const theory of result.integratedTheories as Array<{ id: string; componentHypothesisIds: string[] }>) {
        theory.componentHypothesisIds = theory.componentHypothesisIds.filter(id => {
          if (!validIds.has(id)) {
            invalidRefs.push(`theory[${theory.id}].componentHypothesisIds: ${id}`);
            return false;
          }
          return true;
        });
      }
    }

    // Validate dependency references
    if (result.dependencies && Array.isArray(result.dependencies)) {
      result.dependencies = (result.dependencies as Array<{ fromHypothesisId: string; toHypothesisId: string }>)
        .filter(dep => {
          const fromValid = validIds.has(dep.fromHypothesisId);
          const toValid = validIds.has(dep.toHypothesisId);
          if (!fromValid) invalidRefs.push(`dependency.fromHypothesisId: ${dep.fromHypothesisId}`);
          if (!toValid) invalidRefs.push(`dependency.toHypothesisId: ${dep.toHypothesisId}`);
          return fromValid && toValid;
        });
    }

    // Log warnings for any invalid references that were filtered out
    if (invalidRefs.length > 0) {
      logger.warn('Filtered invalid hypothesis references from LLM output', {
        count: invalidRefs.length,
        references: invalidRefs.slice(0, 10), // Log first 10 only
      });
    }
  }
}
```

---

## Rationale

### Why a Separate Stage (Not Integrated into Challenger)?

1. **Separation of Concerns**: Challenger validates individual hypotheses; Integrator synthesizes across hypotheses. Different cognitive tasks.
2. **Testability**: Integration logic can be unit tested independently.
3. **Optional Stage**: Some sessions may not need integration (single-hypothesis output). Stage can be skipped.
4. **Token Efficiency**: Challenger already handles complex scoring. Adding integration would exceed context limits.

### Why Opus Model for Integrator?

1. **Synthesis Complexity**: Identifying unifying principles across diverse hypotheses requires strong reasoning.
2. **Dependency Detection**: Recognizing implicit dependencies requires nuanced understanding.
3. **Cost Justification**: Integration runs once per session on 2-5 hypotheses. Marginal cost vs. value delivered.

### Why Cohesion Threshold of 0.4?

1. **Empirical Starting Point**: Similar to document clustering literature (0.3-0.5 range).
2. **Avoid Over-Clustering**: Higher threshold would miss meaningful but subtle connections.
3. **Avoid Under-Clustering**: Lower threshold would create noise clusters.
4. **Tunable**: Expose as configuration parameter for future optimization.

### Why Non-Fatal Integration Failure?

Integration is **additive value**. If it fails:
- User still gets ranked hypotheses (core value)
- Warning in output explains the limitation
- No silent data loss

This follows the fallback strategy established in ADR-008:

| Agent | Fallback Strategy |
|-------|-------------------|
| domain-analyst | Fail pipeline (critical) |
| cross-pollinator | Return empty, continue with warning |
| hypothesis-synthesizer | Fail pipeline (critical) |
| hypothesis-challenger | Return unscored with warning |
| **hypothesis-integrator** | **Return ranked hypotheses without integration, add warning** |

### Why 0-1 Confidence Scale (Not 1-5)?

The 1-5 scale in `HypothesisScores` represents dimension ratings. The `compositeConfidence` in `IntegratedTheory` represents a probability-like confidence in the integration quality itself:

- **0.0**: No confidence in integration validity
- **0.5**: Uncertain, components may or may not work together
- **1.0**: High confidence the integration is valid

This is semantically different from dimension scores and aligns with standard ML confidence conventions.

---

## Concurrency Analysis

### Shared Resources

| Resource | Access Pattern | Concurrency Risk |
|----------|---------------|------------------|
| Trace directory | Write-only, unique traceId per run | None - isolated by traceId |
| PipelineContext state | Instance-scoped, not shared | None - each run has own instance |
| Integration types (HypothesisCluster, etc.) | Immutable after creation | None - no mutation |
| LLM API calls | Stateless external service | None - each call independent |

### Atomicity Strategy

**No additional atomicity measures required** for the integration stage:

1. **Run Isolation**: Each `SynthesisOrchestrator.run()` call creates a new `PipelineContext` with a unique `traceId`. Integration results are stored in this instance-scoped context.

2. **No Shared State**: The `HypothesisIntegratorAgent` does not maintain state between invocations. Each `execute()` call is independent.

3. **Trace File Writes**: Trace output uses atomic write pattern (temp file + rename) already established in the trace writer. No race conditions possible.

4. **Concurrent Pipeline Runs**: Multiple pipeline runs can execute concurrently on different queries. Each produces isolated output with no cross-contamination.

### Potential Future Concurrency Considerations

If future enhancements add shared state (e.g., cross-session cluster caching):
- Use Redis or PostgreSQL for shared cluster storage
- Apply optimistic locking with version fields
- Implement cache invalidation strategy

---

## Observability

### Metrics

The integration stage MUST expose the following metrics:

```typescript
// Prometheus-style metrics
const integrationMetrics = {
  // Stage performance
  integration_stage_duration_seconds: new Histogram({
    name: 'integration_stage_duration_seconds',
    help: 'Duration of hypothesis integration stage',
    labelNames: ['status'], // success, error, skipped
    buckets: [5, 10, 20, 30, 45, 60, 90, 120],
  }),

  // Output quality
  integration_clusters_total: new Counter({
    name: 'integration_clusters_total',
    help: 'Total clusters produced',
  }),

  integration_theories_total: new Counter({
    name: 'integration_theories_total',
    help: 'Total integrated theories produced',
  }),

  integration_coverage_score: new Gauge({
    name: 'integration_coverage_score',
    help: 'Query coverage score (0-1)',
  }),

  integration_cohesion_score: new Histogram({
    name: 'integration_cohesion_score',
    help: 'Distribution of cluster cohesion scores',
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  }),

  // Error tracking
  integration_errors_total: new Counter({
    name: 'integration_errors_total',
    help: 'Integration stage errors by type',
    labelNames: ['error_type', 'is_retryable'],
  }),

  // Validation
  integration_invalid_refs_total: new Counter({
    name: 'integration_invalid_refs_total',
    help: 'Invalid hypothesis references filtered from LLM output',
  }),
};
```

### Logging

Structured log events for integration stage:

| Event | Level | Context |
|-------|-------|---------|
| `integration_stage_start` | info | `{ traceId, hypothesisCount }` |
| `integration_stage_complete` | info | `{ traceId, clusterCount, theoryCount, coverageScore, durationMs }` |
| `integration_stage_skipped` | warn | `{ traceId, reason }` |
| `integration_stage_error` | error | `{ traceId, errorType, isRetryable, phase }` |
| `invalid_hypothesis_ref` | warn | `{ traceId, clusterId, invalidId }` |

---

## Consequences

### Positive

1. **Research Program Output**: Researchers receive coherent theory stacks, not just hypothesis lists.
2. **Dependency-Aware Prioritization**: Clear investigation order based on prerequisite relationships.
3. **Gap Visibility**: Researchers see what the system couldn't address, enabling follow-up sessions.
4. **Composition Uncertainty**: Joint confidence reflects the weakest link in hypothesis chains.
5. **Backward Compatible**: Existing integrations continue working; `integration` field is optional.
6. **Transparent Reasoning**: Cluster rationales and dependency explanations visible to researchers.

### Negative

1. **Increased Latency**: New stage adds 30-60 seconds to pipeline execution.
2. **Increased Cost**: Opus call for integration adds ~$0.10-0.20 per session.
3. **Complexity**: Pipeline grows from 4 to 5 stages; more failure modes to handle.
4. **Output Verbosity**: CLI output becomes significantly longer with integration details.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM produces inconsistent clusters | Medium | Medium | Normalize clustering output; validate cohesion scores; add stability tests |
| Dependency detection misses implicit deps | Medium | Low | Conservative dependency strength; researcher can add manual deps |
| Query coverage extraction is unreliable | Medium | Medium | Include original query in output; let researcher override requirements |
| Integration stage timeout | Low | Low | Non-fatal failure; circuit breaker pattern (ADR-005) |
| Token budget exceeded | Low | Medium | Integration runs last; budget check before stage; can skip if budget tight |

---

## Implementation Notes

### ID Generation

All new IDs MUST use `crypto.randomUUID()`:

```typescript
import { randomUUID } from 'crypto';

// In parseResponse or normalizer:
cluster.id = cluster.id || randomUUID();
theory.id = theory.id || randomUUID();
```

### New Context Methods

Add to `src/context/pipeline-context.ts`:

```typescript
private _clusters: HypothesisCluster[] = [];
private _integratedTheories: IntegratedTheory[] = [];
private _dependencies: HypothesisDependency[] = [];
private _queryCoverage: QueryCoverage | null = null;

setClusters(clusters: HypothesisCluster[]): void {
  this._clusters = clusters;
}

setIntegratedTheories(theories: IntegratedTheory[]): void {
  this._integratedTheories = theories;
}

setDependencies(deps: HypothesisDependency[]): void {
  this._dependencies = deps;
}

setQueryCoverage(coverage: QueryCoverage): void {
  this._queryCoverage = coverage;
}

get clusters(): HypothesisCluster[] { return this._clusters; }
get integratedTheories(): IntegratedTheory[] { return this._integratedTheories; }
get dependencies(): HypothesisDependency[] { return this._dependencies; }
get queryCoverage(): QueryCoverage | null { return this._queryCoverage; }
```

### CLI Output Format

Add to `src/cli.ts` output formatting:

```
========================================
  INTEGRATED THEORIES
========================================

Theory: Non-Extractive Attribution Stack
Unifying Principle: Attribution systems require multi-dimensional measurement
  flowing through privacy-preserving networks that scale fractally.

Components:
  1. Value Pareto Frontiers - Provides measurement framework
  2. Economic Phylogenetics - Traces value flow
  3. Federated Economics - Enables privacy
  4. Scale-Free Architecture - Ensures scaling
  5. Economic Mycorrhiza - Balances distribution

Confidence: 0.72 (Strong component alignment, moderate integration complexity)

Synergies:
  - Pareto measurement feeds directly into phylogenetic tracing
  - Federated privacy enables competitive participation
  - Scale-free architecture provides the substrate for mycorrhizal distribution

Tensions:
  - Phylogenetic tracing may conflict with privacy requirements
  - Mycorrhizal redistribution may resist scale-free hub formation

Investigation Order:
  1. Value Pareto Frontiers (foundation - no dependencies)
  2. Economic Phylogenetics (requires #1 for measurement)
  3. Federated Economics (requires #2 for what to protect)
  4. Scale-Free Architecture (requires #1-3 for fairness constraints)
  5. Economic Mycorrhiza (requires #4 for network substrate)

========================================
  QUERY COVERAGE
========================================

Original Query: "Let's find a path to an alternate additive economic system
  that will scale globally, based on non-extractive fair attribution
  and shared revenue on success."

Overall Coverage: 78%

Covered Requirements:
  - "fair attribution" → Hypotheses #1, #2 (full)
  - "scale globally" → Hypothesis #4 (full)
  - "non-extractive" → Hypotheses #4, #5 (partial)
  - "shared revenue on success" → Hypothesis #1 (partial)

Gaps Identified:
  - "additive economic system" - No hypothesis directly addresses additive vs extractive framing
    Suggested: Explore commons economics literature, cooperative game theory

  - "path to" (transition mechanism) - No hypothesis addresses adoption/transition
    Suggested: Institutional economics domain, behavioral adoption research
```

### Schema Version Bump

Increment `SCHEMA_VERSION` in `src/types/schema-version.ts`:
- From: `1.2.0` (post ADR-009)
- To: `1.3.0`

### Test Strategy

1. **Unit Tests** (`tests/unit/hypothesis-integrator.test.ts`):
   - Clustering with known similar hypotheses → expect clusters
   - Clustering with all dissimilar hypotheses → expect no clusters
   - Dependency detection with explicit prerequisites
   - Query coverage with partial and full coverage
   - ID generation uses UUID format

2. **Integration Tests** (`tests/integration/integration-pipeline.test.ts`):
   - Full pipeline with 5 hypotheses → expect clusters
   - Full pipeline with 1 hypothesis → expect skip with warning
   - Full pipeline with 0 hypotheses → expect skip with warning
   - Failure recovery: mock integrator failure, verify warning in output

3. **Stability Tests**:
   - Same input produces same clusters (run 3x, compare structure)
   - Cohesion scores in valid range (0-1)
   - All IDs are valid UUIDs

---

## Alternatives Considered

### Alternative 1: Integrate Clustering into Challenger

**Approach**: Have HypothesisChallengerAgent also cluster hypotheses after scoring.

**Rejected Because**:
- Challenger prompt is already complex (600+ lines of system prompt)
- Different cognitive tasks (evaluation vs. synthesis) benefit from separation
- Would exceed Challenger's token budget
- Harder to test clustering logic in isolation

### Alternative 2: Client-Side Integration

**Approach**: Return raw hypotheses; let calling application perform integration.

**Rejected Because**:
- Pushes LLM reasoning cost to every client
- Inconsistent integration logic across clients
- Researchers using CLI get no integration value
- Violates "complete output" principle

### Alternative 3: Use tool_use for Structured Output

**Approach**: Use `callLLMWithSchema()` like domain-analyst and cross-pollinator.

**Rejected Because**:
- Integration output has deeply nested arrays (clusters[].hypothesisIds[], theories[].componentSummaries[], etc.)
- tool_use times out with deeply nested schemas (documented in hypothesis-synthesizer.ts:60)
- Free-text JSON + Zod validation is the proven pattern for complex output

### Alternative 4: Real-Time Iterative Refinement

**Approach**: When borderline hypothesis identified, immediately re-synthesize variants.

**Rejected Because**:
- Unbounded iteration risk (could loop forever)
- Significantly increases cost and latency
- User didn't ask for refinement
- Can be added as future enhancement (ADR-011)

---

## Confidence

**MEDIUM-HIGH**

The architectural approach is sound and follows established patterns (hub-and-spoke, typed handoffs, non-fatal stages). The type system integrates cleanly with existing schemas. Guardian validation passed with minor amendments (all incorporated).

Uncertainty exists around:
1. **LLM clustering quality**: May require prompt iteration to achieve consistent clusters
2. **Cohesion threshold**: 0.4 is a starting point; empirical tuning needed

**What would increase confidence:**
- User testing with 3-5 research sessions to validate output utility
- A/B comparison: researchers rate usefulness of integrated vs. non-integrated output
- Token usage profiling to confirm budget impact is manageable
