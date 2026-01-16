# Synthesis Labs - Product Requirements Document

**Status**: Draft
**Version**: 0.1.0
**Date**: 2026-01-16
**Source SD**: docs/specs/STRATEGY.md
**Source CCD**: docs/specs/CONSTRAINTS.md

---

## Executive Summary

### Objective
Enable interdisciplinary researchers to discover non-obvious cross-domain connections and generate specific, testable research hypotheses that they would not have found through traditional literature review.

### MVP Scope
5 must-have user stories delivering core hypothesis generation: input processing, domain analysis, cross-domain search, hypothesis synthesis, and basic validation. CLI-based, single-session, with citation traceability.

### Full Scope
18 stories across 6 epics covering complete workflow from input to validated, ranked hypotheses with comprehensive evidence gathering.

### Key Constraints
- 8-hour MVP timeline
- 200K token context window
- Citation traceability required for all claims
- No persistent storage (in-memory only)
- CLI interface only
- TypeScript strict mode

---

## Decisions Made

### GAP-001: Hypothesis Quality Rubric

**Decision**: Define 5-dimension quality rubric

| Dimension | Weight | Pass Criteria | Measurement Method |
|-----------|--------|---------------|-------------------|
| **Specificity** | 25% | Hypothesis contains testable variables, conditions, and expected outcomes | LLM evaluation against template |
| **Novelty** | 20% | Web search does not return direct match or obvious prior art | Web search + LLM analysis |
| **Connection Validity** | 25% | Cross-domain mapping is semantic (structural/functional analogy), not superficial (keyword match) | LLM challenger evaluation |
| **Feasibility** | 15% | Could be tested with <$100K budget and <1 year timeframe | LLM estimation |
| **Grounding** | 15% | At least one verifiable source supports each domain's contribution to the connection | Citation verification |

**Scoring**:
- Each dimension: 1-5 scale
- Pass threshold: Average >= 3.0 AND no dimension < 2
- MVP target: >40% of generated hypotheses pass

### GAP-002: Domain Representation

**Decision**: Flat tags for MVP

**Format**: String labels with optional hierarchy via dot notation
- Examples: `computational-biology`, `materials-science`, `ml.reinforcement-learning`
- Case: lowercase with hyphens
- Hierarchy: single level allowed (parent.child)

**Rationale**: Simplest implementation, sufficient for 3-domain MVP. Upgrade to graph in v2.

### GAP-003: Cross-Domain Similarity Metric

**Decision**: LLM-based similarity scoring

**Implementation**:
1. Present source concept and candidate target concept to LLM
2. Ask for analogy quality score (1-5) with reasoning
3. Threshold: >= 3 to proceed with hypothesis generation

**Scoring Prompt Template**:
```
Rate the analogy quality between these concepts from different domains:

Source: [concept] from [domain]
- Core function: [description]
- Key properties: [list]

Target: [concept] from [domain]  
- Core function: [description]
- Key properties: [list]

Rate 1-5 where:
1 = No meaningful connection (superficial keyword match only)
2 = Weak connection (vague similarity)
3 = Moderate connection (shared abstract principle)
4 = Strong connection (structural/functional parallel)
5 = Exceptional connection (deep isomorphism)

Provide: score, reasoning, potential hypothesis angle.
```

**Rationale**: Fast to implement, leverages LLM reasoning capability, good enough for MVP validation.

### CONFLICT-001: Timeline vs Citation Rigor

**Decision**: Reduced citation depth for MVP

- MVP: Single verifiable citation per hypothesis (minimum viable)
- Production: Comprehensive citation with multiple sources per claim
- Document limitation clearly in output

---

## Feature Breakdown

### Epics Overview

