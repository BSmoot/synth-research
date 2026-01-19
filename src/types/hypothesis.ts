/**
 * Hypothesis types for Synthesis Labs
 */

import { z } from 'zod';
import {
  CitationSchema,
  DomainTagSchema,
} from './domains.js';
import { CrossDomainConnectionSchema, ConfidenceLevelSchema } from './connections.js';

// ============================================================================
// Hypothesis Status
// ============================================================================

export const HypothesisStatusSchema = z.enum([
  'raw',
  'challenged',
  'validated',
  'rejected',
]);

export type HypothesisStatus = z.infer<typeof HypothesisStatusSchema>;

// ============================================================================
// Hypothesis Components
// ============================================================================

export const HypothesisComponentsSchema = z.object({
  insight: z.string(),
  application: z.string(),
  mechanism: z.string(),
  prediction: z.string(),
});

export type HypothesisComponents = z.infer<typeof HypothesisComponentsSchema>;

// ============================================================================
// Experiment Requirements
// ============================================================================

export const ExperimentRequirementsSchema = z.object({
  dataSources: z.array(z.string()),
  expertise: z.array(z.string()),
  infrastructure: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
});

export type ExperimentRequirements = z.infer<typeof ExperimentRequirementsSchema>;

// ============================================================================
// Research Suggestion
// ============================================================================

export const ResearchSuggestionTypeSchema = z.enum([
  'literature-review',
  'data-gathering',
  'expert-consultation',
  'preliminary-modeling',
]);

export type ResearchSuggestionType = z.infer<typeof ResearchSuggestionTypeSchema>;

export const ResearchEffortSchema = z.enum([
  'minimal',
  'moderate',
  'substantial',
]);

export type ResearchEffort = z.infer<typeof ResearchEffortSchema>;

export const ResearchSuggestionSchema = z.object({
  type: ResearchSuggestionTypeSchema,
  scope: z.string(),
  questions: z.array(z.string()),
  sources: z.array(z.string()),
  estimatedEffort: ResearchEffortSchema,
});

export type ResearchSuggestion = z.infer<typeof ResearchSuggestionSchema>;

// ============================================================================
// Experiment Suggestion
// ============================================================================

export const ExperimentSuggestionSchema = z.object({
  title: z.string(),
  objective: z.string(),
  methodology: z.string(),
  expectedOutcome: z.string(),
  requirements: ExperimentRequirementsSchema,
  successCriteria: z.array(z.string()),
});

export type ExperimentSuggestion = z.infer<typeof ExperimentSuggestionSchema>;

// ============================================================================
// Dimension Scores
// ============================================================================

export const DimensionScoreSchema = z.object({
  score: z.number().min(1).max(5),
  weight: z.number(),
  explanation: z.string(),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const HypothesisScoresSchema = z.object({
  specificity: DimensionScoreSchema,
  novelty: DimensionScoreSchema,
  connectionValidity: DimensionScoreSchema,
  feasibility: DimensionScoreSchema,
  grounding: DimensionScoreSchema,
  composite: z.number(),
});

export type HypothesisScores = z.infer<typeof HypothesisScoresSchema>;

// ============================================================================
// Hypothesis
// ============================================================================

export const HypothesisSchema = z.object({
  id: z.string(),
  title: z.string(),
  statement: z.string(),

  sourceDomain: DomainTagSchema,
  targetDomain: DomainTagSchema,
  connection: CrossDomainConnectionSchema,

  components: HypothesisComponentsSchema,

  confidence: ConfidenceLevelSchema,
  citations: z.array(CitationSchema),
  suggestedExperiment: ExperimentSuggestionSchema.optional(),
  suggestedResearch: z.array(ResearchSuggestionSchema).optional(),

  generatedAt: z.string().transform((s) => new Date(s)),
  status: HypothesisStatusSchema,
});

export type Hypothesis = z.infer<typeof HypothesisSchema>;

// ============================================================================
// Scored Hypothesis
// ============================================================================

export const VerdictSchema = z.enum(['pass', 'borderline', 'fail']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const ScoredHypothesisSchema = HypothesisSchema.extend({
  scores: HypothesisScoresSchema,
  verdict: VerdictSchema,
  challengeNotes: z.array(z.string()),
});

export type ScoredHypothesis = z.infer<typeof ScoredHypothesisSchema>;

// ============================================================================
// Ranked Hypothesis
// ============================================================================

export const RankedHypothesisSchema = ScoredHypothesisSchema.extend({
  rank: z.number(),
});

export type RankedHypothesis = z.infer<typeof RankedHypothesisSchema>;
