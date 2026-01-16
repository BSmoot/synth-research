/**
 * Type exports for Synthesis Labs
 */

export * from './domains.js';
export * from './connections.js';
export * from './hypothesis.js';
export * from './tokens.js';
export * from './trace.js';

// ============================================================================
// User Query
// ============================================================================

import { z } from 'zod';
import { DomainTagSchema } from './domains.js';

export const UserQuerySchema = z.object({
  text: z.string().min(10),
  targetDomain: DomainTagSchema.optional(),
});

export type UserQuery = z.infer<typeof UserQuerySchema>;

// ============================================================================
// Synthesis Output
// ============================================================================

import { RankedHypothesisSchema } from './hypothesis.js';

export const StageResultSchema = z.object({
  stage: z.string(),
  status: z.enum(['success', 'partial', 'error']),
  durationMs: z.number(),
  message: z.string().optional(),
});

export type StageResult = z.infer<typeof StageResultSchema>;

export const SynthesisOutputSchema = z.object({
  traceId: z.string(),
  query: z.string(),
  domain: DomainTagSchema,

  hypotheses: z.array(RankedHypothesisSchema),

  metadata: z.object({
    totalGenerated: z.number(),
    totalValidated: z.number(),
    totalRejected: z.number(),
    executionTimeMs: z.number(),
    stages: z.array(StageResultSchema),
    tokenUsage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    }).optional(),
    costEstimate: z.object({
      usd: z.number(),
    }).optional(),
  }),

  warnings: z.array(z.string()),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;