| Epic | Name | Stories | Priority | Effort |
|------|------|---------|----------|--------|
| EPIC-001 | Input Processing | 3 | Must-have | 1.5 days |
| EPIC-002 | Domain Analysis | 3 | Must-have | 2 days |
| EPIC-003 | Cross-Domain Search | 3 | Must-have | 2 days |
| EPIC-004 | Hypothesis Synthesis | 4 | Must-have | 2.5 days |
| EPIC-005 | Hypothesis Validation | 3 | Must-have | 2 days |
| EPIC-006 | Output Formatting | 2 | Should-have | 1 day |

**Total Estimated Effort**: 11 days (full scope) / 5-6 days (MVP)

---

## MoSCoW Prioritization

### Must Have (MVP)

These features are required for minimum viable demonstration.

| ID | Feature | Rationale |
|----|---------|-----------|
| US-001 | Text input processing | Entry point for system |
| US-004 | Core concept extraction | Foundation for cross-domain search |
| US-007 | Cross-domain analogy finding | Core value proposition |
| US-010 | Hypothesis generation | Primary output |
| US-014 | Basic validation (novelty + specificity) | Quality gate |
| US-017 | Structured hypothesis output | Usable result |

### Should Have

Significant value, include if time permits after MVP.

| ID | Feature | Rationale |
|----|---------|-----------|
| US-002 | Domain name input | Alternative entry point |
| US-005 | Method/technique extraction | Richer analysis |
| US-006 | Open problem identification | Better hypothesis targeting |
| US-008 | Similar problem retrieval | More connection candidates |
| US-011 | Hypothesis structuring | Better output quality |
| US-013 | Connection validity check | Deeper validation |
| US-015 | Feasibility assessment | Practical filtering |
| US-018 | Citation formatting | Academic usability |

### Could Have

Nice to have, defer to v2 unless trivial.

| ID | Feature | Rationale |
|----|---------|-----------|
| US-003 | Paper URL input | Stretch input type |
| US-009 | Cross-domain paper retrieval | Enhanced evidence |
| US-012 | Experiment suggestion | Actionable output |
| US-016 | Hypothesis ranking | Prioritization |

### Won't Have (v1)

Explicitly out of scope for this release.

| Feature | Reason for Exclusion |
|---------|---------------------|
| Web UI | Timeline constraint |
| User authentication | No multi-user requirement |
| Persistent storage | MVP simplicity |
| Domain knowledge caching | Requires persistence |
| Multiple hypothesis comparison | Complex UX |
| Collaborative features | Single-user MVP |
| API server | CLI-only scope |
| Integration with paper databases | Rate limit complexity |
| Visualization of connections | Requires UI |
| Learning from feedback | Requires persistence |

---


## User Stories

### EPIC-001: Input Processing

#### US-001: Research Question Input (Must Have)

**Priority**: Must-have
**Effort**: 0.5 days
**RICE Score**: 48

As a researcher, I want to input a research question as free text so that I can explore cross-domain connections relevant to my inquiry.

**Acceptance Criteria**:
- Given a research question string, when I submit it to the system, then the system acknowledges receipt and begins processing
- Given an empty string, when I submit it, then the system returns a validation error with guidance
- Given a question exceeding 2000 characters, when I submit it, then the system truncates with warning or rejects with guidance
- Given a valid question, when processing begins, then the system extracts the primary domain and key concepts

**Constraints Applied**:
- Input must be sanitized (no path traversal, no injection)
- Must fit within context budget allocation (~1K tokens for input)

**Dependencies**:
- requires: []
- blocks: [US-004, US-005, US-006]

---

#### US-002: Domain Name Input (Should Have)

**Priority**: Should-have
**Effort**: 0.5 days
**RICE Score**: 32

As a researcher, I want to specify a domain name for exploration so that I can discover cross-domain connections to my entire field.

**Acceptance Criteria**:
- Given a recognized domain name (e.g., computational biology), when I submit it, then the system begins domain-wide analysis
- Given an unrecognized domain name, when I submit it, then the system attempts to map it to known domains or requests clarification
- Given a domain name, when processing begins, then the system identifies key concepts, methods, and open problems in that domain

