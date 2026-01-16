# Synthesis Labs - Strategy Document

**Status**: Proposed
**Confidence**: MEDIUM
**Date**: 2026-01-16

---

## Executive Summary

Synthesis Labs should position as **cross-domain hypothesis infrastructure** targeting interdisciplinary research programs at R1 universities and well-funded research institutions. The opportunity exists because existing AI research tools optimize for within-domain retrieval (finding papers in your field) rather than across-domain synthesis (connecting your problem to solutions from unrelated fields).

**Recommended Strategy**: Launch with a focused wedge in computational biology + materials science intersection, targeting principal investigators running cross-department grants, then expand domain coverage based on demonstrated hypothesis quality.

---

## Market Context

### Market Size

| Segment | Size | Source/Basis |
|---------|------|--------------|
| **TAM** | $12.4B | Global academic research software market (2025), growing 11.2% CAGR [ASSUMPTION: extrapolated from Verified Market Research 2023 report] |
| **SAM** | $2.1B | Research discovery and AI-assisted research tools segment [ASSUMPTION: 17% of TAM based on analyst category splits] |
| **SOM** | $42M-85M | Interdisciplinary research programs with budget for specialized tools (est. 4-8% of SAM) |

**SOM Calculation Basis**:
- ~4,500 R1/research-intensive universities globally
- ~15% run significant interdisciplinary programs (675 institutions)
- Average research software budget per interdisciplinary program: $25K-50K/year
- Realistic capture: 5-10% of this segment in years 1-3

**Key Assumption**: [ASSUMPTION] The addressable market depends heavily on whether hypothesis generation is perceived as a legitimate software category. Current spend is zero because the category does not exist yet. This is both risk (no proven demand) and opportunity (category creation).

### Competitive Landscape

| Competitor | Type | Positioning | Strength | Our Advantage |
|------------|------|-------------|----------|---------------|
| **Semantic Scholar** | Direct | AI-powered research discovery | 200M+ papers indexed, free, strong brand | We synthesize, they retrieve |
| **Elicit** | Direct | AI research assistant | Strong QA on literature, good UX | They answer questions; we generate questions worth asking |
| **Consensus** | Direct | AI-powered scientific search | Claim extraction, evidence synthesis | Single-domain focus; we specialize in cross-domain |
| **ResearchRabbit** | Indirect | Citation network visualization | Free, viral | Visual similarity vs. conceptual synthesis |
| **Connected Papers** | Indirect | Citation graph exploration | Simple, free, widely used | Same-field only; we cross domain boundaries |
| **Perplexity Pro** | Substitute | General AI search with citations | Fast, broad | Generalist vs. specialist |
| **ChatGPT + Scholar** | Substitute | Manual workflow | Familiar, flexible | Requires expert prompter; we encode methodology |

### Competitive Gap Analysis

**What is Missing in Current Tools**:

1. **Cross-domain by design**: All major tools optimize for within-field discovery.
2. **Hypothesis-first output**: None produce structured, testable hypotheses as primary output.
3. **Synthesis over retrieval**: Current tools are retrieval-augmented; we need synthesis-first.
4. **Validation built-in**: No tool challenges its own outputs for superficiality.

**Competitive Moat Assessment**:
- **Weak moat**: Cross-domain search is not technically defensible
- **Medium moat**: Methodology for validating hypothesis quality requires research
- **Strong moat**: Domain-specific context accumulation over time

### Timing Factors

| Factor | Impact | Assessment |
|--------|--------|------------|
| **LLM capability maturation** | Positive | Claude/GPT-4 class models now capable of genuine synthesis |
| **Research funding pressure** | Positive | Increasing emphasis on convergence research (NSF, NIH) |
| **AI research tool adoption** | Positive | Elicit, Consensus adoption normalizes AI tools |
| **Hallucination concerns** | Negative | Researchers skeptical of AI-generated claims |
| **Academic publishing pressure** | Mixed | Could drive demand OR skepticism |

**Timing Assessment**: FAVORABLE - Window is 18-24 months before major players add cross-domain features.

---

## Target Users

### Primary Segment: Interdisciplinary Principal Investigators

**Who**: Faculty leading research programs spanning multiple departments/disciplines.

**Job-to-be-done**: When writing a grant proposal or launching new research direction, I want to find non-obvious connections to other fields that could strengthen my methodology.

