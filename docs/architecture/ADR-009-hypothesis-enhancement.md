# ADR-009: Hypothesis Generation Enhancement

**Status**: Proposed
**Date**: 2026-01-19

---

## Context

The current hypothesis generation system produces research hypotheses with experiment suggestions that include hard-coded budget estimates and timeline estimates. User feedback indicates several issues:

1. **Budget estimates are unreliable**: LLM-generated dollar amounts are essentially guesses that may mislead researchers about actual costs
2. **Missing lightweight research suggestions**: Not every hypothesis needs a full experiment - some benefit from preliminary investigation first
3. **Limited domain coverage**: The current 11 domains miss potentially valuable cross-pollination sources

### Current Implementation Analysis

**ExperimentSuggestion Schema** (src/types/hypothesis.ts:42-53):

The current schema includes a resourceEstimate object with timeMonths, budgetUSD (defaulting to $100K-$500K), and expertise array.

**Hard-coded fallbacks** (src/agents/hypothesis-synthesizer.ts:368-376):

The normalizeResourceEstimate method defaults budgetUSD to $100K-$500K when not provided.

**Current domain coverage** (src/types/domains.ts:11-23):
- computational-biology, materials-science, ml-ai, economics-finance
- social-systems, physics-engineering, climate-environment
- healthcare-medicine, cognitive-science, information-systems, other

**Missing domains with high cross-pollination potential**:
- Pure mathematics (game theory, topology, probability)
- Law and governance (contract theory, regulatory frameworks)
- Anthropology and history (cultural evolution, historical economics)
- Philosophy and ethics (decision theory, value theory)

### Files Affected

Primary:
- src/types/hypothesis.ts - Schema changes
- src/types/domains.ts - New domains and aliases
- src/agents/hypothesis-synthesizer.ts - Prompt and normalization updates
- src/cli.ts - Output format updates

Secondary:
- src/types/index.ts - Re-exports
- docs/architecture/ADR-003-knowledge-representation.md - Update for new schema

Tests:
- tests/unit/hypothesis-challenger.test.ts - Update fixtures
- New test file for domain normalization

## Decision

Implement a **three-part enhancement** to hypothesis generation:

### 1. Replace resourceEstimate with requirements object

Remove speculative budget/timeline estimates. Replace with actionable requirements that describe what is actually needed.

New ExperimentRequirementsSchema:
- dataSources: string[] - Required data sources
- expertise: string[] - Required expertise/partnerships
- infrastructure: string[] - Required infrastructure/tools
- dependencies: string[] - Key dependencies or prerequisites
- risks: string[] - Known risks/unknowns

Updated ExperimentSuggestionSchema:
- title: string
- objective: string
- methodology: string
- expectedOutcome: string
- requirements: ExperimentRequirementsSchema (replaces resourceEstimate)
- successCriteria: string[]

### 2. Add ResearchSuggestion type for preliminary investigation

Create a lighter-weight suggestion type for hypotheses that need preliminary research before full experiments.

ResearchSuggestionTypeSchema enum:
- literature-review - Survey existing work
- data-gathering - Collect relevant datasets
- expert-consultation - Identify and consult domain experts
- preliminary-modeling - Build initial models/simulations

ResearchEffortSchema enum:
- minimal - Hours to days, single person
- moderate - Days to weeks, small team
- substantial - Weeks to months, dedicated effort

ResearchSuggestionSchema:
- type: ResearchSuggestionTypeSchema
- scope: string - What to investigate
- questions: string[] - Specific questions to answer
- sources: string[] - Where to look
- estimatedEffort: ResearchEffortSchema

### 3. Update HypothesisSchema to include both suggestion types

Add to HypothesisSchema:
- suggestedExperiment: ExperimentSuggestionSchema.optional()
- suggestedResearch: z.array(ResearchSuggestionSchema).optional()

A hypothesis can have both, either, or neither suggestion type.

### 4. Add four new domains

Extend DomainTagSchema and SUPPORTED_DOMAINS with:

| Domain | Name | Description | SubDomains |
|--------|------|-------------|------------|
| mathematics | Mathematics | Pure and applied mathematics, formal systems | game-theory, topology, probability, optimization, category-theory |
| law-governance | Law and Governance | Legal systems, regulatory frameworks, institutional design | contract-theory, regulatory-design, constitutional-law, international-law |
| anthropology-history | Anthropology and History | Human societies, cultural evolution, historical systems | cultural-anthropology, economic-history, historical-economics, archaeology |
| philosophy-ethics | Philosophy and Ethics | Decision theory, moral philosophy, epistemology, value theory | decision-theory, ethics, epistemology, philosophy-of-science, value-theory |

Domain Aliases for new domains:
- mathematics: math, maths, game-theory, topology, probability
- law-governance: law, legal, governance, regulatory, contract-theory
- anthropology-history: anthropology, history, historical, cultural
- philosophy-ethics: philosophy, ethics, moral, decision-theory

Note: governance alias moves from social-systems to law-governance.

