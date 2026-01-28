/**
 * Integration types for Hypothesis Integration Enhancement (ADR-010)
 */

import { z } from 'zod';
import { ScoredHypothesisSchema } from './hypothesis.js';
import { DomainTagSchema } from './domains.js';

// ============================================================================
// Clustering Types
// ============================================================================

export const ClusteringCriterionSchema = z.enum([
  'shared-mechanism',
  'complementary-predictions',
  'common-domain-pair',
  'related-concepts',
]);

export type ClusteringCriterion = z.infer<typeof ClusteringCriterionSchema>;

export const HypothesisClusterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  hypothesisIds: z.array(z.string()),
  criterion: ClusteringCriterionSchema,
  coherenceScore: z.number().min(0).max(1),
  summary: z.string(),
});

export type HypothesisCluster = z.infer<typeof HypothesisClusterSchema>;

// ============================================================================
// Integrated Theory Types
// ============================================================================

export const IntegratedTheorySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  hypothesisIds: z.array(z.string()),
  sourceDomains: z.array(DomainTagSchema),
  targetDomain: DomainTagSchema,
  unifiedMechanism: z.string(),
  syntheticPredictions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  suggestedValidation: z.string().optional(),
});

export type IntegratedTheory = z.infer<typeof IntegratedTheorySchema>;

// ============================================================================
// Dependency Types
// ============================================================================

export const DependencyTypeSchema = z.enum([
  'prerequisite',
  'supports',
  'conflicts-with',
  'refines',
]);

export type DependencyType = z.infer<typeof DependencyTypeSchema>;

export const HypothesisDependencySchema = z.object({
  id: z.string().uuid(),
  sourceHypothesisId: z.string(),
  targetHypothesisId: z.string(),
  type: DependencyTypeSchema,
  explanation: z.string(),
  strength: z.number().min(0).max(1),
});

export type HypothesisDependency = z.infer<typeof HypothesisDependencySchema>;

// ============================================================================
// Query Coverage Types
// ============================================================================

export const QueryRequirementSchema = z.object({
  id: z.string().uuid(),
  requirement: z.string(),
  type: z.enum(['conceptual', 'methodological', 'empirical', 'theoretical']),
  priority: z.enum(['critical', 'important', 'optional']),
});

export type QueryRequirement = z.infer<typeof QueryRequirementSchema>;

export const QueryCoverageSchema = z.object({
  requirements: z.array(QueryRequirementSchema),
  coverage: z.array(
    z.object({
      requirementId: z.string().uuid(),
      hypothesisIds: z.array(z.string()),
      coverageScore: z.number().min(0).max(1),
      gaps: z.array(z.string()),
    })
  ),
  overallCoverage: z.number().min(0).max(1),
  recommendations: z.array(z.string()),
});

export type QueryCoverage = z.infer<typeof QueryCoverageSchema>;

// ============================================================================
// Integration Request/Result
// ============================================================================

export const IntegrationRequestSchema = z.object({
  hypotheses: z.array(ScoredHypothesisSchema),
  query: z.string(),
  domain: DomainTagSchema,
});

export type IntegrationRequest = z.infer<typeof IntegrationRequestSchema>;

export const IntegrationResultSchema = z.object({
  clusters: z.array(HypothesisClusterSchema),
  integratedTheories: z.array(IntegratedTheorySchema),
  dependencies: z.array(HypothesisDependencySchema),
  queryCoverage: QueryCoverageSchema,
  metadata: z.object({
    totalHypotheses: z.number(),
    totalClusters: z.number(),
    totalTheories: z.number(),
    totalDependencies: z.number(),
    averageCoherence: z.number().min(0).max(1),
  }),
});

export type IntegrationResult = z.infer<typeof IntegrationResultSchema>;
