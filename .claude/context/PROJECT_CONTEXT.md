# Synthesis Labs - Project Context

> Cross-domain research hypothesis generation platform

---

## Project Mission

Build an AI agent constellation that serves as "cross-pollination infrastructure" for research — identifying non-obvious connections between domains that humans would not naturally discover due to disciplinary silos.

**Core Value Proposition**: Surface the research worth doing that researchers wouldn't have thought to try.

---

## Success Criteria

### Minimum Viable (Must Have)
- [ ] Complete agent specifications for core workflow
- [ ] Working orchestrator that can coordinate agents
- [ ] At least one end-to-end example that produces a hypothesis
- [ ] README explaining how to use the system

### Target (Should Have)
- [ ] All six agents implemented and tested
- [ ] Multiple example domains with generated hypotheses
- [ ] Hypothesis scoring/ranking working
- [ ] Clean, well-documented code

### Stretch (Nice to Have)
- [ ] Web fetch integration for live paper/research retrieval
- [ ] Persistence of domain knowledge across sessions
- [ ] Visualization of cross-domain connections

---

## Core Workflow

```
Input: Research question, paper, or domain of interest
       ↓
Domain Analysis: Identify core concepts, methods, open problems
       ↓
Cross-Domain Search: Find analogous problems/solutions in other fields
       ↓
Connection Synthesis: Generate candidate hypotheses from cross-pollination
       ↓
Validation Challenge: Stress-test each hypothesis for novelty and feasibility
       ↓
Output: Ranked hypotheses with supporting evidence and suggested experiments
```

---

## Constraints

### Technical Constraints
- **API Limits**: Must respect LLM context windows and rate limits
- **No Live Experiments**: System generates hypotheses, cannot execute experiments
- **Retrieval Latency**: Web search adds latency to cross-domain discovery
- **Knowledge Cutoff**: LLM knowledge has temporal limits

### Business Constraints
- **Citation Required**: All cross-domain connections must be traceable to sources
- **Feasibility Check**: Hypotheses must be practically testable
- **Novelty Check**: Must verify hypothesis isn't already published
- **Domain Validity**: Cross-domain mappings must be semantically valid, not superficial

### Scope Constraints
- MVP focuses on academic research domains
- Initial domains: computational biology, ML/AI, materials science
- No commercial/industry research in v1

---

## Key Patterns from Agent Specs

### From TEAM_TEMPLATE_v1.md
- **Mandatory Flow**: Planner → Guardian → [Experts] → Spec-Writer → Integrator
- **Context Required**: Guardian must fetch context before approving
- **Interface Agent**: Only external communication point
- **Success Criteria**: Intent accuracy (≥95%), Context health (100%), Spec alignment (100%)

### From AGENT_SPEC_v1.md
- **10-Section Structure**: Frontmatter, Identity, Paradigm, Capabilities, Constraints, Workflow, Reasoning, Output, Special Cases, Errors
- **Model Selection**: Opus for complex reasoning, Sonnet for structured generation, Haiku for speed
- **Permission Modes**: plan (foreground, can write) vs default (background)

### From CONSTELLATION_SPEC_v1.md
- **Coordination Layer**: Venture-Strategist → Constellation-Guardian → Orchestrator
- **Handoff Types**: strategy-direction, requirement, design-handoff, implementation-complete
- **Shared Context**: Vision → Strategy → Milestones → Dependencies → Metrics

---

## Agent Constellation (Planned)

| Agent | Role | Model | Mode |
|-------|------|-------|------|
| **synthesis-orchestrator** | Coordinate full workflow | opus | foreground |
| **domain-analyst** | Extract concepts, methods, problems | sonnet | background |
| **cross-pollinator** | Find analogous problems across domains | opus | background |
| **hypothesis-synthesizer** | Generate candidate hypotheses | opus | background |
| **hypothesis-challenger** | Stress-test hypotheses | opus | foreground |
| **evidence-gatherer** | Find supporting/contradicting evidence | sonnet | background |

---

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js / Bun
- **Testing**: Vitest
- **LLM Framework**: Claude via Anthropic API
- **Search**: WebSearch tool for cross-domain discovery

---

## Project Structure

```
synth-research/
├── .claude/
│   ├── context/           # Project context (this file)
│   │   ├── PROJECT_CONTEXT.md
│   │   ├── DECISION_LOG.md
│   │   └── OPEN_ITEMS.md
│   └── agents/            # Project-specific agent specs
├── docs/
│   ├── architecture/      # ADRs
│   └── specs/             # PRDs and specs
├── src/                   # Implementation
│   ├── types/             # Core type definitions
│   ├── agents/            # Agent implementations
│   └── orchestrator/      # Coordination logic
├── tests/                 # Test suites
│   ├── fixtures/          # Test data
│   └── integration/       # Integration tests
└── examples/              # Example inputs/outputs
```

---

## Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-01-16 | 0.1.0 | Initial project setup |