**Constraints Applied**:
- Initial domains limited to: computational-biology, materials-science, ml-ai
- Unknown domains should gracefully degrade to LLM general knowledge

**Dependencies**:
- requires: []
- blocks: [US-004, US-005, US-006]

---

#### US-003: Paper URL Input (Could Have)

**Priority**: Could-have
**Effort**: 0.5 days
**RICE Score**: 18

As a researcher, I want to input a paper URL (arXiv, DOI link) so that I can find cross-domain connections to a specific paper contribution.

**Acceptance Criteria**:
- Given a valid arXiv URL, when I submit it, then the system fetches the paper abstract and extracts key concepts
- Given an invalid or inaccessible URL, when I submit it, then the system returns an error with alternative input options
- Given a fetched paper, when analysis begins, then the paper domain, methods, and findings are extracted

**Constraints Applied**:
- Web fetch adds latency (warn user)
- Cannot fetch full paper content (abstract only for context budget)

**Dependencies**:
- requires: [Web search capability]
- blocks: [US-004]

---

### EPIC-002: Domain Analysis

#### US-004: Core Concept Extraction (Must Have)

**Priority**: Must-have
**Effort**: 0.75 days
**RICE Score**: 45

As the system, I want to extract core concepts from the input domain/question so that I can identify candidates for cross-domain matching.

**Acceptance Criteria**:
- Given a processed input, when domain analysis runs, then at least 3-5 core concepts are extracted
- Given extracted concepts, when returned, then each concept includes: name, description, domain tag, key properties
- Given a concept, when stored, then it is represented as flat tag with metadata
- Given concept extraction, when complete, then total tokens used is logged

**Constraints Applied**:
- Context budget: ~10K tokens for domain analysis
- Output format: flat tags (per GAP-002 decision)
- Must include concepts that have cross-domain potential

**Dependencies**:
- requires: [US-001 OR US-002 OR US-003]
- blocks: [US-007, US-008]

---

#### US-005: Method/Technique Extraction (Should Have)

**Priority**: Should-have
**Effort**: 0.5 days
**RICE Score**: 30

As the system, I want to identify methods and techniques used in the input domain so that I can find analogous approaches in other domains.

**Acceptance Criteria**:
- Given a processed input, when method extraction runs, then key methods/techniques are identified
- Given extracted methods, when returned, then each includes: name, purpose, domain, key steps
- Given methods, when analyzed, then methods with general applicability are flagged for cross-domain search

**Dependencies**:
- requires: [US-004]
- blocks: [US-007]

---

#### US-006: Open Problem Identification (Should Have)

**Priority**: Should-have
**Effort**: 0.75 days
**RICE Score**: 28

As the system, I want to identify open problems in the input domain so that I can target hypotheses at unsolved challenges.

**Acceptance Criteria**:
- Given a processed input, when problem identification runs, then known open problems are surfaced
- Given identified problems, when returned, then each includes: description, why it is hard, attempted approaches
- Given open problems, when prioritized, then problems with cross-domain solution potential are ranked higher

**Constraints Applied**:
- LLM knowledge cutoff may miss recent solutions
- Should use web search to verify problem is still open

**Dependencies**:
- requires: [US-004]
- blocks: [US-010]

---

### EPIC-003: Cross-Domain Search

#### US-007: Cross-Domain Analogy Finding (Must Have)

**Priority**: Must-have
**Effort**: 1 day
**RICE Score**: 50

As the system, I want to find concepts in other domains analogous to the source domain concepts so that I can generate cross-pollination hypotheses.

**Acceptance Criteria**:
- Given extracted concepts from source domain, when cross-domain search runs, then analogous concepts from other domains are identified
- Given a candidate analogy, when evaluated, then LLM-based similarity score (1-5) is computed
- Given similarity score >= 3, when recorded, then the analogy pair is retained for hypothesis generation
- Given an analogy pair, when stored, then reasoning for the connection is captured

