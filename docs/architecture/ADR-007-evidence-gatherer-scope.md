# ADR-007: Evidence Gatherer Descoping

**Status**: Proposed
**Date**: 2026-01-17

---

## Context

The Evidence Gatherer agent was planned in ADR-001 and ADR-002 as a pipeline stage responsible for:

1. Finding supporting citations for validated hypotheses
2. Verifying paper references exist
3. Assessing evidence strength (strong/moderate/weak)
4. Distinguishing verified citations from LLM-only knowledge

Current state of implementation:
- Agent specification exists: `.claude/agents/evidence-gatherer.md`
- Agent appears in ADR-001 topology diagram (marked "optional")
- Agent appears in ADR-002 data flow diagram
- **No implementation exists in `src/agents/`**
- **No orchestrator integration in `src/orchestrator/synthesis-orchestrator.ts`**

Current citation handling:
- Citations generated during domain analysis and hypothesis synthesis
- All citations marked as `type: "llm-knowledge"` by default (`src/agents/domain-analyst.ts` line 243)
- No external verification or web search integration
- CLI displays disclaimer about `llm-knowledge` citations (`src/cli.ts` line 311)

Relevant code locations:
- `.claude/agents/evidence-gatherer.md`: Full agent specification (215 lines)
- `src/types/domains.ts`: Citation type enum (line 111) includes `llm-knowledge`
- `src/agents/domain-analyst.ts`: Default citation handling (lines 230-263)

## Decision

**Formally descope the Evidence Gatherer agent from v1.0 release.**

The agent will remain in the architecture documentation as a planned future enhancement, but:
- No implementation work for v1.0
- No orchestrator integration for v1.0
- All citations remain `llm-knowledge` type for v1.0
- CLI disclaimer about citation verification is sufficient for v1.0

### Rationale for Descoping

1. **Scope containment**: The core value proposition (cross-domain hypothesis generation) is delivered without evidence gathering. Adding it now delays v1.0 release.

2. **External dependencies**: Proper evidence gathering requires web search API integration (e.g., Semantic Scholar, arXiv, Google Scholar). These add complexity, cost, and rate-limiting concerns.

3. **Verification accuracy**: LLM-based citation verification is unreliable. Hallucinated papers are difficult to detect without external API access. Better to be explicit about limitations.

4. **User expectations**: The current disclaimer ("Citations marked as llm-knowledge should be verified before use") sets appropriate expectations. Users understand they must verify.

5. **Incremental value**: Evidence gathering can be added in v1.1 without breaking changes. The Citation interface already supports the required fields.

### v1.0 Citation Strategy

```typescript
// All citations in v1.0 use this structure
interface Citation {
  id: string;
  type: "llm-knowledge";  // Only type used in v1.0
  title: string;
  authors?: string[];     // Optional, from LLM knowledge
  year?: number;          // Optional, from LLM knowledge
  venue?: string;         // Optional, from LLM knowledge
  url?: string;           // Empty in v1.0
  doi?: string;           // Empty in v1.0
  relevance: string;      // Why this supports the claim
  verified: false;        // Always false in v1.0
}
```

CLI output will display:

```
Note: All hypotheses require independent verification.
Citations marked as "llm-knowledge" should be verified before use.
```

### Future Evidence Gatherer (v1.1+)

When implemented, the Evidence Gatherer will:

1. **Accept scored hypotheses** from Hypothesis Challenger
2. **Search external APIs** for supporting papers:
   - Semantic Scholar API (free, good coverage)
   - arXiv API (preprints)
   - CrossRef (DOI verification)
3. **Verify LLM-claimed citations** exist
4. **Add new citations** discovered via search
5. **Update citation type** from `llm-knowledge` to `paper`/`preprint`
6. **Set verified flag** to `true` for confirmed citations
7. **Calculate evidence strength** (strong/moderate/weak)

Integration will use the existing agent interface pattern:

```typescript
// Future orchestrator integration
if (this.config.enableEvidenceGatherer) {
  const evidenceResult = await this.withRetry(() =>
    this.evidenceGatherer.execute({
      hypotheses: scoredHypotheses.filter(h => h.verdict !== "fail"),
      citationsPerHypothesis: 3,
    })
  );
  context.setEvidencedHypotheses(evidenceResult.evidencedHypotheses);
}
```

## Consequences

### Positive
- v1.0 release unblocked
- Simpler architecture for initial release
- No external API dependencies for v1.0
- Honest about citation limitations
- Clean upgrade path when implementing later

### Negative
- Hypotheses lack verified external evidence
- Users must manually verify citations
- Lower Grounding scores in hypothesis evaluation (always "LLM knowledge only")
- Some users may expect citation verification

### Risks
- **Risk**: Users treat LLM citations as verified
  **Mitigation**: Clear disclaimer in CLI output and documentation

- **Risk**: Low perceived quality without verified citations
  **Mitigation**: Focus messaging on hypothesis novelty and cross-domain insight, not citation count

- **Risk**: Competitive disadvantage vs tools with citation features
  **Mitigation**: Plan v1.1 release with evidence gathering; the architecture is designed for it

## Implementation Notes

Files to update for v1.0:
- None required - current behavior is correct

Documentation to update:
- `README.md`: Clarify citation limitations in Features section
- `.claude/agents/evidence-gatherer.md`: Add header noting "Planned for v1.1"
- `docs/architecture/ADR-001-system-overview.md`: Keep "(optional)" tag on evidence-gatherer

Configuration preparation for v1.1:
```typescript
interface OrchestratorConfig {
  // ... existing config
  enableEvidenceGatherer?: boolean;  // Default: false in v1.0
}
```

## Confidence

**HIGH** - Clear scope decision with defined upgrade path. No technical debt introduced; the agent specification and type definitions are already in place for future implementation.

