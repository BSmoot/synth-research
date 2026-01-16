# Synthesis Labs - Open Items

> Unresolved questions and blockers

---

## Open Questions

### [OPEN-001] Domain Representation Schema

**Priority**: High (Blocks Phase 2)
**Owner**: Unassigned
**Status**: Open

**Question**:
How should we represent a "domain" in the system? What attributes define a research domain?

**Options Considered**:
1. **Flat tags**: Simple string labels (e.g., "computational-biology", "reinforcement-learning")
2. **Hierarchical taxonomy**: Tree structure (Biology → Computational Biology → CRISPR)
3. **Concept graph**: Network of related concepts with edge weights
4. **Embedding space**: Vector representations for semantic similarity

**Current Thinking**:
Concept graph seems most flexible for cross-domain mapping, but adds complexity. May start with flat tags for MVP and evolve.

**Blocked By**: Architecture design phase
**Blocks**: Agent implementation

---

### [OPEN-002] Cross-Domain Similarity Metric

**Priority**: High (Blocks Phase 2)
**Owner**: Unassigned
**Status**: Open

**Question**:
How do we measure if two concepts from different domains are "analogous" enough to be useful for cross-pollination?

**Options Considered**:
1. **LLM-based**: Ask Claude to rate similarity
2. **Embedding distance**: Cosine similarity in embedding space
3. **Structural**: Similar problem shapes (optimization, search, classification)
4. **Historical**: Past successful cross-domain transfers

**Current Thinking**:
LLM-based is most accessible for MVP. Could combine with embedding distance for ranking.

**Blocked By**: Architecture design phase
**Blocks**: Cross-pollinator agent design

---

### [OPEN-003] Hypothesis Novelty Verification

**Priority**: Medium
**Owner**: Unassigned
**Status**: Open

**Question**:
How do we verify a generated hypothesis is actually novel and not already published?

**Options Considered**:
1. **Web search**: Search for similar research
2. **Paper databases**: Query arXiv, PubMed, etc.
3. **LLM knowledge check**: Ask if this has been done
4. **Deferred to user**: Present hypothesis, user verifies

**Current Thinking**:
Combination of LLM knowledge check + web search. Perfect novelty detection is infeasible; focus on high-confidence filtering.

**Blocked By**: None
**Blocks**: Hypothesis-challenger agent design

---

### [OPEN-004] External API Dependencies

**Priority**: Medium
**Owner**: Unassigned
**Status**: Open

**Question**:
What external APIs (beyond Claude) should we integrate for live research retrieval?

**Options Considered**:
1. **arXiv API**: Free, good coverage for ML/physics
2. **Semantic Scholar**: Broad coverage, citation graph
3. **PubMed**: Bio/medical focus
4. **Google Scholar**: Broadest but harder to access
5. **None for MVP**: Use LLM knowledge + web search only

**Current Thinking**:
Start with web search only. Add Semantic Scholar if time permits (has good API).

**Blocked By**: None
**Blocks**: Evidence-gatherer implementation (optional)

---

## Resolved Items

(Move items here when resolved, with resolution summary)

---

## Blockers

| Item | Blocked By | Impact |
|------|-----------|--------|
| Agent implementation | Architecture design | Cannot start coding without schemas |
| Cross-pollinator | Similarity metric decision | Core algorithm depends on this |

---

## Next Actions

1. Complete Phase 1 (Product Definition) to clarify requirements
2. Use apex-architect to make schema decisions
3. Document decisions in DECISION_LOG.md