**Current solution**: Manual literature review, conference conversations, Google Scholar alerts, hiring diverse postdocs.

**Pain points**:
- I know the answer probably exists in another field, but I do not know what to search for
- I spent 6 months on an approach materials science solved in 1998
- Reviewers want innovative but my field methods are saturated

**Willingness to pay signals**:
- Already pay $5K-25K for research software
- Grant budgets include other direct costs for tools
- Time savings translates to grant competitiveness

### Secondary Segment: Research Directors / Chief Science Officers

**Who**: Leaders at research institutes, corporate R&D labs, or research foundations managing research portfolios.

**Job-to-be-done**: When reviewing research portfolio, identify opportunities for cross-pollination between our own programs.

**Pain points**:
- Our genomics team and ML team never talk - I bet there is overlap
- We funded 50 projects; I cannot read 50 literatures deeply enough
- How do I manufacture serendipity?

**Willingness to pay signals**:
- Institutional budgets for research infrastructure
- Mandate to demonstrate synergy to boards/funders
- High cost of missed opportunities

### Anti-Persona: Individual Graduate Students

**Why not target**: Limited budget, working within established paradigms, need to prove competence in one domain first. May be future customers but not initial wedge.

---

## Strategic Recommendation

### Positioning: Cross-Pollination Infrastructure for Research

**Category**: Research hypothesis generation (new category)

**Differentiation**: Not a search tool. Not a writing assistant. A **synthesis engine** that generates testable hypotheses by connecting problems in one domain to solutions in another.

**Tagline candidates**:
- Find the research worth doing
- Connections you would not have thought to look for
- Your field problem. Another field solution.

### Value Proposition

**For interdisciplinary researchers** who need novel research directions,
**Synthesis Labs** is a **hypothesis generation platform**
**That** surfaces non-obvious connections between domains and generates specific, testable research hypotheses
**Unlike** literature search tools (Semantic Scholar, Elicit) that find papers within your field
**Our product** generates ideas across fields, validates them for genuine connections, and outputs experiment-ready hypotheses.

### Why This, Why Now

1. **Technical enabler**: LLM capabilities crossed threshold for genuine synthesis.
2. **Funding tailwind**: NSF Growing Convergence Research, NIH interdisciplinary grants create demand.
3. **Adoption precedent**: Elicit and Consensus normalized AI research tools.
4. **Competitive window**: 18-24 months before serious competitive response.

### Initial Wedge Strategy

**Domains**: Computational biology + Materials science + ML/AI

**Why these three**:
- High cross-pollination potential (methods transfer frequently)
- Active interdisciplinary research community
- Grant funding actively encourages domain mixing

**Go-to-market**:
1. **Phase 1 (Months 1-6)**: Build and validate with 10-15 friendly PIs.
2. **Phase 2 (Months 6-12)**: Expand to 50-100 paid pilots.
3. **Phase 3 (Months 12-18)**: Add domains based on demand.

**Pricing hypothesis** [ASSUMPTION: requires validation]:
- Individual researcher: $99-199/month
- Lab license (5-10 users): $399-799/month
- Institutional: Custom, $10K-50K/year

---

## Success Metrics

**North Star Metric**: Hypotheses validated as worth pursuing by domain experts

| Metric Type | Metric | Target (Year 1) | Rationale |
|-------------|--------|-----------------|-----------|
| Leading | Hypotheses generated per active user/week | >5 | Sufficient output |
| Leading | Cross-domain connections per hypothesis | >3 | Genuine synthesis |
| Lagging | Expert validation rate | >40% | Are we generating good ideas? |
| Lagging | Monthly active researchers | 500 | User base for iteration |
| Guardrail | Superficial connection rate | <20% | Quality control |
| Guardrail | Existing publication match rate | <10% | Novelty check |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Hypotheses are superficial** | Medium | High | Heavy investment in challenger agent; expert validation loop |
| **Researchers distrust AI ideation** | Medium | High | Transparent sourcing; position as starting point |
| **Big player enters category** | Medium | Medium | Move fast to establish methodology moat |
| **Limited willingness to pay** | Medium | Medium | Validate in pilot; consider freemium |
| **Domain expansion costly** | Low | Medium | Domain-agnostic core with pluggable specialists |
| **Hallucination liability** | Low | High | Strong disclaimers; traceability; challenger agent |