**Constraints Applied**:
- Context budget: ~20K tokens per search
- Similarity metric: LLM-based (per GAP-003 decision)
- Must search across all three MVP domains

**Dependencies**:
- requires: [US-004]
- blocks: [US-010]

---

#### US-008: Similar Problem Retrieval (Should Have)

**Priority**: Should-have
**Effort**: 0.5 days
**RICE Score**: 25

As the system, I want to find problems in other domains that are structurally similar to source domain problems so that I can identify solutions that might transfer.

**Acceptance Criteria**:
- Given an open problem from source domain, when similar problem search runs, then structurally similar problems in other domains are identified
- Given a similar problem, when it has a known solution, then that solution is flagged as transfer candidate
- Given a problem pair, when matched, then the structural similarity is explained

**Dependencies**:
- requires: [US-006]
- blocks: [US-010]

---

#### US-009: Cross-Domain Paper Retrieval (Could Have)

**Priority**: Could-have
**Effort**: 1 day
**RICE Score**: 20

As the system, I want to retrieve relevant papers from other domains via web search so that I can ground hypotheses in real research.

**Acceptance Criteria**:
- Given an analogy pair, when paper retrieval runs, then relevant papers from both domains are searched
- Given search results, when processed, then paper titles, authors, and abstracts are extracted
- Given papers, when stored, then they serve as citation sources for hypotheses

**Constraints Applied**:
- Web search only (no direct paper API integration in MVP)
- Abstract only (full paper exceeds context budget)

**Dependencies**:
- requires: [US-007]
- blocks: [US-010]


---

### EPIC-004: Hypothesis Synthesis

#### US-010: Hypothesis Generation (Must Have)

**Priority**: Must-have
**Effort**: 1 day
**RICE Score**: 55

As the system, I want to generate candidate hypotheses from cross-domain connections so that I can provide researchers with novel research directions.

**Acceptance Criteria**:
- Given an analogy pair with score >= 3, when hypothesis generation runs, then at least one candidate hypothesis is generated
- Given a generated hypothesis, when structured, then it includes: source insight, target problem, proposed connection, expected outcome
- Given a hypothesis, when output, then it includes at least one citation source
- Given hypothesis generation, when complete, then hypotheses are passed to validation

**Constraints Applied**:
- Context budget: ~30K tokens per synthesis
- Must include citation (per BLOCK-002)
- Must be specific enough to test (Specificity dimension)

**Dependencies**:
- requires: [US-007]
- blocks: [US-014, US-015, US-016]

---

#### US-011: Hypothesis Structuring (Should Have)

**Priority**: Should-have
**Effort**: 0.5 days
**RICE Score**: 28

As the system, I want to structure hypotheses in a standardized format so that they are consistently actionable for researchers.

**Acceptance Criteria**:
- Given a raw hypothesis, when structured, then it follows the template: If [intervention] applied to [target domain problem], then [expected outcome], because [source domain evidence shows]
- Given a structured hypothesis, when validated, then it contains all required fields
- Given structuring, when complete, then ambiguous hypotheses are flagged for refinement

**Dependencies**:
- requires: [US-010]
- blocks: [US-014]

---

#### US-012: Experiment Suggestion (Could Have)

**Priority**: Could-have
**Effort**: 0.75 days
**RICE Score**: 22

As a researcher, I want each hypothesis to include a suggested experiment design so that I can quickly assess how to test it.

**Acceptance Criteria**:
- Given a validated hypothesis, when experiment suggestion runs, then a high-level experiment design is generated
- Given an experiment suggestion, when output, then it includes: method, variables, expected result, rough resource estimate
- Given experiment suggestion, when generated, then it considers feasibility constraints

**Dependencies**:
- requires: [US-010]
- blocks: []

---

#### US-013: Connection Validity Check (Should Have)

**Priority**: Should-have
**Effort**: 0.75 days
**RICE Score**: 35

As the system, I want to verify that cross-domain connections are semantically valid so that I filter out superficial keyword matches.