### 5. Update hypothesis-synthesizer prompt

Modify the system prompt to request the new structure:

For suggestedExperiment (high-confidence hypotheses):
- Include requirements object with dataSources, expertise, infrastructure, dependencies, risks
- Remove budget and timeline estimates

For suggestedResearch (any hypothesis, especially lower confidence):
- type: one of the four research types
- scope: what to investigate
- questions: specific questions to answer
- sources: where to look
- estimatedEffort: minimal, moderate, or substantial

### 6. Update CLI output formatting

Update formatResults() to display:
- Suggested Research section with type, scope, effort, questions, and sources
- Suggested Experiment section with title, methodology, and requirements breakdown

## Rationale

### Requirements over Budget Estimates

1. **Actionability**: "Need access to protein structure databases" is more useful than "$200K"
2. **Honesty**: LLMs cannot accurately estimate research costs
3. **Decision support**: Requirements help researchers assess feasibility in their context
4. **Auditability**: Requirements can be validated; budget guesses cannot

### Research Suggestions

1. **Lower barrier to entry**: Not every interesting hypothesis needs a full experiment
2. **Future capability**: System could pursue literature reviews in future sessions
3. **Incremental validation**: Preliminary research can filter hypotheses before expensive experiments
4. **Diverse investigation types**: Different hypotheses need different preliminary work

### New Domains

1. **Mathematics**: Provides formal frameworks, game theory for incentive analysis, topology for structure
2. **Law-Governance**: Contract theory parallels in many domains, regulatory insight for policy-adjacent research
3. **Anthropology-History**: Historical precedents, cultural evolution patterns, long-term system dynamics
4. **Philosophy-Ethics**: Decision theory foundations, ethical frameworks, epistemological rigor

These domains were selected for:
- High cross-pollination potential with existing domains
- Strong theoretical foundations useful for hypothesis framing
- Underrepresented in typical ML/science research tools

## Consequences

### Positive

- More actionable experiment suggestions
- Lighter-weight research path for preliminary investigation
- Broader cross-pollination possibilities
- Removes misleading budget estimates
- Future-proofs for autonomous research capability

### Negative

- Breaking change to trace file format (schema version bump required)
- Existing traces with resourceEstimate will fail validation
- CLI output becomes longer with new fields
- LLM prompt is more complex (may affect generation quality)

### Risks

- **Risk**: LLM may not generate structured requirements well
  **Mitigation**: Provide detailed examples in prompt; normalize/fallback in parser

- **Risk**: New domains may have poor representation in LLM training
  **Mitigation**: Include rich domain metadata; monitor cross-pollination quality

- **Risk**: ResearchSuggestion may be redundant with hypothesis components
  **Mitigation**: Clear distinction: components explain the hypothesis, research suggests next steps

## Implementation Notes

### Migration Strategy

1. **Schema version bump**: Increment SCHEMA_VERSION in src/types/schema-version.ts from 1.1.0 to 1.2.0

2. **Backwards compatibility**: Add migration function for old traces that converts resourceEstimate to requirements format, preserving expertise array.

3. **Deprecation path**: Keep resourceEstimate parsing in synthesizer for one release cycle, log deprecation warning

### Implementation Order

1. Add new schemas to src/types/hypothesis.ts
2. Add new domains to src/types/domains.ts
3. Update src/agents/hypothesis-synthesizer.ts prompt and normalizers
4. Update src/cli.ts output formatting
5. Update tests
6. Bump schema version
7. Update ADR-003 documentation

### Test Updates

Create mock fixtures for:
- ExperimentSuggestion with requirements object
- ResearchSuggestion with each type
- Hypotheses using new domains

### CLI Help Update

Update --help output to include new domains:
- mathematics: Mathematics
- law-governance: Law and Governance
- anthropology-history: Anthropology and History
- philosophy-ethics: Philosophy and Ethics

## Alternatives Considered

### Alternative 1: Keep budget estimates with confidence intervals

Add uncertainty ranges like "$100K-$500K (low confidence)".

**Rejected**: Still misleading; the confidence is always low for LLM-generated budgets.

### Alternative 2: Remove experiment suggestions entirely

Focus only on hypothesis generation, let researchers plan experiments.

**Rejected**: Experiment suggestions add value when framed as requirements rather than cost estimates.

### Alternative 3: Add all potentially useful domains at once

Add 10+ new domains including art, music, literature, etc.

**Rejected**: Start with domains most likely to have cross-pollination value; expand based on usage.

### Alternative 4: Separate schema for research vs experiment suggestions

Create distinct top-level fields instead of optional fields on Hypothesis.

**Rejected**: Current approach is cleaner - both are suggestions for next steps, differing in scope.

## Confidence

**HIGH** - The requirements replacement is a clear improvement over speculative budgets. New domains are well-motivated additions. ResearchSuggestion adds capability without removing existing functionality.

The main uncertainty is LLM generation quality for the new structured requirements, which can be tuned with prompt engineering and normalizer fallbacks.
