/**
 * Cross-domain connection types for Synthesis Labs
 */

import { z } from 'zod';
import { ConceptSchema, DomainTagSchema } from './domains.js';

// ============================================================================
// Connection Types
// ============================================================================

export const ConnectionTypeSchema = z.enum([
  'analogous-problem',
  'transferable-method',
  'shared-structure',
  'complementary-tools',
  'causal-parallel',
]);

export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

export const CONNECTION_TYPE_DESCRIPTIONS: Record<ConnectionType, string> = {
  'analogous-problem': 'Same problem appearing in different domain',
  'transferable-method': 'Method from one domain could solve problem in another',
  'shared-structure': 'Similar mathematical or conceptual structure',
  'complementary-tools': 'Tools that could combine productively',
  'causal-parallel': 'Similar causal mechanisms at play',
};

// ============================================================================
// Cross-Domain Connection
// ============================================================================

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const CrossDomainConnectionSchema = z.object({
  id: z.string(),
  sourceConcept: ConceptSchema,
  targetConcept: ConceptSchema,
  connectionType: ConnectionTypeSchema,
  similarityScore: z.number().min(1).max(5),
  explanation: z.string(),
  confidence: ConfidenceLevelSchema,
  potentialApplication: z.string().optional(),
});

export type CrossDomainConnection = z.infer<typeof CrossDomainConnectionSchema>;

// ============================================================================
// Pollination Result
// ============================================================================

export const CrossPollinationResultSchema = z.object({
  sourceDomain: DomainTagSchema,
  targetDomains: z.array(DomainTagSchema),
  connections: z.array(CrossDomainConnectionSchema),
  summary: z.object({
    totalConnections: z.number(),
    byType: z.record(ConnectionTypeSchema, z.number()),
    byTargetDomain: z.record(DomainTagSchema, z.number()),
    averageSimilarity: z.number(),
  }),
});

export type CrossPollinationResult = z.infer<typeof CrossPollinationResultSchema>;