**Acceptance Criteria**:
- Given a hypothesis, when validity check runs, then the connection is evaluated for: structural analogy, functional parallel, or mere keyword overlap
- Given a superficial connection (score < 2 on validity), when detected, then the hypothesis is rejected with explanation
- Given a valid connection, when confirmed, then the reasoning is logged for traceability

**Constraints Applied**:
- Connection Validity dimension of quality rubric
- This is core to differentiation (per Strategy Doc)

**Dependencies**:
- requires: [US-010]
- blocks: [US-016]

---

### EPIC-005: Hypothesis Validation

#### US-014: Basic Validation (Must Have)

**Priority**: Must-have
**Effort**: 1 day
**RICE Score**: 48

As the system, I want to validate hypotheses for novelty and specificity so that I ensure minimum quality bar for output.

**Acceptance Criteria**:
- Given a hypothesis, when novelty check runs, then web search is performed for existing publications
- Given a direct match found, when detected, then hypothesis is flagged as potentially known with citation to existing work
- Given a hypothesis, when specificity check runs, then it is evaluated for testable variables and conditions
- Given a hypothesis failing specificity (score < 2), when detected, then it is rejected or sent for refinement
- Given validation complete, when output, then each hypothesis has novelty_status and specificity_score

**Constraints Applied**:
- Web search required for novelty (per SIG-001)
- Must not pass hypotheses that are obviously published

**Dependencies**:
- requires: [US-010]
- blocks: [US-016, US-017]

**Quality Gate**:
- Novelty: Web search returns no direct match
- Specificity: Score >= 2 on 1-5 scale

---

#### US-015: Feasibility Assessment (Should Have)

**Priority**: Should-have
**Effort**: 0.5 days
**RICE Score**: 24

As a researcher, I want to know if a hypothesis is practically testable so that I can prioritize actionable research directions.

**Acceptance Criteria**:
- Given a hypothesis, when feasibility assessment runs, then resource requirements are estimated
- Given a hypothesis requiring > 100K USD or > 1 year, when detected, then it is flagged as long-term/high-resource
- Given feasibility assessment, when complete, then each hypothesis has feasibility_score (1-5) and resource_estimate

**Constraints Applied**:
- Feasibility dimension of quality rubric
- Threshold: < 100K USD and < 1 year for feasible

**Dependencies**:
- requires: [US-014]
- blocks: [US-016]

---

#### US-016: Hypothesis Ranking (Could Have)

**Priority**: Could-have
**Effort**: 0.5 days
**RICE Score**: 20

As a researcher, I want hypotheses ranked by quality so that I can focus on the most promising ones first.

**Acceptance Criteria**:
- Given multiple validated hypotheses, when ranking runs, then they are sorted by composite quality score
- Given a hypothesis, when scored, then composite = weighted average of 5 quality dimensions
- Given ranking complete, when output, then hypotheses are presented in descending quality order

**Constraints Applied**:
- Quality rubric weights (per GAP-001 decision)

**Dependencies**:
- requires: [US-014, US-015, US-013]
- blocks: [US-017]

---

### EPIC-006: Output Formatting

#### US-017: Structured Hypothesis Output (Must Have)

**Priority**: Must-have
**Effort**: 0.5 days
**RICE Score**: 40

As a researcher, I want hypotheses output in a structured, readable format so that I can easily understand and act on them.

**Acceptance Criteria**:
- Given validated hypotheses, when output formatting runs, then each hypothesis is presented with all fields
- Given output, when displayed, then it includes: hypothesis statement, source insight, target problem, connection reasoning, citation, quality scores, timestamp
- Given CLI output, when rendered, then it is readable in terminal (proper line wrapping, sections)
- Given output, when complete, then AI-generation disclosure is included

