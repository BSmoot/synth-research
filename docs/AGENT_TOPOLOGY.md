# Agent Topology

## Overview

Synthesis Labs uses a **hub-and-spoke topology** where a central orchestrator coordinates specialized agents through typed handoffs.

## Architecture Diagram

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    │     SYNTHESIS ORCHESTRATOR      │
                    │                                 │
                    │   • Receives user queries       │
                    │   • Sequences agent calls       │
                    │   • Manages pipeline context    │
                    │   • Handles errors & retries    │
                    │   • Formats final output        │
                    │                                 │
                    └───────────────┬─────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│                   │   │                   │   │                   │
│  DOMAIN ANALYST   │   │ CROSS-POLLINATOR  │   │    HYPOTHESIS     │
│                   │   │                   │   │    SYNTHESIZER    │
│  Model: Sonnet    │   │  Model: Opus      │   │                   │
│  Mode: Background │   │  Mode: Background │   │  Model: Opus      │
│                   │   │                   │   │  Mode: Background │
│  Extracts:        │   │  Finds:           │   │                   │
│  • Concepts       │   │  • Analogies      │   │  Generates:       │
│  • Methods        │   │  • Connections    │   │  • Hypotheses     │
│  • Problems       │   │  • Transfers      │   │  • Experiments    │
│                   │   │                   │   │                   │
└─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────┐
                    │                                 │
                    │    HYPOTHESIS CHALLENGER        │
                    │                                 │
                    │    Model: Opus                  │
                    │    Mode: Foreground             │
                    │                                 │
                    │    Validates:                   │
                    │    • Specificity                │
                    │    • Novelty                    │
                    │    • Connection validity        │
                    │    • Feasibility                │
                    │    • Grounding                  │
                    │                                 │
                    └───────────────┬─────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │                                 │
                    │     EVIDENCE GATHERER           │
                    │       (Optional)                │
                    │                                 │
                    │    Model: Sonnet                │
                    │    Mode: Background             │
                    │                                 │
                    │    Adds:                        │
                    │    • Citations                  │
                    │    • Verification               │
                    │                                 │
                    └─────────────────────────────────┘
```

## Data Flow

```
UserQuery
    │
    │ {text, targetDomain?}
    ▼
┌─────────────────┐
│ Domain Analyst  │
└────────┬────────┘
         │
         │ DomainAnalysis {concepts, methods, problems}
         ▼
┌─────────────────┐
│Cross-Pollinator │
└────────┬────────┘
         │
         │ CrossPollinationResult {connections[]}
         ▼
┌─────────────────┐
│ Hypothesis      │
│ Synthesizer     │
└────────┬────────┘
         │
         │ SynthesisResult {hypotheses[]}
         ▼
┌─────────────────┐
│ Hypothesis      │
│ Challenger      │
└────────┬────────┘
         │
         │ ChallengeResult {scored[], rejected[]}
         ▼
┌─────────────────┐
│ Evidence        │
│ Gatherer        │
└────────┬────────┘
         │
         │ EvidencedHypotheses {hypotheses[] with citations}
         ▼
SynthesisOutput
```

## Agent Specifications

### Domain Analyst

| Property | Value |
|----------|-------|
| **Model** | Claude Sonnet |
| **Mode** | Background |
| **Input** | Query + Domain |
| **Output** | Concepts, Methods, Problems |
| **Token Budget** | ~4K output |

**Responsibilities**:
- Parse research question
- Extract key concepts (5-15)
- Identify relevant methods (3-10)
- Surface open problems (3-8)
- Provide initial citations

### Cross-Pollinator

| Property | Value |
|----------|-------|
| **Model** | Claude Opus |
| **Mode** | Background |
| **Input** | DomainAnalysis + Target Domains |
| **Output** | Cross-domain connections |
| **Token Budget** | ~8K output |

**Responsibilities**:
- Analyze structural patterns
- Search other domains for analogies
- Score similarity (1-5)
- Explain transfer mechanism
- Flag confidence level

### Hypothesis Synthesizer

| Property | Value |
|----------|-------|
| **Model** | Claude Opus |
| **Mode** | Background |
| **Input** | Connections + Context |
| **Output** | Candidate hypotheses |
| **Token Budget** | ~8K output |

**Responsibilities**:
- Transform connections to hypotheses
- Structure with 4 components
- Add initial citations
- Suggest experiments
- Assess initial confidence

### Hypothesis Challenger

| Property | Value |
|----------|-------|
| **Model** | Claude Opus |
| **Mode** | Foreground |
| **Input** | Raw hypotheses |
| **Output** | Scored hypotheses + rejections |
| **Token Budget** | ~8K output |

**Responsibilities**:
- Apply 5-dimension rubric
- Calculate composite scores
- Issue pass/borderline/fail verdicts
- Provide challenge notes
- Document rejection reasons

### Evidence Gatherer (Optional)

| Property | Value |
|----------|-------|
| **Model** | Claude Sonnet |
| **Mode** | Background |
| **Input** | Validated hypotheses |
| **Output** | Hypotheses with citations |
| **Token Budget** | ~4K output |

**Responsibilities**:
- Find supporting citations
- Verify sources exist
- Assess evidence strength
- Add verification status

## Communication Protocol

All agents communicate through the orchestrator via typed handoffs:

```typescript
interface AgentHandoff<T> {
  sourceAgent: AgentType;
  targetAgent: AgentType;
  payload: T;
  timestamp: Date;
  traceId: string;
}
```

**Design principles**:
1. **Agents don't know about each other** - only the orchestrator
2. **All data is typed** - Zod schemas validate LLM output
3. **Errors bubble up** - orchestrator handles retries
4. **Context is summarized** - agents receive relevant slices only

## Error Handling

```
Agent fails
    │
    ├─── Retry (up to 2x with exponential backoff)
    │
    ├─── Still fails?
    │         │
    │         ├─── Critical stage (analysis, synthesis)
    │         │         └─── Abort pipeline, return error
    │         │
    │         └─── Optional stage (evidence)
    │                   └─── Skip, continue with partial results
    │
    └─── Success → Continue pipeline
```

## Future Enhancements

1. **Parallel execution**: Domain analysis for multiple domains simultaneously
2. **Caching**: Store domain analyses for reuse
3. **Streaming**: Progressive output as pipeline runs
4. **Feedback loop**: Learn from user ratings of hypotheses
