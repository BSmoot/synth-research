# ADR-006: Parallel vs Sequential Hypothesis Evaluation

**Status**: Proposed
**Date**: 2026-01-17

---

## Context

The Hypothesis Challenger (Stage 4) currently evaluates all hypotheses in a single LLM call. This creates several limitations:

1. **Latency**: All hypotheses must wait for a single, large response
2. **Error isolation**: One malformed hypothesis can corrupt the entire batch
3. **Token limits**: Large hypothesis sets may exceed context window
4. **Scoring consistency**: Cross-hypothesis comparison in a single call may introduce bias

Current implementation in `src/agents/hypothesis-challenger.ts`:
- Lines 76-82: `execute()` calls LLM once with all hypotheses
- Lines 152-191: `buildUserPrompt()` concatenates all hypotheses into single prompt
- Lines 193-199: `parseResponse()` expects single JSON response with all scored hypotheses

The orchestrator (`src/orchestrator/synthesis-orchestrator.ts` lines 279-322) invokes the challenger once per pipeline run.

Related decision from ADR-001:
> "No parallel execution of independent stages" (line 137)
> "Sequential execution slower than potential parallel approach" (line 142)

## Decision

Implement **batched parallel evaluation** with configurable batch size:

### Evaluation Strategy

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Single** (current) | All hypotheses in one call | <= 3 hypotheses |
| **Batched Parallel** (new default) | Groups of 2-3 hypotheses evaluated in parallel | > 3 hypotheses |
| **Individual Parallel** | Each hypothesis in separate call | Special cases (debugging) |

**Recommendation**: Batched parallel with batch size of 2-3 hypotheses.

### Implementation

```typescript
interface ChallengeConfig {
  parallelMode: "single" | "batched" | "individual";
  batchSize: number;  // Default: 2
  maxConcurrent: number;  // Default: 3 (API rate limit aware)
}

export class HypothesisChallengerAgent extends BaseAgent<ChallengeRequest, ChallengeResult> {
  
  async execute(input: ChallengeRequest): Promise<ChallengeResult> {
    const config = this.getParallelConfig(input.hypotheses.length);
    
    if (config.parallelMode === "single") {
      return this.evaluateSingle(input.hypotheses);
    }
    
    return this.evaluateParallel(input.hypotheses, config);
  }

  private getParallelConfig(hypothesisCount: number): ChallengeConfig {
    if (hypothesisCount <= 3) {
      return { parallelMode: "single", batchSize: hypothesisCount, maxConcurrent: 1 };
    }
    return { parallelMode: "batched", batchSize: 2, maxConcurrent: 3 };
  }

  private async evaluateParallel(
    hypotheses: Hypothesis[],
    config: ChallengeConfig
  ): Promise<ChallengeResult> {
    const batches = this.createBatches(hypotheses, config.batchSize);
    
    const results = await this.processWithConcurrency(
      batches,
      config.maxConcurrent,
      (batch) => this.evaluateBatch(batch)
    );
    
    return this.mergeResults(results);
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processWithConcurrency<T, R>(
    items: T[],
    maxConcurrent: number,
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });
      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  private mergeResults(batchResults: BatchResult[]): ChallengeResult {
    const allScored: ScoredHypothesis[] = [];
    const allRejected: RejectedHypothesis[] = [];
    
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
}
```

### Error Handling for Parallel Evaluation

```typescript
interface BatchError {
  batchIndex: number;
  hypothesisIds: string[];
  error: Error;
}

private async evaluateParallel(
  hypotheses: Hypothesis[],
  config: ChallengeConfig
): Promise<ChallengeResult> {
  const batches = this.createBatches(hypotheses, config.batchSize);
  const results: BatchResult[] = [];
  const errors: BatchError[] = [];

  await Promise.all(
    batches.map(async (batch, index) => {
      try {
        const result = await this.evaluateBatch(batch);
        results.push(result);
      } catch (error) {
        errors.push({
          batchIndex: index,
          hypothesisIds: batch.map((h) => h.id),
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    })
  );

  // If some batches failed, return partial results with warnings
  if (errors.length > 0 && results.length > 0) {
    const merged = this.mergeResults(results);
    return merged;
  }

  // If all batches failed, throw
  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => e.error),
      "All hypothesis evaluation batches failed"
    );
  }

  return this.mergeResults(results);
}
```

## Rationale

1. **Batched over individual**: Individual calls (1 hypothesis per call) would incur excessive API overhead. Batches of 2-3 balance parallelism with efficiency.

2. **Threshold at 3 hypotheses**: For small hypothesis sets, single-call is simpler and avoids parallelization overhead.

3. **Max concurrency of 3**: Anthropic API rate limits suggest conservative parallelism. 3 concurrent requests is safe for most tiers.

4. **Partial failure tolerance**: If one batch fails, others still return results. Better than all-or-nothing for user experience.

5. **Consistent scoring within batch**: Hypotheses in the same batch can still be compared. Cross-batch comparison is less critical since final ranking uses absolute composite scores.

## Consequences

### Positive
- Reduced latency for large hypothesis sets (parallel API calls)
- Better error isolation (one bad hypothesis does not block others)
- Partial results on partial failure
- Same token budget per call regardless of total hypothesis count
- Scoring within batch maintains relative comparison

### Negative
- Cross-batch scoring may have slight inconsistency (different calls)
- Additional complexity in agent implementation
- More API calls for large hypothesis sets (cost increase)

### Risks
- **Risk**: API rate limiting with parallel calls
  **Mitigation**: `maxConcurrent` limit, exponential backoff on 429 errors

- **Risk**: Inconsistent scores across batches
  **Mitigation**: Rubric is absolute (1-5 scale), not relative. Final ranking uses composite score.

- **Risk**: Increased cost from multiple API calls
  **Mitigation**: Batching (2-3 per call) limits call count. Typical pipeline generates ~5 hypotheses = 2-3 API calls vs 1.

## Implementation Notes

Files to modify:
- `src/agents/hypothesis-challenger.ts`: Add parallel evaluation logic
- `src/agents/base-agent.ts`: Add `processWithConcurrency()` helper (reusable)

Configuration options:
```typescript
interface ChallengeRequest {
  hypotheses: Hypothesis[];
  parallelConfig?: {
    mode?: "single" | "batched" | "individual";
    batchSize?: number;
    maxConcurrent?: number;
  };
}
```

Testing approach:
- Unit test batch creation and merging
- Unit test concurrency limiter
- Integration test with 5+ hypotheses verifying parallel behavior
- Benchmark single vs parallel latency

Metrics to track:
- Wall-clock time for Stage 4 with varying hypothesis counts
- API call count per pipeline run
- Partial failure rate

## Confidence

**MEDIUM** - Parallelization approach is sound, but batch size (2) and concurrency limit (3) may need tuning based on real-world API behavior. Scoring consistency across batches is acceptable but not verified empirically.

