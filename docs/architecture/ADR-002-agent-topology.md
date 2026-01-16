# ADR-002: Agent Topology

**Status**: Accepted
**Date**: 2026-01-16

---

## Context

Need to define how the 6 agents in Synthesis Labs communicate and coordinate:
- synthesis-orchestrator
- domain-analyst
- cross-pollinator
- hypothesis-synthesizer
- hypothesis-challenger
- evidence-gatherer

Key questions:
1. How do agents pass data to each other?
2. How does the orchestrator invoke agents?
3. What happens when an agent fails?
4. How is context shared?

## Decision

Implement **hub-and-spoke topology with typed handoffs**:

```
                    ┌─────────────────────────┐
                    │   SYNTHESIS-ORCHESTRATOR │
                    │                         │
                    │  • Invokes agents       │
                    │  • Collects outputs     │
                    │  • Manages context      │
                    │  • Handles errors       │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │ domain-analyst│   │cross-pollinator│   │ hypothesis-   │
    │               │   │               │   │ synthesizer   │
    └───────────────┘   └───────────────┘   └───────────────┘
            │                   │                   │
            │                   ▼                   │
            │           ┌───────────────┐           │
            │           │ hypothesis-   │           │
            │           │ challenger    │           │
            │           └───────────────┘           │
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   evidence-gatherer   │
                    │      (optional)       │
                    └───────────────────────┘
```

### Communication Model

Agents communicate **only through the orchestrator** via typed handoffs:

```typescript
interface AgentHandoff<T> {
  sourceAgent: AgentType;
  targetAgent: AgentType;
  payload: T;
  timestamp: Date;
  traceId: string;
}
```

### Handoff Types

| Source | Target | Handoff Type | Payload |
|--------|--------|--------------|---------|
| user | orchestrator | `UserQuery` | query, targetDomains |
| orchestrator | domain-analyst | `AnalysisRequest` | domain, query |
| domain-analyst | orchestrator | `DomainAnalysis` | concepts, methods, problems |
| orchestrator | cross-pollinator | `PollinationRequest` | sourceDomain, otherDomains |
| cross-pollinator | orchestrator | `CrossDomainConnections` | analogies[] |
| orchestrator | hypothesis-synthesizer | `SynthesisRequest` | connections, context |
| hypothesis-synthesizer | orchestrator | `RawHypotheses` | hypotheses[] |
| orchestrator | hypothesis-challenger | `ChallengeRequest` | hypotheses[] |
| hypothesis-challenger | orchestrator | `ScoredHypotheses` | scoredHypotheses[] |
| orchestrator | evidence-gatherer | `EvidenceRequest` | hypotheses[] |
| evidence-gatherer | orchestrator | `EvidencedHypotheses` | hypotheses[] |

### Invocation Pattern

```typescript
// Orchestrator invokes agents sequentially
async function runPipeline(query: UserQuery): Promise<FinalOutput> {
  const context = new PipelineContext(query);

  // Stage 1: Domain Analysis
  const analysis = await invokeAgent('domain-analyst', {
    domain: query.targetDomain,
    query: query.text,
  });
  context.addAnalysis(analysis);

  // Stage 2: Cross-Pollination
  const connections = await invokeAgent('cross-pollinator', {
    sourceDomain: analysis,
    otherDomains: SUPPORTED_DOMAINS.filter(d => d !== query.targetDomain),
  });
  context.addConnections(connections);

  // Stage 3: Hypothesis Synthesis
  const rawHypotheses = await invokeAgent('hypothesis-synthesizer', {
    connections,
    context: context.getSummary(),
  });
  context.addHypotheses(rawHypotheses);

  // Stage 4: Challenge & Score
  const scoredHypotheses = await invokeAgent('hypothesis-challenger', {
    hypotheses: rawHypotheses,
    rubric: QUALITY_RUBRIC,
  });

  // Stage 5: Evidence (optional)
  const finalHypotheses = await invokeAgent('evidence-gatherer', {
    hypotheses: scoredHypotheses.filter(h => h.score >= THRESHOLD),
  });

  return formatOutput(finalHypotheses);
}
```

### Error Handling

```typescript
async function invokeAgent<T, R>(
  agentType: AgentType,
  input: T,
  options: { retries?: number; timeout?: number } = {}
): Promise<R> {
  const { retries = 2, timeout = 60000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await withTimeout(
        agents[agentType].execute(input),
        timeout
      );
      return result;
    } catch (error) {
      if (attempt === retries) {
        throw new AgentError(agentType, error);
      }
      // Exponential backoff
      await delay(1000 * Math.pow(2, attempt));
    }
  }
}
```

### Context Management

```typescript
class PipelineContext {
  private readonly traceId: string;
  private analysis: DomainAnalysis | null = null;
  private connections: CrossDomainConnection[] = [];
  private hypotheses: Hypothesis[] = [];

  constructor(query: UserQuery) {
    this.traceId = crypto.randomUUID();
  }

  getSummary(): ContextSummary {
    // Return condensed context for LLM prompts
    // Limit to ~50K tokens to leave room for agent work
    return {
      keyConceptsCount: this.analysis?.concepts.length ?? 0,
      connectionsCount: this.connections.length,
      hypothesesCount: this.hypotheses.length,
      topConcepts: this.analysis?.concepts.slice(0, 10) ?? [],
      topConnections: this.connections.slice(0, 5),
    };
  }
}
```

## Rationale

1. **Hub-and-spoke over peer-to-peer**: Centralized control simplifies debugging and error recovery. Agents remain stateless and testable.

2. **Typed handoffs**: TypeScript interfaces catch contract violations at compile time. Clear documentation of what data flows where.

3. **Sequential with optional stages**: Evidence-gatherer can be skipped if time-constrained. Pipeline remains valid without it.

4. **Retry with backoff**: LLM APIs can be flaky. Retries with exponential backoff handle transient failures.

## Consequences

### Positive
- Agents are loosely coupled
- Clear data contracts
- Easy to add new agents
- Centralized logging/tracing

### Negative
- Orchestrator complexity grows with agents
- No direct agent-to-agent optimization
- Sequential bottleneck

### Risks
- Orchestrator becomes monolithic
- Context summary may lose important details

**Mitigation**: Keep orchestrator thin (routing only); use structured context summaries

## Implementation Notes

- Each agent is a pure function: `(input: T) => Promise<R>`
- Orchestrator handles all LLM API calls
- Handoffs logged for debugging
- Trace ID propagated through all stages

## Confidence

**HIGH** - Standard orchestration pattern
