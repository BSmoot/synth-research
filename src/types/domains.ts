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
  'economics-finance',
  'social-systems',
  'physics-engineering',
  'climate-environment',
  'healthcare-medicine',
  'cognitive-science',
  'information-systems',
  'other',
]);

export type DomainTag = z.infer<typeof DomainTagSchema>;

export const SUPPORTED_DOMAINS: DomainTag[] = [
  'computational-biology',
  'materials-science',
  'ml-ai',
  'economics-finance',
  'social-systems',
  'physics-engineering',
  'climate-environment',
  'healthcare-medicine',
  'cognitive-science',
  'information-systems',
  'other',
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
  'economics-finance': {
    tag: 'economics-finance',
    name: 'Economics & Finance',
    description: 'Economic systems, financial markets, and monetary policy',
    subDomains: [
      'macroeconomics',
      'microeconomics',
      'financial-markets',
      'behavioral-economics',
      'econometrics',
    ],
    keyJournals: [
      'American Economic Review',
      'Journal of Finance',
      'Econometrica',
    ],
    majorConferences: ['AEA', 'NBER', 'WFA'],
  },
  'social-systems': {
    tag: 'social-systems',
    name: 'Social Systems',
    description: 'Social structures, governance, and institutional dynamics',
    subDomains: [
      'sociology',
      'political-science',
      'public-policy',
      'urban-systems',
      'organizational-behavior',
    ],
    keyJournals: [
      'American Sociological Review',
      'American Political Science Review',
      'Social Forces',
    ],
    majorConferences: ['ASA', 'APSA', 'ICA'],
  },
  'physics-engineering': {
    tag: 'physics-engineering',
    name: 'Physics & Engineering',
    description: 'Physical principles and engineering applications',
    subDomains: [
      'quantum-mechanics',
      'thermodynamics',
      'mechanical-engineering',
      'electrical-engineering',
      'aerospace',
    ],
    keyJournals: [
      'Physical Review Letters',
      'Nature Physics',
      'IEEE Transactions',
    ],
    majorConferences: ['APS', 'IEEE', 'ASME'],
  },
  'climate-environment': {
    tag: 'climate-environment',
    name: 'Climate & Environment',
    description: 'Climate systems, environmental science, and sustainability',
    subDomains: [
      'climate-modeling',
      'ecology',
      'environmental-policy',
      'renewable-energy',
      'carbon-systems',
    ],
    keyJournals: [
      'Nature Climate Change',
      'Environmental Science & Technology',
      'Global Change Biology',
    ],
    majorConferences: ['AGU', 'EGU', 'UNFCCC COP'],
  },
  'healthcare-medicine': {
    tag: 'healthcare-medicine',
    name: 'Healthcare & Medicine',
    description: 'Medical practice, healthcare systems, and clinical research',
    subDomains: [
      'clinical-medicine',
      'epidemiology',
      'healthcare-systems',
      'diagnostics',
      'therapeutics',
    ],
    keyJournals: [
      'New England Journal of Medicine',
      'The Lancet',
      'JAMA',
    ],
    majorConferences: ['ASCO', 'ACC', 'IDWeek'],
  },
  'cognitive-science': {
    tag: 'cognitive-science',
    name: 'Cognitive Science',
    description: 'Cognition, neuroscience, and psychological processes',
    subDomains: [
      'neuroscience',
      'psychology',
      'cognitive-neuroscience',
      'behavioral-science',
      'consciousness-studies',
    ],
    keyJournals: [
      'Nature Neuroscience',
      'Psychological Science',
      'Cognitive Science',
    ],
    majorConferences: ['SfN', 'CogSci', 'APS'],
  },
  'information-systems': {
    tag: 'information-systems',
    name: 'Information Systems',
    description: 'Computing systems, software, and information technology',
    subDomains: [
      'databases',
      'cybersecurity',
      'software-engineering',
      'distributed-systems',
      'human-computer-interaction',
    ],
    keyJournals: [
      'ACM Transactions on Information Systems',
      'IEEE Transactions on Software Engineering',
      'Information Systems Research',
    ],
    majorConferences: ['SIGMOD', 'ICSE', 'CHI'],
  },
  'other': {
    tag: 'other',
    name: 'Other / Interdisciplinary',
    description: 'Interdisciplinary or uncategorized research areas',
    subDomains: [
      'interdisciplinary',
      'general-science',
      'emerging-fields',
    ],
    keyJournals: [
      'Science',
      'Nature',
      'PNAS',
    ],
    majorConferences: ['AAAS', 'Interdisciplinary'],
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
