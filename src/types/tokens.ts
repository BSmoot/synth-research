/**
 * Token usage tracking types for Synthesis Labs
 */

import { z } from 'zod';

// ============================================================================
// Token Usage Schemas
// ============================================================================

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const AgentTokenUsageSchema = z.object({
  agent: z.string(),
  model: z.string(),
  usage: TokenUsageSchema,
  timestamp: z.string().datetime(),
});

export type AgentTokenUsage = z.infer<typeof AgentTokenUsageSchema>;

export const AccumulatedTokenUsageSchema = z.object({
  total: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  byAgent: z.record(
    z.string(),
    z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    })
  ),
  byModel: z.record(
    z.string(),
    z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    })
  ),
});

export type AccumulatedTokenUsage = z.infer<typeof AccumulatedTokenUsageSchema>;

export const CostEstimateSchema = z.object({
  usd: z.number().nonnegative(),
  byModel: z.record(z.string(), z.number().nonnegative()),
});

export type CostEstimate = z.infer<typeof CostEstimateSchema>;

// ============================================================================
// Model Pricing (per 1M tokens)
// ============================================================================

export const MODEL_PRICING = {
  'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75 },
} as const;

export type ModelId = keyof typeof MODEL_PRICING;
