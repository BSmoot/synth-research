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

## Pending Decisions

- [ ] How to represent "domains" and "concepts" (schema design)
- [ ] Knowledge storage strategy (in-memory vs persistent)
- [ ] Hypothesis scoring algorithm
- [ ] Agent topology (parallel vs sequential for cross-domain search)
