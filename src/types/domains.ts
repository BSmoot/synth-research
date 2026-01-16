/**
 * Domain representation types for Synthesis Labs
 */

import { z } from 'zod';

// ============================================================================
// Domain Tags
// ============================================================================

export const DomainTagSchema = z.enum([
  'computational-biology',
  'materials-science',
  'ml-ai',
]);

export type DomainTag = z.infer<typeof DomainTagSchema>;

export const SUPPORTED_DOMAINS: DomainTag[] = [
  'computational-biology',
  'materials-science',
  'ml-ai',
];

// ============================================================================
// Domain Metadata
// ============================================================================

export interface DomainMetadata {
  tag: DomainTag;
  name: string;
  description: string;
  subDomains: string[];
  keyJournals: string[];
  majorConferences: string[];
}

export const DOMAIN_METADATA: Record<DomainTag, DomainMetadata> = {
  'computational-biology': {
    tag: 'computational-biology',
    name: 'Computational Biology',
    description: 'Computational approaches to biological problems',
    subDomains: [
      'genomics',
      'proteomics',
      'drug-discovery',
      'crispr',
      'systems-biology',
    ],
    keyJournals: [
      'Nature Methods',
      'Bioinformatics',
      'PLOS Computational Biology',
    ],
    majorConferences: ['ISMB', 'RECOMB', 'ECCB'],
  },
  'materials-science': {
    tag: 'materials-science',
    name: 'Materials Science',
    description: 'Study of material properties and design',
    subDomains: [
      'nanomaterials',
      'polymers',
      'semiconductors',
      'biomaterials',
      'composites',
    ],
    keyJournals: ['Nature Materials', 'Advanced Materials', 'ACS Nano'],
    majorConferences: ['MRS', 'TMS', 'ICMCTF'],
  },
  'ml-ai': {
    tag: 'ml-ai',
    name: 'Machine Learning & AI',
    description: 'Machine learning and artificial intelligence',
    subDomains: [
      'deep-learning',
      'reinforcement-learning',
      'nlp',
      'computer-vision',
      'optimization',
    ],
    keyJournals: ['JMLR', 'Nature Machine Intelligence'],
    majorConferences: ['NeurIPS', 'ICML', 'ICLR'],
  },
};

// ============================================================================
// Concept Types
// ============================================================================

export const ConceptTypeSchema = z.enum([
  'method',
  'phenomenon',
  'problem',
  'tool',
  'theory',
  'metric',
]);

export type ConceptType = z.infer<typeof ConceptTypeSchema>;

// ============================================================================
// Citation Types
// ============================================================================

export const CitationTypeSchema = z.enum([
  'paper',
  'preprint',
  'book',
  'website',
  'llm-knowledge',
]);

export type CitationType = z.infer<typeof CitationTypeSchema>;

export const CitationSchema = z.object({
  id: z.string(),
  type: CitationTypeSchema,
  title: z.string(),
  authors: z.array(z.string()).optional(),
  year: z.number().optional(),
  venue: z.string().optional(),
  url: z.string().optional(),
  doi: z.string().optional(),
  relevance: z.string(),
  verified: z.boolean(),
});

export type Citation = z.infer<typeof CitationSchema>;

// ============================================================================
// Concept Schema
// ============================================================================

export const ConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: DomainTagSchema,
  subDomain: z.string().optional(),
  description: z.string(),
  type: ConceptTypeSchema,
  relatedConcepts: z.array(z.string()),
  sources: z.array(CitationSchema),
});

export type Concept = z.infer<typeof ConceptSchema>;

// ============================================================================
// Domain Analysis Result
// ============================================================================

export const DomainAnalysisSchema = z.object({
  domain: DomainTagSchema,
  query: z.string(),
  concepts: z.array(ConceptSchema),
  methods: z.array(ConceptSchema),
  openProblems: z.array(ConceptSchema),
  keyInsights: z.array(z.string()),
  researchFrontiers: z.array(z.string()),
  analyzedAt: z.string().transform((s) => new Date(s)),
});

export type DomainAnalysis = z.infer<typeof DomainAnalysisSchema>;
