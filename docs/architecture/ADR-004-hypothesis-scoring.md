# ADR-004: Hypothesis Scoring

**Status**: Accepted
**Date**: 2026-01-16

---

## Context

Generated hypotheses need validation before presentation to users. The PRD defines a 5-dimension quality rubric. Need to implement:
- Scoring algorithm
- Threshold logic
- Filtering and ranking

## Decision

Implement **weighted rubric scoring with hard and soft thresholds**:

### Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Specificity** | 25% | Is the hypothesis testable with clear variables? |
| **Novelty** | 20% | Is this genuinely new, not already published? |
| **Connection Validity** | 25% | Is the cross-domain analogy genuine? |
| **Feasibility** | 15% | Can this be tested with reasonable resources? |
| **Grounding** | 15% | Is there at least one verifiable source? |

### Scoring Scale

Each dimension scored 1-5:

| Score | Label | Meaning |
|-------|-------|---------|
| 5 | Excellent | Exceptional quality, no concerns |
| 4 | Good | Strong, minor improvements possible |
| 3 | Adequate | Meets minimum bar, some concerns |
| 2 | Weak | Below bar, significant concerns |
| 1 | Poor | Fails this dimension |

### Dimension Rubrics

#### Specificity (25%)
```typescript
const SPECIFICITY_RUBRIC = {
  5: 'Testable claim with precisely defined variables, conditions, and expected outcomes',
  4: 'Testable claim with clear variables, some conditions need clarification',
  3: 'Testable claim with variables identified, conditions unclear',
  2: 'Vague claim, variables not well-defined',
  1: 'Untestable or too abstract to operationalize',
};
```

#### Novelty (20%)
```typescript
const NOVELTY_RUBRIC = {
  5: 'No existing research found, genuinely novel combination',
  4: 'Novel application, tangentially related work exists',
  3: 'Related work exists but different angle/application',
  2: 'Similar work exists, incremental difference only',
  1: 'Already published or obvious combination',
};
```

#### Connection Validity (25%)
```typescript
const CONNECTION_VALIDITY_RUBRIC = {
  5: 'Deep structural parallel, same underlying principles',
  4: 'Strong analogy with clear mechanism transfer',
  3: 'Moderate parallel, mechanism transfer plausible',
  2: 'Superficial similarity, mechanism transfer unclear',
  1: 'False analogy, no genuine structural parallel',
};
```

#### Feasibility (15%)
```typescript
const FEASIBILITY_RUBRIC = {
  5: 'Testable with standard lab resources, <$100K, <1 year',
  4: 'Testable with moderate resources, $100K-500K, 1-2 years',
  3: 'Testable with significant resources, $500K-1M, 2-5 years',
  2: 'Requires major resources or infrastructure, >$1M or >5 years',
  1: 'Currently untestable, requires technology that does not exist',
};
```

#### Grounding (15%)
```typescript
const GROUNDING_RUBRIC = {
  5: '3+ verifiable sources directly supporting the connection',
  4: '2 verifiable sources supporting the connection',
  3: '1 verifiable source supporting the connection',
  2: 'Source is LLM knowledge only, not independently verifiable',
  1: 'No sources, pure speculation',
};
```

### Scoring Algorithm

```typescript
interface ScoringResult {
  dimensions: {
    specificity: DimensionScore;
    novelty: DimensionScore;
    connectionValidity: DimensionScore;
    feasibility: DimensionScore;
    grounding: DimensionScore;
  };
  composite: number;
  verdict: 'pass' | 'fail' | 'borderline';
  failReasons: string[];
}

function scoreHypothesis(hypothesis: Hypothesis, scores: RawScores): ScoringResult {
  const weights = {
    specificity: 0.25,
    novelty: 0.20,
    connectionValidity: 0.25,
    feasibility: 0.15,
    grounding: 0.15,
  };

  // Calculate weighted composite
  let composite = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    composite += scores[dim] * weight;
  }

  // Check for hard failures (any dimension < 2)
  const failReasons: string[] = [];
  for (const [dim, score] of Object.entries(scores)) {
    if (score < 2) {
      failReasons.push(`${dim} scored ${score} (below minimum threshold of 2)`);
    }
  }

  // Determine verdict
  let verdict: 'pass' | 'fail' | 'borderline';
  if (failReasons.length > 0) {
    verdict = 'fail';
  } else if (composite >= 3.5) {
    verdict = 'pass';
  } else if (composite >= 3.0) {
    verdict = 'borderline';
  } else {
    verdict = 'fail';
    failReasons.push(`Composite score ${composite.toFixed(2)} below threshold of 3.0`);
  }

  return {
    dimensions: buildDimensionScores(scores, weights),
    composite,
    verdict,
    failReasons,
  };
}
```

