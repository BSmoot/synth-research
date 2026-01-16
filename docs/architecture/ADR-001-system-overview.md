# ADR-001: System Overview

**Status**: Accepted
**Date**: 2026-01-16

---

## Context

Synthesis Labs is a cross-domain research hypothesis generation platform. We need a system architecture that:
- Coordinates multiple AI agents for different tasks
- Processes research questions through a multi-stage pipeline
- Generates and validates novel hypotheses
- Operates within LLM context window limits (200K tokens)
- Runs as a CLI tool without persistent storage

## Decision

Implement a **pipeline architecture with orchestrator coordination**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SYNTHESIS LABS SYSTEM                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ORCHESTRATION LAYER                        │   │
│  │                                                               │   │
│  │   ┌─────────────────────────────────────────────────────┐    │   │
│  │   │           SYNTHESIS-ORCHESTRATOR                     │    │   │
│  │   │                                                      │    │   │
│  │   │  • Receives user input                               │    │   │
│  │   │  • Sequences agent invocations                       │    │   │
│  │   │  • Manages shared context                            │    │   │
│  │   │  • Aggregates and formats output                     │    │   │
│  │   └─────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      AGENT LAYER                              │   │
│  │                                                               │   │
│  │   ┌──────────┐   ┌──────────┐   ┌──────────┐                │   │
│  │   │ DOMAIN   │   │  CROSS   │   │HYPOTHESIS│                │   │
│  │   │ ANALYST  │──▶│POLLINATOR│──▶│SYNTHESIZER│               │   │
│  │   └──────────┘   └──────────┘   └──────────┘                │   │
│  │        │              │              │                       │   │
│  │        ▼              ▼              ▼                       │   │
│  │   ┌──────────────────────────────────────────────────────┐   │   │
│  │   │              SHARED CONTEXT (in-memory)              │   │   │
│  │   └──────────────────────────────────────────────────────┘   │   │
│  │        │              │              │                       │   │
│  │        ▼              ▼              ▼                       │   │
│  │   ┌──────────┐   ┌──────────┐                               │   │
│  │   │HYPOTHESIS│   │ EVIDENCE │                               │   │
│  │   │CHALLENGER│   │ GATHERER │  (optional)                   │   │
│  │   └──────────┘   └──────────┘                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      OUTPUT LAYER                             │   │
│  │                                                               │   │
│  │   Ranked hypotheses with citations, scores, suggested tests   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Responsibilities

| Agent | Responsibility | Input | Output |
|-------|---------------|-------|--------|
| **synthesis-orchestrator** | Coordinate workflow, manage context | User query | Final output |
| **domain-analyst** | Extract concepts, methods, problems | Domain/query | DomainAnalysis |
| **cross-pollinator** | Find analogies across domains | DomainAnalysis | CrossDomainConnections |
| **hypothesis-synthesizer** | Generate candidate hypotheses | Connections | RawHypotheses |
| **hypothesis-challenger** | Validate and score hypotheses | RawHypotheses | ScoredHypotheses |
| **evidence-gatherer** | Find supporting citations | Hypotheses | EvidencedHypotheses |

### Data Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ Domain Analyst  │ ──▶ Concepts, Methods, Open Problems
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Cross-Pollinator│ ──▶ Analogies from other domains
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Hypothesis      │ ──▶ Candidate hypotheses
│ Synthesizer     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Hypothesis      │ ──▶ Scored + filtered hypotheses
│ Challenger      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Evidence        │ ──▶ Hypotheses with citations
│ Gatherer        │
└─────────────────┘
    │
    ▼
Ranked Output
```

## Rationale

1. **Pipeline over mesh**: Sequential pipeline is simpler to implement and debug. Each agent has clear input/output contracts.

2. **Orchestrator coordination**: Central orchestrator simplifies state management and error handling. Agents don't need to know about each other.

3. **In-memory shared context**: No persistence needed for MVP. Context passed through orchestrator avoids complex state sync.

4. **Optional evidence-gatherer**: Can skip for MVP if time-constrained. Hypotheses still valid without additional evidence.

## Consequences

### Positive
- Clear separation of concerns
- Easy to test agents in isolation
- Predictable execution order
- Simple error recovery (restart from failed stage)

### Negative
- No parallel execution of independent stages
- Orchestrator is single point of failure
- All context must fit in memory

### Risks
- Context may grow beyond memory for complex queries
- Sequential execution slower than potential parallel approach

**Mitigation**: Implement context pruning strategy; can add parallelism in v2

## Implementation Notes

- Use TypeScript interfaces for all agent input/output contracts
- Orchestrator implemented as async pipeline with await at each stage
- Each agent returns structured data (not raw text)
- Errors bubble up to orchestrator for handling

## Confidence

**HIGH** - Standard pipeline pattern with proven track record
