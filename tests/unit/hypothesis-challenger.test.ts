/**
 * Unit tests for HypothesisChallengerAgent
 * Focus: Parallel hypothesis evaluation (ADR-006)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import {
  HypothesisChallengerAgent,
  ChallengeRequest,
  ChallengeResult,
  ParallelConfig,
} from '../../src/agents/hypothesis-challenger.js';
import type { Hypothesis, ScoredHypothesis } from '../../src/types/index.js';

// Mock fixtures
const createMockHypothesis = (id: string): Hypothesis => ({
  id,
  title: `Test Hypothesis ${id}`,
  statement: `This is a test statement for ${id}`,
  sourceDomain: 'ml-ai',
  targetDomain: 'computational-biology',
  connection: {
    id: `conn-${id}`,
    sourceConcept: {
      id: `source-concept-${id}`,
      domain: 'ml-ai',
      name: 'Test Concept',
      description: 'Test description',
      type: 'method',
      relatedConcepts: [],
      sources: [],
    },
    targetConcept: {
      id: `target-concept-${id}`,
      domain: 'computational-biology',
      name: 'Target Concept',
      description: 'Target description',
      type: 'problem',
      relatedConcepts: [],
      sources: [],
    },
    connectionType: 'shared-structure',
    similarityScore: 4,
    explanation: 'Test connection',
    confidence: 'medium',
    potentialApplication: 'Test application',
  },
  components: {
    insight: 'Test insight',
    application: 'Test application',
    mechanism: 'Test mechanism',
    prediction: 'Test prediction',
  },
  confidence: 'medium',
  citations: [],
  generatedAt: new Date('2026-01-17').toISOString(),
  status: 'raw',
});

const createMockScoredHypothesis = (
  id: string,
  verdict: 'pass' | 'borderline' | 'fail' = 'borderline'
): ScoredHypothesis => ({
  ...createMockHypothesis(id),
  scores: {
    specificity: { score: 4, weight: 0.25, explanation: 'Test specificity' },
    novelty: { score: 3, weight: 0.2, explanation: 'Test novelty' },
    connectionValidity: { score: 4, weight: 0.25, explanation: 'Test validity' },
    feasibility: { score: 3, weight: 0.15, explanation: 'Test feasibility' },
    grounding: { score: 2, weight: 0.15, explanation: 'Test grounding' },
    composite: 3.45,
  },
  verdict,
  challengeNotes: ['Test note'],
  status: 'challenged',
});

// Testable subclass
class TestableChallengerAgent extends HypothesisChallengerAgent {
  public testGetParallelConfig(
    hypothesisCount: number,
    override?: ParallelConfig
  ): Required<ParallelConfig> {
    return (this as any).getParallelConfig(hypothesisCount, override);
  }

  public testCreateBatches<T>(items: T[], batchSize: number): T[][] {
    return (this as any).createBatches(items, batchSize);
  }

  public testMergeResults(batchResults: any[]): ChallengeResult {
    return (this as any).mergeResults(batchResults);
  }

  public async testEvaluateParallel(
    hypotheses: Hypothesis[],
    config: Required<ParallelConfig>
  ): Promise<ChallengeResult> {
    return (this as any).evaluateParallel(hypotheses, config);
  }
}

const createMockClient = () =>
  ({
    messages: {
      create: vi.fn(),
    },
  }) as unknown as Anthropic;

// Helper to create text response format (for callLLM with JSON parsing)
const createTextResponse = (result: ChallengeResult) => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  usage: { input_tokens: 100, output_tokens: 200 },
});

describe('HypothesisChallengerAgent - Parallel Evaluation', () => {
  let agent: TestableChallengerAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = createMockClient();
    agent = new TestableChallengerAgent(mockClient);
  });

  describe('getParallelConfig', () => {
    it('should return single mode for <=3 hypotheses', () => {
      const config1 = agent.testGetParallelConfig(1);
      expect(config1.mode).toBe('single');
      expect(config1.batchSize).toBe(1);
      expect(config1.maxConcurrent).toBe(1);

      const config3 = agent.testGetParallelConfig(3);
      expect(config3.mode).toBe('single');
      expect(config3.batchSize).toBe(3);
      expect(config3.maxConcurrent).toBe(1);
    });

    it('should return batched mode for >3 hypotheses', () => {
      const config4 = agent.testGetParallelConfig(4);
      expect(config4.mode).toBe('batched');
      expect(config4.batchSize).toBe(2);
      expect(config4.maxConcurrent).toBe(3);

      const config10 = agent.testGetParallelConfig(10);
      expect(config10.mode).toBe('batched');
      expect(config10.batchSize).toBe(2);
      expect(config10.maxConcurrent).toBe(3);
    });

    it('should respect override config', () => {
      const config = agent.testGetParallelConfig(2, {
        mode: 'batched',
        batchSize: 1,
        maxConcurrent: 2,
      });
      expect(config.mode).toBe('batched');
      expect(config.batchSize).toBe(1);
      expect(config.maxConcurrent).toBe(2);
    });
  });

  describe('createBatches', () => {
    it('should split hypotheses into groups of specified size', () => {
      const hypotheses = Array.from({ length: 5 }, (_, i) =>
        createMockHypothesis(`h${i + 1}`)
      );

      const batches = agent.testCreateBatches(hypotheses, 2);

      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(2);
      expect(batches[1].length).toBe(2);
      expect(batches[2].length).toBe(1);
    });

    it('should handle exact multiples', () => {
      const hypotheses = Array.from({ length: 4 }, (_, i) =>
        createMockHypothesis(`h${i + 1}`)
      );

      const batches = agent.testCreateBatches(hypotheses, 2);

      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(2);
      expect(batches[1].length).toBe(2);
    });

    it('should handle single batch', () => {
      const hypotheses = [createMockHypothesis('h1'), createMockHypothesis('h2')];

      const batches = agent.testCreateBatches(hypotheses, 5);

      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(2);
    });
  });

  describe('mergeResults', () => {
    it('should combine batch results into single ChallengeResult', () => {
      const batch1 = {
        scoredHypotheses: [createMockScoredHypothesis('h1'), createMockScoredHypothesis('h2')],
        rejected: [],
      };
      const batch2 = {
        scoredHypotheses: [createMockScoredHypothesis('h3'), createMockScoredHypothesis('h4')],
        rejected: [],
      };

      const merged = agent.testMergeResults([batch1, batch2]);

      expect(merged.scoredHypotheses.length).toBe(4);
      expect(merged.summary.totalChallenged).toBe(4);
    });

    it('should recalculate summary correctly', () => {
      const batch1 = {
        scoredHypotheses: [createMockScoredHypothesis('h1', 'pass')],
        rejected: [],
      };
      const batch2 = {
        scoredHypotheses: [createMockScoredHypothesis('h2', 'borderline')],
        rejected: [
          {
            hypothesis: createMockHypothesis('h3'),
            scores: {
              specificity: { score: 1, weight: 0.25, explanation: 'Bad' },
              novelty: { score: 1, weight: 0.2, explanation: 'Bad' },
              connectionValidity: { score: 1, weight: 0.25, explanation: 'Bad' },
              feasibility: { score: 1, weight: 0.15, explanation: 'Bad' },
              grounding: { score: 1, weight: 0.15, explanation: 'Bad' },
              composite: 1.0,
            },
            verdict: 'fail' as const,
            rejectionReasons: ['Too low'],
          },
        ],
      };

      const merged = agent.testMergeResults([batch1, batch2]);

      expect(merged.summary.totalChallenged).toBe(3);
      expect(merged.summary.passed).toBe(1);
      expect(merged.summary.borderline).toBe(1);
      expect(merged.summary.failed).toBe(1);
      expect(merged.rejected.length).toBe(1);
    });
  });

  describe('execute - mode selection', () => {
    it('should use single mode for <=3 hypotheses', async () => {
      const hypotheses = [
        createMockHypothesis('h1'),
        createMockHypothesis('h2'),
        createMockHypothesis('h3'),
      ];

      const mockResponse = JSON.stringify({
        scoredHypotheses: hypotheses.map((h) => ({
          ...h,
          scores: {
            specificity: { score: 4, weight: 0.25, explanation: 'Good' },
            novelty: { score: 3, weight: 0.2, explanation: 'Ok' },
            connectionValidity: { score: 4, weight: 0.25, explanation: 'Good' },
            feasibility: { score: 3, weight: 0.15, explanation: 'Ok' },
            grounding: { score: 3, weight: 0.15, explanation: 'Ok' },
            composite: 3.5,
          },
          verdict: 'pass',
          challengeNotes: [],
          status: 'challenged',
        })),
        rejected: [],
        summary: {
          totalChallenged: 3,
          passed: 3,
          borderline: 0,
          failed: 0,
          averageScore: 3.5,
        },
      });

      (mockClient.messages.create as any).mockResolvedValueOnce(
        createTextResponse(JSON.parse(mockResponse))
      );

      const result = await agent.execute({ hypotheses });

      expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
      expect(result.scoredHypotheses.length).toBe(3);
    });

    it('should use parallel mode for >3 hypotheses', async () => {
      const hypotheses = Array.from({ length: 5 }, (_, i) =>
        createMockHypothesis(`h${i + 1}`)
      );

      const createBatchResult = (ids: string[]): ChallengeResult => ({
        scoredHypotheses: ids.map((id) => ({
          ...createMockHypothesis(id),
          scores: {
            specificity: { score: 4, weight: 0.25, explanation: 'Good' },
            novelty: { score: 3, weight: 0.2, explanation: 'Ok' },
            connectionValidity: { score: 4, weight: 0.25, explanation: 'Good' },
            feasibility: { score: 3, weight: 0.15, explanation: 'Ok' },
            grounding: { score: 3, weight: 0.15, explanation: 'Ok' },
            composite: 3.5,
          },
          verdict: 'pass',
          challengeNotes: [],
          status: 'challenged',
        })),
        rejected: [],
        summary: {
          totalChallenged: ids.length,
          passed: ids.length,
          borderline: 0,
          failed: 0,
          averageScore: 3.5,
        },
      });

      (mockClient.messages.create as any)
        .mockResolvedValueOnce(createTextResponse(createBatchResult(['h1', 'h2'])))
        .mockResolvedValueOnce(createTextResponse(createBatchResult(['h3', 'h4'])))
        .mockResolvedValueOnce(createTextResponse(createBatchResult(['h5'])));

      const result = await agent.execute({ hypotheses });

      expect(mockClient.messages.create).toHaveBeenCalledTimes(3);
      expect(result.scoredHypotheses.length).toBe(5);
      expect(result.summary.totalChallenged).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle partial batch failures', async () => {
      const hypotheses = Array.from({ length: 4 }, (_, i) =>
        createMockHypothesis(`h${i + 1}`)
      );

      const successResult: ChallengeResult = {
        scoredHypotheses: [createMockScoredHypothesis('h1'), createMockScoredHypothesis('h2')],
        rejected: [],
        summary: {
          totalChallenged: 2,
          passed: 0,
          borderline: 2,
          failed: 0,
          averageScore: 3.45,
        },
      };

      (mockClient.messages.create as any)
        .mockResolvedValueOnce(createTextResponse(successResult))
        .mockRejectedValueOnce(new Error('Batch 2 failed'));

      const config: Required<ParallelConfig> = {
        mode: 'batched',
        batchSize: 2,
        maxConcurrent: 2,
      };
      const result = await agent.testEvaluateParallel(hypotheses, config);

      expect(result.scoredHypotheses.length).toBe(2);
      expect(result.scoredHypotheses[0].id).toBe('h1');
    });

    it('should throw if all batches fail', async () => {
      const hypotheses = Array.from({ length: 4 }, (_, i) =>
        createMockHypothesis(`h${i + 1}`)
      );

      (mockClient.messages.create as any).mockRejectedValue(
        new Error('All batches failed')
      );

      const config: Required<ParallelConfig> = {
        mode: 'batched',
        batchSize: 2,
        maxConcurrent: 2,
      };

      await expect(
        agent.testEvaluateParallel(hypotheses, config)
      ).rejects.toThrow();
    });
  });

  describe('parallelConfig override', () => {
    it('should respect parallelConfig override', async () => {
      const hypotheses = [createMockHypothesis('h1'), createMockHypothesis('h2')];

      const mockResult: ChallengeResult = {
        scoredHypotheses: [createMockScoredHypothesis('h1')],
        rejected: [],
        summary: {
          totalChallenged: 1,
          passed: 0,
          borderline: 1,
          failed: 0,
          averageScore: 3.45,
        },
      };

      (mockClient.messages.create as any)
        .mockResolvedValueOnce(createTextResponse(mockResult))
        .mockResolvedValueOnce(createTextResponse(mockResult));

      const result = await agent.execute({
        hypotheses,
        parallelConfig: {
          mode: 'individual',
          batchSize: 1,
          maxConcurrent: 2,
        },
      });

      expect(mockClient.messages.create).toHaveBeenCalledTimes(2);
    });
  });
});