### Thresholds

| Threshold | Value | Behavior |
|-----------|-------|----------|
| **Hard floor** | Any dimension < 2 | Automatic fail |
| **Soft floor** | Composite < 3.0 | Fail |
| **Borderline** | Composite 3.0-3.5 | Pass with caution flag |
| **Pass** | Composite ≥ 3.5 | Full pass |

### Ranking Algorithm

```typescript
function rankHypotheses(hypotheses: ScoredHypothesis[]): RankedHypothesis[] {
  return hypotheses
    .filter(h => h.verdict !== 'fail')
    .sort((a, b) => {
      // Primary: composite score
      if (b.composite !== a.composite) {
        return b.composite - a.composite;
      }
      // Secondary: connection validity (most important dimension)
      if (b.dimensions.connectionValidity.score !== a.dimensions.connectionValidity.score) {
        return b.dimensions.connectionValidity.score - a.dimensions.connectionValidity.score;
      }
      // Tertiary: specificity
      return b.dimensions.specificity.score - a.dimensions.specificity.score;
    })
    .map((h, index) => ({ ...h, rank: index + 1 }));
}
```

### LLM Scoring Prompt

```typescript
const SCORING_PROMPT = `
You are evaluating a research hypothesis for quality across 5 dimensions.

HYPOTHESIS:
{hypothesis.statement}

SOURCE DOMAIN: {hypothesis.sourceDomain}
TARGET DOMAIN: {hypothesis.targetDomain}

CONNECTION EXPLANATION:
{hypothesis.connection.explanation}

Score each dimension 1-5 using these rubrics:

SPECIFICITY (Is it testable?):
5 = Precise variables, conditions, outcomes defined
3 = Variables identified, conditions unclear
1 = Too abstract to operationalize

NOVELTY (Is it new?):
5 = No existing research found
3 = Related work exists, different angle
1 = Already published

CONNECTION VALIDITY (Is the analogy genuine?):
5 = Deep structural parallel
3 = Moderate parallel, plausible transfer
1 = False analogy

FEASIBILITY (Can it be tested?):
5 = Standard lab, <$100K, <1 year
3 = Significant resources, $500K-1M, 2-5 years
1 = Currently untestable

GROUNDING (Is there evidence?):
5 = 3+ verifiable sources
3 = 1 verifiable source
1 = Pure speculation

Respond in JSON format:
{
  "specificity": { "score": N, "explanation": "..." },
  "novelty": { "score": N, "explanation": "..." },
  "connectionValidity": { "score": N, "explanation": "..." },
  "feasibility": { "score": N, "explanation": "..." },
  "grounding": { "score": N, "explanation": "..." }
}
`;
```

## Rationale

1. **Weighted dimensions**: Not all dimensions equally important. Connection validity and specificity matter most for research value.

2. **Hard floor on all dimensions**: A hypothesis can't compensate for a fundamental failure (e.g., false analogy) with high scores elsewhere.

3. **Borderline category**: Some hypotheses are worth presenting with caveats. Binary pass/fail too coarse.

4. **LLM-based scoring**: Rubrics require judgment. LLM can apply rubrics consistently with explanations.

## Consequences

### Positive
- Transparent, explainable scores
- Consistent evaluation across hypotheses
- Catches fundamental flaws (hard floor)
- Ranking based on research value

### Negative
- LLM scoring adds latency and cost
- Rubrics may not cover edge cases
- Scores are still subjective

### Risks
- LLM may be inconsistent across calls
- Rubric weights may need tuning

**Mitigation**: Log all scores for analysis; can adjust weights based on user feedback

## Implementation Notes

- Cache scoring prompts to reduce token usage
- Run scoring in parallel for multiple hypotheses
- Include hypothesis ID in trace for debugging
- Store full scoring rationale, not just numbers

## Confidence

**MEDIUM** - Rubric design is sound but weights may need empirical tuning
