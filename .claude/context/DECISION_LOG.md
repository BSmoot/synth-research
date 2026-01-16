# Synthesis Labs - Decision Log

> Architectural and design decisions made during development

---

## Decision Format

```
### [DECISION-XXX] Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded
**Context**: Why this decision was needed
**Decision**: What we decided
**Rationale**: Why this choice over alternatives
**Consequences**: What this enables/constrains
```

---

## Decisions

### [DECISION-001] Use ATLAS Team Pattern for Agent Constellation

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Building a multi-agent system for research hypothesis generation. Need a consistent pattern for how agents coordinate, communicate, and maintain context.

**Decision**:
Adopt the ATLAS Team Template pattern from `~/.claude/specs/TEAM_TEMPLATE_v1.md`:
- Mandatory flow: Planner → Guardian → Experts → Spec-Writer → Integrator
- Interface agent for external communication
- Shared context layer for coordination

**Rationale**:
- Proven pattern from existing agent infrastructure
- Built-in quality gates (Guardian approval before spec work)
- Clear separation of concerns
- Context archaeology prevents conflicts

**Consequences**:
- Must implement guardian checks even for seemingly simple workflows
- All agents must read/write shared context
- Interface agent required for multi-agent communication

---

### [DECISION-002] TypeScript as Implementation Language

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Need to choose implementation language for the Synthesis Labs agent system.

**Decision**:
Use TypeScript with strict mode.

**Rationale**:
- Aligns with coding standards in CLAUDE.md
- Strong type system catches errors early
- Rich ecosystem for web APIs and tooling
- Existing agent infrastructure patterns are TypeScript-based

**Consequences**:
- Must configure tsconfig.json with strict mode
- Use explicit return types on public functions
- Prefer discriminated unions over optional fields

---

### [DECISION-003] Agent Communication via Handoff Protocol

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Agents need to pass work between each other (domain analysis → cross-pollinator → synthesizer).

**Decision**:
Use typed handoff protocol from CONSTELLATION_SPEC:
- Each handoff has schema
- Source and target agents validated
- Handoffs tracked in shared context

**Rationale**:
- Enables async parallel execution
- Traceable workflow for debugging
- Type safety prevents malformed handoffs

**Consequences**:
- Must define handoff schemas for each agent pair
- Orchestrator responsible for routing
- Blocked handoffs visible in context

---

### [DECISION-004] Hypothesis Quality Rubric (5 Dimensions)

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Need a standardized way to evaluate generated hypotheses before presenting to users.

**Decision**:
Use 5-dimension weighted rubric:
- Specificity (25%): Testable claim with defined variables
- Novelty (20%): Not already published/explored
- Connection Validity (25%): Genuine structural parallel between domains
- Feasibility (15%): Testable with reasonable resources
- Grounding (15%): At least 1 verifiable source

Pass threshold: Composite ≥ 3.0 AND no dimension < 2

**Rationale**:
- Covers key aspects of research hypothesis quality
- Weights prioritize what matters most (specificity + validity)
- Quantitative threshold enables automated filtering

**Consequences**:
- Challenger agent must implement rubric scoring
- Hypotheses below threshold are filtered out
- Edge cases (score 2.5-3.0) may need manual review

---

### [DECISION-005] Flat Tag Domain Representation

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Need to represent research domains for cross-domain search.

**Decision**:
Use flat string tags with optional dot notation for sub-domains:
- Top-level: `computational-biology`, `materials-science`, `ml-ai`
- Sub-level: `ml.reinforcement-learning`, `bio.crispr`

**Rationale**:
- Simple to implement for MVP
- Flexible enough for hierarchical browsing
- Can evolve to concept graph later

**Consequences**:
- No automatic taxonomy enforcement
- Cross-domain similarity is LLM-based, not structural
- Easy to add new domains

---

### [DECISION-006] LLM-Based Cross-Domain Similarity

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Need a method to determine if two concepts from different domains are analogous.

**Decision**:
Use LLM-based scoring (1-5 scale):
- Prompt LLM to rate structural similarity between concepts
- Threshold: ≥ 3 to consider concepts analogous
- Include explanation for transparency

**Rationale**:
- Leverages LLM's broad knowledge
- No need for embedding infrastructure in MVP
- Explanation provides interpretability

**Consequences**:
- Each similarity check costs an API call
- May need batching for efficiency
- Can replace with embeddings later if cost-prohibitive

---

### [DECISION-007] Single Citation Per Hypothesis (MVP)

**Date**: 2026-01-16
**Status**: Accepted

**Context**:
Conflict between timeline (8 hours) and citation rigor.

**Decision**:
MVP requires minimum 1 verifiable citation per hypothesis.
- Must be a real, checkable source
- No fabricated citations
- Can be from LLM knowledge or web search

**Rationale**:
- Maintains academic integrity non-negotiable
- Reduces verification overhead
- Can increase rigor in v2

**Consequences**:
- Some hypotheses may lack full evidence chain
- Users must verify citations independently
- Clear disclaimer required in output

---

## Pending Decisions

- [ ] Agent topology (parallel vs sequential for cross-domain search)
- [ ] Error recovery strategy for API failures
