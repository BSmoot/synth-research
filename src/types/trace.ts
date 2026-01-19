/**
 * Trace types for Synthesis Labs
 */

import { z } from 'zod';
import { TokenUsageSchema } from './tokens.js';
import { SCHEMA_VERSION } from './schema-version.js';

// ============================================================================
// Trace Entry
// ============================================================================

export const TraceEntrySchema = z.object({
  stage: z.string(),
  agent: z.string(),
  model: z.string(),
  timestamp: z.string().datetime(),
  input: z.object({
    system: z.string(),
    user: z.string(),
  }),
  output: z.object({
    raw: z.string(),
    parsed: z.unknown().optional(),
  }),
  usage: TokenUsageSchema,
  durationMs: z.number().nonnegative(),
});

export type TraceEntry = z.infer<typeof TraceEntrySchema>;

// ============================================================================
// Trace Metadata
// ============================================================================

export const TraceMetadataSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  traceId: z.string(),
  query: z.string(),
  domain: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  totalTokens: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  costUsd: z.number().nonnegative(),
});

export type TraceMetadata = z.infer<typeof TraceMetadataSchema>;
