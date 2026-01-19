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
// Domain Normalization
// ============================================================================

/**
 * Maps common LLM-generated domain names to canonical DomainTag values.
 * Used to gracefully handle variations in LLM output.
 */
export const DOMAIN_ALIASES: Record<string, DomainTag> = {
  // ml-ai variations
  'ml-ai': 'ml-ai',
  'machine-learning': 'ml-ai',
  'machine learning': 'ml-ai',
  'machine-learning-ai': 'ml-ai',
  'machine learning & ai': 'ml-ai',
  'ml': 'ml-ai',
  'ai': 'ml-ai',
  'artificial-intelligence': 'ml-ai',
  'artificial intelligence': 'ml-ai',
  'deep-learning': 'ml-ai',
  'deep learning': 'ml-ai',

  // computational-biology variations
  'computational-biology': 'computational-biology',
  'computational biology': 'computational-biology',
  'comp-bio': 'computational-biology',
  'compbio': 'computational-biology',
  'bioinformatics': 'computational-biology',
  'biology': 'computational-biology',

  // materials-science variations
  'materials-science': 'materials-science',
  'materials science': 'materials-science',
  'material-science': 'materials-science',
  'material science': 'materials-science',
  'matsci': 'materials-science',
  'materials': 'materials-science',

  // economics-finance variations
  'economics-finance': 'economics-finance',
  'economics': 'economics-finance',
  'economics & finance': 'economics-finance',
  'finance': 'economics-finance',
  'econ': 'economics-finance',
  'financial': 'economics-finance',
  'economic': 'economics-finance',
  'markets': 'economics-finance',

  // social-systems variations
  'social-systems': 'social-systems',
  'social': 'social-systems',
  'social systems': 'social-systems',
  'sociology': 'social-systems',
  'social-science': 'social-systems',
  'social science': 'social-systems',
  'governance': 'social-systems',
  'policy': 'social-systems',

  // physics-engineering variations
  'physics-engineering': 'physics-engineering',
  'physics': 'physics-engineering',
  'physics & engineering': 'physics-engineering',
  'engineering': 'physics-engineering',
  'mechanical': 'physics-engineering',
  'electrical': 'physics-engineering',

  // climate-environment variations
  'climate-environment': 'climate-environment',
  'climate': 'climate-environment',
  'climate & environment': 'climate-environment',
  'environment': 'climate-environment',
  'environmental': 'climate-environment',
  'ecology': 'climate-environment',
  'sustainability': 'climate-environment',

  // healthcare-medicine variations
  'healthcare-medicine': 'healthcare-medicine',
  'healthcare': 'healthcare-medicine',
  'healthcare & medicine': 'healthcare-medicine',
  'medicine': 'healthcare-medicine',
  'medical': 'healthcare-medicine',
  'health': 'healthcare-medicine',
  'clinical': 'healthcare-medicine',

  // cognitive-science variations
  'cognitive-science': 'cognitive-science',
  'cognitive': 'cognitive-science',
  'cognitive science': 'cognitive-science',
  'neuroscience': 'cognitive-science',
  'psychology': 'cognitive-science',
  'cognition': 'cognitive-science',
  'brain': 'cognitive-science',

  // information-systems variations
  'information-systems': 'information-systems',
  'information': 'information-systems',
  'information systems': 'information-systems',
  'computing': 'information-systems',
  'informatics': 'information-systems',
  'software': 'information-systems',
  'computer-science': 'information-systems',
  'computer science': 'information-systems',

  // other variations
  'other': 'other',
  'other / interdisciplinary': 'other',
  'general': 'other',
  'interdisciplinary': 'other',
  'misc': 'other',
};

/**
 * Normalizes a domain string to a valid DomainTag.
 * Handles common LLM variations and typos gracefully.
 *
 * @param domain - The domain string from LLM output
 * @param fallback - Fallback domain if normalization fails
 * @returns A valid DomainTag
 */
export function normalizeDomain(domain: unknown, fallback: DomainTag): DomainTag {
  if (!domain || typeof domain !== 'string') return fallback;

  const lower = domain.toLowerCase().trim();

  // Check aliases (case-insensitive)
  if (lower in DOMAIN_ALIASES) return DOMAIN_ALIASES[lower];

  // Check if it's already a valid tag
  if (SUPPORTED_DOMAINS.includes(domain as DomainTag)) {
    return domain as DomainTag;
  }

  // Fuzzy matching: try to find partial matches (require min 4 chars to avoid false positives)
  for (const [alias, tag] of Object.entries(DOMAIN_ALIASES)) {
    if (alias.length >= 4 && (lower.includes(alias) || alias.includes(lower))) {
      return tag;
    }
  }

  return fallback;
}

/**
 * Recursively normalizes all domain fields in an object.
 * Used to process entire LLM response objects.
 *
 * @param obj - Object containing domain fields
 * @param fallback - Fallback domain for normalization
 * @returns Object with normalized domain fields
 */
export function normalizeDomainsInObject<T>(obj: T, fallback: DomainTag): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeDomainsInObject(item, fallback)) as T;
  }

  const result = { ...obj } as Record<string, unknown>;

  for (const [key, value] of Object.entries(result)) {
    if (key === 'domain' || key === 'sourceDomain' || key === 'targetDomain') {
      result[key] = normalizeDomain(value, fallback);
    } else if (key === 'targetDomains' && Array.isArray(value)) {
      result[key] = value.map((d) => normalizeDomain(d, fallback));
    } else if (typeof value === 'object' && value !== null) {
      result[key] = normalizeDomainsInObject(value, fallback);
    }
  }

  return result as T;
}

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