---

## Resource Implications

### Team Requirements (Year 1)

| Role | Count | Rationale |
|------|-------|-----------|
| ML/Research Engineer | 2 | Agent development, synthesis methodology |
| Full-stack Engineer | 1 | Interface, infrastructure |
| Domain Expert (rotating) | 0.5 FTE | Hypothesis quality validation |
| Product/GTM | 1 | Researcher relationships, pilot management |

**Total**: 4-5 FTE equivalent

### Key Dependencies

- **LLM API access**: Claude API with sufficient context window
- **Research corpus**: Semantic Scholar API, OpenAlex, or similar
- **Expert network**: PIs willing to validate hypothesis quality
- **Web search**: For real-time retrieval and novelty checking

### Investment Estimate

- **Year 1**: $500K-800K (team + infrastructure + API costs)
- **Path to revenue**: Month 6 (pilot pricing), Month 12 (meaningful revenue)
- **Path to sustainability**: Month 18-24 [ASSUMPTION: depends on pricing validation]

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| **General research assistant (Elicit)** | Red ocean; well-funded competitors |
| **Citation network tool (ResearchRabbit)** | Hard to monetize; no synthesis capability |
| **Research writing assistant** | Commoditizing rapidly; low differentiation |
| **Industry R&D focus first** | Longer sales cycles; academic validates methodology |
| **Broad domain coverage from day 1** | Spreads thin; delays learning |

---

## Open Questions

| Question | Owner | Blocking? |
|----------|-------|-----------|
| What hypothesis quality bar is acceptable? | Product/Research | Yes - must validate in pilot |
| Can cross-domain synthesis work reliably with current LLMs? | Engineering | Yes - core feasibility |
| What pricing will researchers accept? | Product | No - can iterate |
| Which domains have highest cross-pollination potential? | Research | No - affects expansion priority |
| How to measure genuine vs. superficial connections? | Research | Yes - core to challenger design |

---

## Assumptions Log

| Assumption | Confidence | Validation Plan |
|------------|------------|-----------------|
| [ASSUMPTION: TAM extrapolated from 2023 report] | Medium | Validate with 2025 research |
| [ASSUMPTION: 17% of TAM is discovery/ideation] | Low | Primary research needed |
| [ASSUMPTION: SOM capture 5-10% realistic] | Low | Pilot conversion data |
| [ASSUMPTION: Pricing validated] | Low | Pricing experiments |
| [ASSUMPTION: 18-24 month competitive window] | Medium | Monitor competitor roadmaps |
| [ASSUMPTION: LLMs can perform genuine synthesis] | Medium | Technical validation in MVP |
| [ASSUMPTION: Researchers will adopt new category] | Medium | Early adopter interviews |

---

## Handoff to Guardian

```yaml
strategist_handoff:
  sd_reference: docs/specs/STRATEGY.md
  
  strategic_constraints:
    - constraint: Cross-domain synthesis must be genuine, not superficial keyword matching
      type: user
      flexibility: hard
    - constraint: All connections must be traceable to sources
      type: business
      flexibility: hard
    - constraint: Initial domains - computational biology, materials science, ML/AI
      type: market
      flexibility: negotiable
    - constraint: Hypothesis quality validation rate >40%
      type: user
      flexibility: hard
    - constraint: Must work within LLM context window limits
      type: technical
      flexibility: hard
  
  integration_points:
    - system: Planned agent constellation (6 agents)
      relationship: Strategy informs agent roles and success criteria
    - system: Web search / paper retrieval
      relationship: Required for cross-domain discovery and novelty checking
    - system: LLM API (Claude)
      relationship: Core reasoning capability; context window constrains synthesis scope
  
  guardian_focus_areas:
    - LLM API constraints (rate limits, context windows, costs)
    - Paper metadata API constraints (Semantic Scholar, OpenAlex)
    - Web search API constraints for real-time retrieval
    - TypeScript/Node.js platform constraints
  
  blocking_questions:
    - Can current LLM architecture support genuine cross-domain synthesis?
    - What paper corpus access is available, and what are usage limits?
```

---

*Grounded in: PROJECT_CONTEXT.md, agent templates*

*Confidence: MEDIUM - Market sizing uses extrapolated data with explicit assumptions. Competitive analysis is current but landscape moves fast. Core thesis requires validation through MVP.*
