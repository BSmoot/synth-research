# ADR-003: Knowledge Representation

**Status**: Accepted
**Date**: 2026-01-16

---

## Context

Need to define how domains, concepts, hypotheses, and their relationships are represented in the system. Key requirements:
- Support 3 fixed domains: computational-biology, materials-science, ml-ai
- Enable cross-domain similarity detection
- Structure hypotheses for scoring and presentation
- Fit within LLM context window limits

## Decision

Use **structured TypeScript types** with flat domain tags and rich concept/hypothesis schemas:

### Domain Representation

```typescript
// Flat string tags with optional sub-domain notation
type DomainTag =
  | 'computational-biology'
  | 'materials-science'
  | 'ml-ai';

type SubDomainTag = string; // e.g., 'ml-ai.reinforcement-learning'

interface Domain {
  tag: DomainTag;
  subDomains: SubDomainTag[];
  description: string;
  keyJournals: string[];
  majorConferences: string[];
}

const SUPPORTED_DOMAINS: Record<DomainTag, Domain> = {
  'computational-biology': {
    tag: 'computational-biology',
    subDomains: ['genomics', 'proteomics', 'drug-discovery', 'crispr', 'systems-biology'],
    description: 'Computational approaches to biological problems',
    keyJournals: ['Nature Methods', 'Bioinformatics', 'PLOS Computational Biology'],
    majorConferences: ['ISMB', 'RECOMB', 'ECCB'],
  },
  'materials-science': {
    tag: 'materials-science',
    subDomains: ['nanomaterials', 'polymers', 'semiconductors', 'biomaterials', 'composites'],
    description: 'Study of material properties and design',
    keyJournals: ['Nature Materials', 'Advanced Materials', 'ACS Nano'],
    majorConferences: ['MRS', 'TMS', 'ICMCTF'],
  },
  'ml-ai': {
    tag: 'ml-ai',
    subDomains: ['deep-learning', 'reinforcement-learning', 'nlp', 'computer-vision', 'optimization'],
    description: 'Machine learning and artificial intelligence',
    keyJournals: ['JMLR', 'Nature Machine Intelligence'],
    majorConferences: ['NeurIPS', 'ICML', 'ICLR'],
  },
};
```

### Concept Representation

```typescript
interface Concept {
  id: string; // crypto.randomUUID()
  name: string;
  domain: DomainTag;
  subDomain?: SubDomainTag;
  description: string;
  type: ConceptType;
  relatedConcepts: string[]; // concept IDs
  sources: Citation[];
}

type ConceptType =
  | 'method'      // How something is done
  | 'phenomenon'  // Observable pattern
  | 'problem'     // Open challenge
  | 'tool'        // Software/hardware
  | 'theory'      // Explanatory framework
  | 'metric';     // Measurement approach
```

### Cross-Domain Connection

```typescript
interface CrossDomainConnection {
  id: string;
  sourceConcept: Concept;
  targetConcept: Concept;
  connectionType: ConnectionType;
  similarityScore: number; // 1-5 scale
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

type ConnectionType =
  | 'analogous-problem'    // Same problem, different domain
  | 'transferable-method'  // Method from A could work in B
  | 'shared-structure'     // Similar mathematical/conceptual structure
  | 'complementary-tools'  // Tools that could combine
  | 'causal-parallel';     // Similar causal mechanisms
```

### Hypothesis Representation

```typescript
interface Hypothesis {
  id: string;
  title: string;
  statement: string; // The actual hypothesis claim

  // Cross-domain connection
  sourceDomain: DomainTag;
  targetDomain: DomainTag;
  connection: CrossDomainConnection;

  // Structured components
  components: {
    insight: string;      // What we're borrowing
    application: string;  // Where we're applying it
    mechanism: string;    // Why it might work
    prediction: string;   // What we'd expect to see
  };

  // Validation
  scores: HypothesisScores;
  citations: Citation[];
  suggestedExperiment?: ExperimentSuggestion;

  // Metadata
  generatedAt: Date;
  status: 'raw' | 'challenged' | 'validated' | 'rejected';
}

interface HypothesisScores {
  specificity: DimensionScore;
  novelty: DimensionScore;
  connectionValidity: DimensionScore;
  feasibility: DimensionScore;
  grounding: DimensionScore;
  composite: number; // Weighted average
}

interface DimensionScore {
  score: number;      // 1-5
  weight: number;     // From rubric
  explanation: string;
}
```

### Citation Representation

```typescript
interface Citation {
  id: string;
  type: 'paper' | 'preprint' | 'book' | 'website' | 'llm-knowledge';
  title: string;
  authors?: string[];
  year?: number;
  venue?: string;
  url?: string;
  doi?: string;
  relevance: string; // Why this citation supports the claim
  verified: boolean; // Whether we confirmed it exists
}
```

### Experiment Suggestion

```typescript
interface ExperimentSuggestion {
  title: string;
  objective: string;
  methodology: string;
  expectedOutcome: string;
  resourceEstimate: {
    timeMonths: number;
    budgetUSD: string; // e.g., '$10K-50K'
    expertise: string[];
  };
  successCriteria: string[];
}
```

### Domain Analysis Output

```typescript
interface DomainAnalysis {
  domain: DomainTag;
  query: string;

  concepts: Concept[];
  methods: Concept[]; // Filtered by type === 'method'
  openProblems: Concept[]; // Filtered by type === 'problem'

  keyInsights: string[];
  researchFrontiers: string[];

  analyzedAt: Date;
}
```

## Rationale

1. **Flat domain tags**: Simple, extensible, avoids taxonomy complexity for MVP.

2. **Rich concept types**: Distinguish methods from problems from tools. Enables targeted cross-pollination.

3. **Structured hypothesis components**: Makes hypotheses more actionable. Insight/application/mechanism/prediction template.

4. **Explicit scores per dimension**: Transparency in validation. Users can see why a hypothesis scored how it did.

5. **Citation with verification flag**: Acknowledges we can't guarantee all citations. Honest about LLM knowledge limits.

## Consequences

### Positive
- Type-safe throughout codebase
- Clear structure for LLM prompts
- Easy to serialize/display
- Extensible for future domains

### Negative
- Some overhead in type definitions
- May over-structure creative process
- Fixed concept types may miss edge cases

### Risks
- Concept extraction may not fit cleanly into types
- LLM may generate malformed structures

**Mitigation**: Use Zod for runtime validation; allow 'other' concept type

## Implementation Notes

```typescript
// Use Zod for runtime validation
import { z } from 'zod';

const HypothesisSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(10).max(200),
  statement: z.string().min(50).max(1000),
  sourceDomain: z.enum(['computational-biology', 'materials-science', 'ml-ai']),
  targetDomain: z.enum(['computational-biology', 'materials-science', 'ml-ai']),
  // ... etc
});

// Validate LLM output
function parseHypothesis(raw: unknown): Hypothesis {
  return HypothesisSchema.parse(raw);
}
```

## Confidence

**HIGH** - Standard TypeScript patterns with Zod validation