**Constraints Applied**:
- Must include AI-generation disclosure (per Non-Negotiable #3)
- Must include citation (per BLOCK-002)
- CLI-only (no HTML/rich formatting)

**Dependencies**:
- requires: [US-014]
- blocks: []

---

#### US-018: Citation Formatting (Should Have)

**Priority**: Should-have
**Effort**: 0.5 days
**RICE Score**: 22

As a researcher, I want citations in standard academic format so that I can directly use them in my work.

**Acceptance Criteria**:
- Given a citation, when formatted, then it follows standard academic format (Author, Year, Title, Source)
- Given a web-sourced citation, when output, then URL and access date are included
- Given multiple citations, when output, then they are numbered and can be referenced

**Dependencies**:
- requires: [US-017]
- blocks: []


---

## MVP Definition

### MVP Scope

**Stories Included**:
- US-001: Research Question Input
- US-004: Core Concept Extraction
- US-007: Cross-Domain Analogy Finding
- US-010: Hypothesis Generation
- US-014: Basic Validation
- US-017: Structured Hypothesis Output

**Total Effort**: 4.75 days (fits within 8-hour constraint if days = implementation sessions)

### MVP Value Proposition

Researchers can input a research question and receive one or more cross-domain hypotheses with:
- Source domain insight with citation
- Target domain problem identification
- Proposed cross-domain connection with reasoning
- Basic validation (novelty checked via web search, specificity scored)
- Structured output with AI disclosure

### What MVP Excludes

| Excluded | Rationale | Workaround |
|----------|-----------|------------|
| Domain name input (US-002) | Question input sufficient for demo | User includes domain in question |
| Paper URL input (US-003) | Adds complexity, latency | User describes paper in question |
| Method extraction (US-005) | Concepts sufficient for MVP | Methods implicit in concepts |
| Open problem ID (US-006) | LLM can infer from question | User specifies problem in question |
| Similar problem retrieval (US-008) | Analogy finding covers this | Analogies serve same purpose |
| Paper retrieval (US-009) | Web search in validation sufficient | Single citation per hypothesis |
| Hypothesis structuring (US-011) | Basic structure in US-010 | Accept less polish |
| Experiment suggestion (US-012) | Nice to have, not core | User designs experiment |
| Connection validity (US-013) | Basic check in analogy finding | Accept some false positives |
| Feasibility assessment (US-015) | User can assess | Manual feasibility check |
| Hypothesis ranking (US-016) | Few hypotheses in MVP | User ranks manually |
| Citation formatting (US-018) | Basic citation in US-017 | User reformats |

### MVP Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| End-to-end completion | 1+ working examples | Demo execution |
| Hypothesis generated | At least 1 per input | Count output |
| Citation included | 100% of hypotheses | Verify presence |
| Cross-domain connection | 100% span 2+ domains | Verify domains differ |
| Specificity | >80% score >= 2 | Quality rubric |
| Novelty check | 100% web-searched | Verify search executed |
| Runtime | < 5 minutes per hypothesis | Time execution |
| AI disclosure | 100% of outputs | Verify presence |

### MVP Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Setup | 0.5 hours | Project structure, types, CLI skeleton |
| Domain Analysis | 1.5 hours | US-004 implemented |
| Cross-Domain Search | 2 hours | US-007 implemented |
| Hypothesis Generation | 2 hours | US-010 implemented |
| Validation | 1.5 hours | US-014 implemented |
| Output | 0.5 hours | US-017 implemented |
| Testing/Demo | 1 hour | End-to-end verification |

**Total**: ~9 hours (buffer for debugging)

---

## Dependency Map

Phase 1 - Input [parallel options]:
- US-001 Research Question Input
- US-002 Domain Name Input
- US-003 Paper URL Input
All feed into US-004

Phase 2 - Domain Analysis [sequential from input]:
- US-004 Core Concept Extraction (requires input)
- US-005 Method Extraction (requires US-004)
- US-006 Open Problem ID (requires US-004)

Phase 3 - Cross-Domain Search [parallel after US-004]:
- US-007 Cross-Domain Analogy (requires US-004)
- US-008 Similar Problem Retrieval (requires US-006)
- US-009 Paper Retrieval (requires US-007)

Phase 4 - Hypothesis Synthesis [after cross-domain]:
- US-010 Hypothesis Generation (requires US-007)
- US-011 Hypothesis Structuring (requires US-010)
- US-012 Experiment Suggestion (requires US-010)
- US-013 Connection Validity (requires US-010)

Phase 5 - Validation [sequential]:
- US-014 Basic Validation (requires US-010)
- US-015 Feasibility Assessment (requires US-014)
- US-016 Hypothesis Ranking (requires US-014, US-015, US-013)

Phase 6 - Output [after validation]:
- US-017 Structured Output (requires US-014)
- US-018 Citation Formatting (requires US-017)

### MVP Critical Path

US-001 -> US-004 -> US-007 -> US-010 -> US-014 -> US-017
Input -> Concepts -> Analogies -> Hypothesis -> Validate -> Output

---

## Out of Scope (v1)

### Explicitly Excluded Features

| Feature | Reason | Future Version |
|---------|--------|----------------|
| **Web UI** | 8-hour timeline, CLI sufficient for validation | v2 |
| **User accounts** | Single-user MVP | v2 |
| **Persistent storage** | Complexity, not needed for demo | v2 |
| **Multi-session memory** | Requires persistence | v2 |
| **Paper database integration** | Rate limit complexity, web search sufficient | v2 |
| **Visualization** | Requires UI | v2 |
| **Feedback learning** | Requires persistence + ML | v3 |
| **Collaborative features** | Multi-user | v3 |
| **Custom domain addition** | 3 domains sufficient for MVP | v2 |
| **Batch processing** | Single query sufficient | v2 |
| **Export formats** | CLI text output sufficient | v2 |
| **API server** | CLI-only scope | v2 |
| **Hypothesis comparison** | Complex UX | v2 |
| **Domain ontology** | Flat tags sufficient | v2 |
| **Embedding-based similarity** | LLM-based sufficient | v2 |

### Future Roadmap (Indicative)

**v2 (Post-validation)**:
- Web UI
- User accounts and persistence
- Paper database integration (Semantic Scholar, OpenAlex)
- Additional domains based on demand
- Hypothesis history and comparison
- Enhanced citation depth

**v3 (Scale)**:
- Feedback-driven improvement
- Collaborative features
- Custom domain addition
- Enterprise features (SSO, audit logs)
- API for integration


---

## Technical Constraints Summary

| Constraint | Value | Impact |
|------------|-------|--------|
| Context window | 200K tokens | Bounds synthesis complexity |
| Output tokens | 8K (default) | Limits hypothesis detail |
| Rate limit | 50 RPM (pro) | Sufficient for MVP |
| API cost budget | 50 USD MVP | Use Sonnet primarily |
| Timeline | 8 hours | Ruthless prioritization |
| Storage | None (in-memory) | Stateless design |
| Interface | CLI only | No browser deps |
| TypeScript | Strict mode | Type safety required |
| Domains | 3 (comp-bio, materials, ML) | Fixed for MVP |

---

## Quality Rubric (Complete)

### Hypothesis Quality Dimensions

| # | Dimension | Weight | 1 (Fail) | 2 (Weak) | 3 (Pass) | 4 (Good) | 5 (Excellent) |
|---|-----------|--------|----------|----------|----------|----------|---------------|
| 1 | **Specificity** | 25% | Vague statement, no testable claim | Has claim but missing variables or conditions | Testable claim with variables, unclear conditions | Clear variables and conditions, testable | Precise variables, conditions, expected outcome, measurable |
| 2 | **Novelty** | 20% | Direct match found in literature | Very similar work exists | No direct match, related work exists | Appears novel, no close matches | Verified novel, fills clear gap |
| 3 | **Connection Validity** | 25% | Superficial keyword match | Weak analogy, surface similarity | Moderate structural parallel | Strong functional/structural parallel | Deep isomorphism, multiple mapping points |
| 4 | **Feasibility** | 15% | Untestable with current technology | Requires > 1M USD or > 5 years | Testable with 100K-1M USD, 1-5 years | Testable with < 100K USD, < 1 year | Can test with existing resources, weeks |
| 5 | **Grounding** | 15% | No sources provided | Sources unverifiable | 1 verifiable source | Multiple verifiable sources | Comprehensive sources, both domains |

### Scoring

- **Composite Score** = Sum of (dimension_score x weight)
- **Pass Threshold**: Composite >= 3.0 AND no dimension < 2
- **MVP Target**: >40% of generated hypotheses pass

### Validation Process

1. **Automated checks**: Specificity (LLM), Novelty (web search), Grounding (citation presence)
2. **LLM evaluation**: Connection Validity (challenger prompt)
3. **Estimation**: Feasibility (LLM assessment)

---

## Output Template

The following template is used for hypothesis output (US-017):

================================================================================
HYPOTHESIS #[n] | Quality Score: [x.x]/5.0 | Generated: [timestamp]
================================================================================

HYPOTHESIS:
[If intervention applied to target domain problem, then expected outcome]

SOURCE INSIGHT:
- Domain: [source domain]
- Concept: [concept name]
- Key Finding: [description]
- Citation: [formatted citation]

TARGET PROBLEM:
- Domain: [target domain]
- Problem: [problem description]
- Current Approaches: [list]

CONNECTION:
[Why this cross-domain mapping is valid]

VALIDATION:
- Novelty: [PASS/FLAG] - [explanation]
- Specificity: [x]/5 - [explanation]
- Connection Validity: [x]/5 - [explanation]
- Feasibility: [x]/5 - [explanation]
- Grounding: [x]/5 - [explanation]

SUGGESTED EXPERIMENT:
[If available]

--------------------------------------------------------------------------------
AI-GENERATED: This hypothesis was generated by Synthesis Labs using Claude.
Verify all citations and claims before use in research.
================================================================================

---

## Type Definitions (Reference)

The following TypeScript interfaces define the core data structures:

**SynthesisInput**:
- type: question | domain | paper
- content: string
- timestamp: string

**ExtractedConcept**:
- id: string
- name: string
- domainTag: string
- description: string
- keyProperties: string[]
- crossDomainPotential: high | medium | low

**AnalogyPair**:
- id: string
- sourceConcept: ExtractedConcept
- targetConcept: ExtractedConcept
- similarityScore: number (1-5)
- connectionReasoning: string
- hypothesisAngle: string

**Citation**:
- title: string
- authors: string[] (optional)
- year: number (optional)
- source: string
- accessDate: string
- verified: boolean

**GeneratedHypothesis**:
- id: string
- sourceInsight: object with domain, concept, description, citation
- targetProblem: object with domain, problem, currentApproaches
- proposedConnection: string
- hypothesis: string
- expectedOutcome: string
- suggestedExperiment: string (optional)
- qualityScores: QualityScores
- generatedAt: string

**QualityScores**:
- specificity: number
- novelty: number
- connectionValidity: number
- feasibility: number
- grounding: number
- composite: number
- passesThreshold: boolean

**SynthesisOutput**:
- input: SynthesisInput
- hypotheses: GeneratedHypothesis[]
- metadata: object with domainsAnalyzed, analogiesConsidered, hypothesesGenerated, hypothesesPassed, processingTimeMs, tokensUsed, timestamp
- disclaimer: string

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-01-16 | prism-product-manager | Initial feature breakdown |

---

*Generated by prism-product-manager following Feature Decomposition and Prioritization Protocol*

*Source: STRATEGY.md (Market Strategy), CONSTRAINTS.md (Context Constraints)*

*Confidence: HIGH - All blocking gaps resolved with explicit decisions. MVP scope achievable within timeline constraint.*
